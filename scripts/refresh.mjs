// Fetch trusted news, geolocate, cluster, rank, cap, and write docs/data/*.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseFeed } from './lib/rss.mjs';
import { buildGazetteer, US_GENERIC } from './lib/gazetteer.mjs';
import { FEEDS, TOPIC_QUERIES, trustOf, isBlockedTitle, host } from './lib/sources.mjs';
import { classify, importance, SPACE_STRONG, SPORTS_FILLER } from './lib/classify.mjs';
import { loadSpace } from './lib/space.mjs';
import { loadCollege, OTHER_SPORT_RX } from './lib/college.mjs';
import { resolveGoogleLinks } from './lib/gnews.mjs';
import { loadUpcoming } from './lib/upcoming.mjs';
import { loadGames } from './lib/games.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs', 'data');
const RAW = path.join(ROOT, 'data', 'items.json');
const NDAYS = 7;
const MIN_SCORE = 2.5;
const MERGE_COS = 0.3; // tf-idf cosine above which two same-day clusters about a shared place are one story
const STATE_MIN_SCORE = 1.5;
// Soft caps: the recommended stories per place per day. A story past the cap still gets in when
// its score clears BONUS for that place type (heavy trusted coverage), up to a CEILING safety net.
const CAP = { nation: 6, state: 3, country: 3, space: 8 };
const BONUS = { nation: 10, state: 7, country: 9, space: 6 };
const CEILING = 12;
// Sports get their own tighter cap so a busy game day doesn't bury a state's or country's news.
const SPORTS_CAP = { nation: 2, state: 1, country: 1, space: 0 };
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'; // keep current: ESPN's bot filter returns an empty 202 to stale Chrome versions
const NOW = Date.now();

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const etDay = (ms) => dayFmt.format(new Date(ms));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[${((Date.now() - NOW) / 1000).toFixed(1)}s]`, ...a);

const fetchErrors = new Map(); // url → why its last fetch failed
async function fetchText(url, tries = 3) {
  let why = '';
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/rss+xml,application/xml,text/xml,*/*' }, signal: AbortSignal.timeout(20000) });
      if (r.ok) {
        const text = await r.text();
        if (text.trim()) return text;
        why = `empty response, HTTP ${r.status}`;
        break;
      }
      why = `HTTP ${r.status}`;
      if (r.status === 429 || r.status >= 500) { await sleep(2000 * (i + 1)); continue; }
      break;
    } catch (e) { why = e.name === 'TimeoutError' ? 'timeout' : e.cause?.code || e.message; await sleep(1000 * (i + 1)); }
  }
  fetchErrors.set(url, why);
  return null;
}

async function pool(tasks, n) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < tasks.length) await tasks[i++](); }));
}

const gn = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:7d`)}&hl=en-US&gl=US&ceid=US:en`;

const fetchJSON = async (u) => { const t = await fetchText(u, 2); try { return t ? JSON.parse(t) : null; } catch { return null; } };
const baseG = buildGazetteer();
const college = await loadCollege({
  root: ROOT, fetchJSON, isPlaceAlias: baseG.isAlias,
  stateByName: Object.values(baseG.places).filter((p) => p.t === 'state').map((p) => [p.n, p.ab]),
  stateKeys: new Set(Object.keys(baseG.places).filter((k) => k.startsWith('s:'))),
});
log(`College: ${college.ranked.length} ranked teams (AP Top 25 football + men's basketball)`);
const G = buildGazetteer(college.aliases);
const days = Array.from({ length: NDAYS }, (_, i) => etDay(NOW - (NDAYS - 1 - i) * 864e5));
const daySet = new Set(days);
const spacePromise = loadSpace({ root: ROOT, fetchJSON, etDay, days });
const upcomingPromise = loadUpcoming({ root: ROOT, places: G.places, geo: G.geo, today: days.at(-1), log });
// ESPN venues give the state as "TN" for most leagues but "Tennessee" for MLB.
const stateKeys = new Map([['District of Columbia', 's:DC'], ...Object.entries(G.places).filter(([, p]) => p.t === 'state').flatMap(([k, p]) => [[p.ab, k], [p.n, k]])]);
const apRanks = new Map(college.ranked.map((t) => [t.dn, t.ranks]));
const gamesPromise = loadGames({
  fetchJSON, today: days.at(-1), log, prevPath: path.join(OUT, 'games.json'),
  apRank: (sport, dn) => apRanks.get(dn)?.[sport] || null, stateKey: (st) => stateKeys.get(st) || null,
  teamState: (dn) => (dn && G.geo(dn).find((h) => h.key.startsWith('s:') && !h.weak)?.key) || null,
});

// ---------- 1. Collect ----------
const jobs = [
  ...[...FEEDS, ...college.feeds].map((f) => ({ ...f, home: true })),
  ...[...G.queries, ...college.queries].map(({ key, q }) => ({ url: gn(q), gn: true, q: key })),
  ...TOPIC_QUERIES.map((q) => ({ url: gn(q), gn: true, q: null })),
];

const fresh = [];
let failed = 0;
function toItem(raw, job) {
  let title = raw.title;
  if (!title || !raw.link) return null;
  let n = job.name, d = job.domain;
  if (job.gn) {
    if (!raw.srcUrl) return null;
    d = host(raw.srcUrl);
    n = raw.srcName || d;
    const suf = ` - ${n}`;
    title = title.endsWith(suf) ? title.slice(0, -suf.length) : title.replace(/\s+[-|]\s+[^-|]{2,60}$/, '');
  }
  const ts = Date.parse(raw.date);
  if (!ts || ts > NOW + 3600e3 || etDay(ts) < days[0]) return null;
  const trust = trustOf(d, job.q, G.outletStates);
  if (!trust || isBlockedTitle(title)) return null;
  return {
    t: title, u: raw.link, n, d, ts, w: trust.w,
    s: job.gn ? '' : (raw.desc || '').slice(0, 320),
    img: job.gn ? null : raw.img || null,
    h: job.home ? 1 : 0, q: job.q || null, st: trust.st || null, loc: trust.local ? 1 : 0,
    hint: job.hint || null, us: job.us ? 1 : 0,
  };
}

// ESPN JSON news (`api` feeds), in the shape parseFeed returns. Video clips are dropped: they carry no story.
async function fetchNews(url) {
  const j = await fetchJSON(url);
  const arts = j?.articles || j?.headlines;
  if (!arts) return null;
  return arts.filter((a) => a.type !== 'Media' && a.headline && a.links?.web?.href).map((a) => ({
    title: a.headline, link: a.links.web.href, date: a.published || a.lastModified,
    desc: a.description || '', img: a.images?.[0]?.url || null,
  }));
}

log(`Fetching ${jobs.length} feeds…`);
await pool(jobs.map((job) => async () => {
  let entries = null;
  if (job.api) entries = await fetchNews(job.url);
  else { const xml = await fetchText(job.url); if (xml) entries = parseFeed(xml); }
  if (!entries) {
    failed++;
    log(`Feed failed (${fetchErrors.get(job.url) || 'unreadable response'}):${job.id || `Google News ${decodeURIComponent(job.url.match(/q=([^&]*)/)[1])}`}`);
    return;
  }
  for (const raw of entries) {
    const it = toItem(raw, job);
    if (it) fresh.push(it);
  }
}), 6);
log(`Fetched: ${fresh.length} trusted items (${failed} feeds failed)`);

// Merge with persisted items so curated feeds (which only hold ~1-2 days) keep a full week. Only the
// week the site shows is kept: anything older can never reach a day file, and this file is committed
// on every refresh, so each extra day it holds is history the repo carries forever.
let prev = [];
try { prev = JSON.parse(await fs.readFile(RAW, 'utf8')); } catch {}
const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
const seen = new Map();
for (const it of [...fresh, ...prev]) {
  if (etDay(it.ts) < days[0] || isBlockedTitle(it.t)) continue; // re-filter saved items as rules evolve
  const k = `${norm(it.t)}|${it.d}`;
  const old = seen.get(k);
  if (!old) seen.set(k, it);
  else { old.h ||= it.h; old.s ||= it.s; old.img ||= it.img; old.q ||= it.q; old.hint ||= it.hint; old.us ||= it.us; }
}
const items = [...seen.values()];
await fs.mkdir(path.dirname(RAW), { recursive: true });
await fs.writeFile(RAW, JSON.stringify(items));

// ---------- 2. Geolocate ----------
function placesFor(it) {
  const hits = G.geo(it.t);
  const text = `${it.t} ${it.s}`;
  const keysAll = [...new Set(hits.map((h) => h.key))];
  let keys = keysAll.filter((k) => {
    const hs = hits.filter((h) => h.key === k);
    if (hs.some((h) => !h.weak)) return true;
    // weak alias only (e.g. "Jordan", "Chiefs"): need corroboration
    if (G.geo(text).some((h) => h.key === k && !h.weak)) return true;
    // Name-like city ("Montgomery"): the city's own news query doesn't count; a state outlet does.
    if (hs.every((h) => h.nameLike)) return !!it.st?.includes(k.slice(2));
    return it.q === k;
  });
  if (!keys.length && it.h && it.s) keys = G.geo(it.s).filter((h) => !h.weak).slice(0, 1).map((h) => h.key);
  if (!keys.length && it.st) {
    if (it.q && it.st.includes(it.q.slice(2))) keys = [it.q];
    else if (it.st.length === 1) keys = [`s:${it.st[0]}`];
  }
  if (!keys.length && it.us) keys = ['c:USA'];

  if (keys.includes('c:USA')) {
    const us = hits.filter((h) => h.key === 'c:USA');
    const fed = us.some((h) => !US_GENERIC.has(h.alias) && h.alias !== 'Supreme Court');
    const hasState = keys.some((k) => k.startsWith('s:'));
    const otherCountry = keys.some((k) => k.startsWith('c:') && k !== 'c:USA');
    const onlyCourt = us.length && us.every((h) => h.alias === 'Supreme Court');
    if ((hasState && !fed) || (onlyCourt && otherCountry)) keys = keys.filter((k) => k !== 'c:USA');
  }
  return keys.slice(0, 3);
}

// ---------- 3. Cluster per day ----------
const STOP = new Set('the a an and or of to in on for with at by from as is are was were be been has have had it its this that after over into amid about says say said new more than up out not but will could would may can just us who what how why when his her their they he she we you our after before during against under between off first last year years week day days'.split(' '));
const tokens = (t) => new Set(t.toLowerCase().replace(/[’']s\b/g, '').split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/(ies)$/, 'y').replace(/s$/, '')));

const byDay = new Map(days.map((d) => [d, []]));
for (const it of items) {
  const day = etDay(it.ts);
  if (!daySet.has(day)) continue;
  it.keys = placesFor(it);
  // Space stories often happen nowhere on Earth; they live in the Space section instead.
  if (!it.keys.length && (it.hint === 'space' || SPACE_STRONG.test(it.t))) it.keys = ['x:SPACE'];
  if (it.keys.length) byDay.get(day).push(it);
}

const hash = (s) => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };

// Second pass: merge clusters that are the same story told differently (tf-idf cosine over all
// their headlines), or two sports clusters about the same matchup (sharing 2+ places).
let merges = 0, droppedCollege = 0, PLACE_TOK = null;
const sqNorm = (m) => Math.sqrt([...m.values()].reduce((s, v) => s + v * v, 0)) || 1;
function mergeClusters(cl) {
  // Place names are ignored for similarity (places are compared separately), so "Maine" + "Bangor" alone never merges.
  PLACE_TOK ||= new Set(G.aliasList().flatMap((a) => [...tokens(a)]));
  for (const c of cl) {
    c.cat = classify(c.items.slice(0, 6).map((x) => x.t), c.items.map((x) => x.d), c.items.map((x) => x.hint));
    c.tf = new Map();
    for (const it of c.items) for (const w of tokens(it.t)) if (!PLACE_TOK.has(w)) c.tf.set(w, (c.tf.get(w) || 0) + 1);
  }
  const df = new Map();
  for (const c of cl) for (const w of c.tf.keys()) df.set(w, (df.get(w) || 0) + 1);
  const inv = new Map();
  cl.forEach((c, i) => {
    let n = 0;
    c.vec = new Map();
    for (const [w, f] of c.tf) { const v = (1 + Math.log(f)) * Math.log(1 + cl.length / df.get(w)); c.vec.set(w, v); n += v * v; }
    c.norm = Math.sqrt(n) || 1;
    for (const w of c.tf.keys()) if (df.get(w) <= 40) (inv.get(w) || inv.set(w, []).get(w)).push(i);
  });
  const cands = [];
  const tried = new Set();
  for (const ids of inv.values()) {
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) {
      const a = ids[x], b = ids[y], pk = a * 1e6 + b;
      if (tried.has(pk)) continue;
      tried.add(pk);
      const A = cl[a], B = cl[b];
      const shared = [...A.pc.keys()].filter((k) => B.pc.has(k)).length;
      if (!shared) continue;
      let dot = 0, sharedTok = 0;
      for (const [w, v] of A.vec) { const u = B.vec.get(w); if (u) { dot += v * u; sharedTok++; } }
      const cos = dot / (A.norm * B.norm);
      const sameGame = A.cat === 'sports' && B.cat === 'sports' && shared >= 2;
      if ((cos >= MERGE_COS && sharedTok >= 2) || (sameGame && cos >= 0.1)) cands.push([cos, a, b, sameGame]);
    }
  }
  // College games: two college-sports clusters on the same day naming the same two states are one game.
  const pairIdx = new Map();
  cl.forEach((c, i) => {
    if (!college.detect(c.items.map((x) => x.t).join(' \n ')).isCollege) return;
    const ks = [...c.pc.keys()].sort();
    for (let x = 0; x < ks.length; x++) for (let y = x + 1; y < ks.length; y++) {
      const k = `${ks[x]}|${ks[y]}`;
      (pairIdx.get(k) || pairIdx.set(k, []).get(k)).push(i);
    }
  });
  for (const ids of pairIdx.values()) {
    if (ids.length > 80) continue;
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) cands.push([0.05, ids[x], ids[y], 'game']);
  }

  // Best pairs first; a merge must also hold against the whole group, which stops chaining.
  cands.sort((x, y) => y[0] - x[0]);
  const parent = cl.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const gvec = cl.map((c) => new Map(c.vec));
  const gnorm = cl.map((c) => c.norm);
  for (const [, a, b, sameGame] of cands) {
    const ra = find(a), rb = find(b);
    if (ra === rb) continue;
    const [small, big] = gvec[ra].size < gvec[rb].size ? [gvec[ra], gvec[rb]] : [gvec[rb], gvec[ra]];
    let dot = 0;
    for (const [w, v] of small) { const u = big.get(w); if (u) dot += v * u; }
    const need = sameGame === 'game' ? -1 : sameGame ? 0.1 : MERGE_COS * 0.85;
    if (dot / (gnorm[ra] * gnorm[rb]) < need) continue;
    parent[ra] = rb;
    for (const [w, v] of gvec[ra]) gvec[rb].set(w, (gvec[rb].get(w) || 0) + v);
    gnorm[rb] = sqNorm(gvec[rb]);
    merges++;
  }
  const groups = new Map();
  cl.forEach((c, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, { day: c.day, items: [], pc: new Map() });
    const g = groups.get(r);
    g.items.push(...c.items);
    for (const [k, v] of c.pc) g.pc.set(k, (g.pc.get(k) || 0) + v);
  });
  return [...groups.values()];
}

const clusters = [];
for (const [day, list] of byDay) {
  list.sort((a, b) => b.w - a.w || b.h - a.h);
  const cl = [];
  const index = new Map();
  for (const it of list) {
    const tk = tokens(it.t);
    const counts = new Map();
    for (const w of tk) for (const ci of index.get(w) || []) counts.set(ci, (counts.get(ci) || 0) + 1);
    let best = -1, bestSim = 0;
    for (const [ci, shared] of counts) {
      const c = cl[ci];
      const ov = shared / Math.min(tk.size, c.tk.size);
      const jac = shared / (tk.size + c.tk.size - shared);
      const ok = (shared >= 3 && ov >= 0.6) || (shared >= 2 && jac >= 0.5);
      if (ok && jac + ov > bestSim && it.keys.some((k) => c.pc.has(k))) { best = ci; bestSim = jac + ov; }
    }
    if (best < 0) {
      best = cl.length;
      cl.push({ day, tk, items: [], pc: new Map() });
      for (const w of tk) index.set(w, [...(index.get(w) || []), best]);
    }
    const c = cl[best];
    c.items.push(it);
    it.keys.forEach((k, i) => c.pc.set(k, (c.pc.get(k) || 0) + (i === 0 ? 1.2 : 1)));
  }

  for (const c of mergeClusters(cl)) {
    const doms = new Map();
    for (const it of c.items) if (!doms.has(it.d) || doms.get(it.d).w < it.w) doms.set(it.d, it);
    const srcs = [...doms.values()].sort((a, b) => b.w - a.w || b.h - a.h);
    const rep = srcs.find((x) => x.h && x.w >= 2) || srcs[0];
    const home = c.items.some((x) => x.h);
    let score = srcs.slice(0, 6).reduce((s, x) => s + x.w, 0) + (home ? 2 : 0) + importance(rep.t, srcs.length);
    const titles = c.items.slice(0, 8).map((x) => x.t);
    const col = college.detect(titles.join(' \n '));
    const cat = classify(titles, srcs.map((x) => x.d), [...c.items.map((x) => x.hint), col.strong ? 'sports' : null]);
    const isCollege = cat === 'sports' && col.isCollege;
    // College sports: only AP Top 25 football / men's basketball.
    if (isCollege && (!col.ranked || OTHER_SPORT_RX.test(titles.join(' ')))) { droppedCollege++; continue; }
    if (cat === 'conflict' || cat === 'disaster') score += 1;
    if (cat === 'sports' && SPORTS_FILLER.test(rep.t)) score -= 2;
    const maxPc = Math.max(...c.pc.values());
    const places = [...c.pc.entries()].filter(([, v]) => v >= maxPc * 0.34).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
    // State-only stories come from smaller outlets; allow a single vetted state outlet through.
    const stateOnly = places.every((k) => k.startsWith('s:'));
    if (score < (stateOnly ? STATE_MIN_SCORE : MIN_SCORE)) continue;
    // Only stories that classify as space belong in the Space section.
    if (cat === 'space') { if (!places.includes('x:SPACE')) places.push('x:SPACE'); }
    else if (places.includes('x:SPACE')) {
      places.splice(places.indexOf('x:SPACE'), 1);
      if (!places.length) continue;
    }
    const summary = c.items.find((x) => x.s && norm(x.s) !== norm(x.t))?.s || '';
    clusters.push({
      id: hash(day + rep.t), d: day, places, c: cat, t: rep.t, s: summary, u: rep.u,
      src: srcs.slice(0, 5).map((x, i) => (i < 3 ? [x.n, x.u] : [x.n])),
      ns: srcs.length, ts: Math.min(...c.items.map((x) => x.ts)), sc: Math.round(score * 10) / 10,
      img: c.items.find((x) => x.img)?.img || undefined,
      ...(isCollege && { k: 'college' }),
    });
  }
}

// ---------- 4. Cap per place/day and assemble ----------
const typeOf = (k) => (k === 'c:USA' ? 'nation' : k.startsWith('s:') ? 'state' : k.startsWith('x:') ? 'space' : 'country');
const used = new Map();
const out = new Map(days.map((d) => [d, []]));
const stats = Object.fromEntries(days.map((d) => [d, {}]));
const arcs = Object.fromEntries(days.map((d) => [d, []]));
clusters.sort((a, b) => b.sc - a.sc);
for (const c of clusters) {
  const assigned = [];
  for (const k of c.places) {
    const uk = `${c.d}|${k}`;
    const n = used.get(uk) || 0;
    const type = typeOf(k);
    const sk = `${uk}|sports`;
    const ns = used.get(sk) || 0;
    if (c.c === 'sports' && ns >= SPORTS_CAP[type] && c.sc < BONUS[type]) continue;
    if (n < CAP[type] || (c.sc >= BONUS[type] && n < CEILING)) {
      used.set(uk, n + 1);
      if (c.c === 'sports') used.set(sk, ns + 1);
      assigned.push(k);
    }
  }
  if (!assigned.length) continue;
  const story = { ...c, p: assigned, x: c.places.filter((k) => !assigned.includes(k)) };
  delete story.places;
  if (!story.x.length) delete story.x;
  out.get(c.d).push(story);
  for (const k of assigned) {
    const e = (stats[c.d][k] ||= {});
    const cur = e[c.c] || [0, 0];
    e[c.c] = [cur[0] + 1, Math.max(cur[1], c.sc)];
  }
  const geoPlaces = c.places.filter((k) => !k.startsWith('x:'));
  if (geoPlaces.length > 1 && c.sc >= 5 && arcs[c.d].length < 40) {
    // [from, to, category, score, storyId, headline, place whose panel lists the story]
    const home = assigned.find((p) => !p.startsWith('x:')) || geoPlaces[0];
    for (const k of geoPlaces.slice(1)) arcs[c.d].push([geoPlaces[0], k, c.c, c.sc, c.id, c.t, home]);
  }
}

const top = {};
for (const d of days) {
  const perPlace = new Map();
  top[d] = out.get(d).filter((s) => {
    const k = s.p[0];
    const n = perPlace.get(k) || 0;
    if (n >= 2) return false;
    perPlace.set(k, n + 1);
    return true;
  }).slice(0, 12).map((s) => s.id);
}

// ---------- 5. Write ----------
await resolveGoogleLinks(days.flatMap((d) => out.get(d)), path.join(ROOT, 'data', 'gnews.json'), { log });
await fs.mkdir(OUT, { recursive: true });
for (const f of await fs.readdir(OUT)) if (/^day-.*\.json$/.test(f) && !daySet.has(f.slice(4, 14))) await fs.unlink(path.join(OUT, f));
let total = 0;
const outlets = new Set();
for (const d of days) {
  const stories = out.get(d);
  total += stories.length;
  stories.forEach((s) => s.src.forEach(([n]) => outlets.add(n)));
  await fs.writeFile(path.join(OUT, `day-${d}.json`), JSON.stringify({ day: d, stories }));
}
const places = {};
for (const [k, p] of Object.entries(G.places)) {
  places[k] = { n: p.n, t: p.t, lat: +p.lat.toFixed(2), lng: +p.lng.toFixed(2), ...(p.f && { f: p.f }), ...(p.ab && { ab: p.ab }) };
}
places['x:SPACE'] = { n: 'Space', t: 'space' };
const poly = {};
for (const [k, p] of Object.entries(G.places)) if (p.poly) poly[p.poly] = k;
await fs.writeFile(path.join(OUT, 'index.json'), JSON.stringify({
  generated: new Date(NOW).toISOString(), days, stories: total, outlets: outlets.size, places, poly, stats, arcs, top,
  polls: college.polls,
}));
// The overview's top stories in full, so the first screen doesn't need every day file.
const topSet = new Set(Object.values(top).flat());
await fs.writeFile(path.join(OUT, 'top.json'), JSON.stringify({ stories: days.flatMap((d) => out.get(d).filter((s) => topSet.has(s.id))) }));
const space = await spacePromise;
await fs.writeFile(path.join(OUT, 'space.json'), JSON.stringify(space));
await fs.writeFile(path.join(OUT, 'games.json'), JSON.stringify(await gamesPromise));
const upcoming = await upcomingPromise;
await fs.writeFile(path.join(OUT, 'upcoming.json'), JSON.stringify(upcoming));
const kinds = {};
for (const e of upcoming.events) kinds[e.k] = (kinds[e.k] || 0) + 1;
log(`Coming up (to ${upcoming.to}): ${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', ') || 'nothing scheduled'}`);
log(`Space: ${space.launches.length} launches, ${space.upcoming.length} upcoming, ${Object.keys(space.apod).length} APODs, ${Object.values(space.neos).flat().length} asteroid flybys, ${space.crew.count} people in space, ${space.planets.length} new exoplanets`);
await college.save();
log(`Merged ${merges} duplicate clusters; dropped ${droppedCollege} unranked/other-sport college clusters.`);
log(`Wrote ${total} stories across ${days.length} days from ${outlets.size} outlets.`);
for (const d of days) log(`  ${d}: ${out.get(d).length} stories, ${Object.keys(stats[d]).length} places`);
