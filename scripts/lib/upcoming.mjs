// Scheduled events for the "Coming up" layer: national elections and marquee sports events
// (Wikipedia's yearly electoral and sports calendars), solar and lunar eclipses (Wikipedia's eclipse
// lists, from Fred Espenak's NASA predictions), and the major annual meteor showers. Each source falls
// back to its last good parse when Wikipedia is unreachable or a page fails to parse.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const countries = createRequire(import.meta.url)('world-countries');

const UA = 'world-pulse/1.0 (https://nickashley4.github.io/world-pulse/)';
export const HORIZON_DAYS = 30;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_RX = new RegExp(`\\b(${MONTHS.join('|')})\\b`);
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const wiki = (title) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

// Marquee events worth a spot on the globe. Matched against the linked article title, minus its year.
const MARQUEE = new RegExp(`^(?:\\d{4} )?(?:${[
  'World Series', 'NBA Finals', 'WNBA Finals', 'Stanley Cup Final', 'Super Bowl [LXVI]+', 'MLS Cup', '\\d+\\w\\w Grey Cup',
  'College Football Playoff National Championship', "NCAA Division I men's basketball tournament",
  'UEFA Champions League final', 'UEFA Europa League final', "UEFA Women's Champions League final",
  "FIFA (?:Women's |Club )?World Cup", 'UEFA European Championship', 'Copa América', 'Africa Cup of Nations', 'AFC Asian Cup',
  '(?:Summer|Winter) (?:Olympics|Paralympics)', 'Commonwealth Games', 'Asian Games', 'Pan American Games',
  'Wimbledon Championships', 'French Open', 'Australian Open', 'US Open \\(tennis\\)',
  'Masters Tournament', 'PGA Championship', 'U\\.S\\. Open \\(golf\\)', 'Open Championship', 'Ryder Cup', 'Solheim Cup',
  'Tour de France', "Giro d'Italia", 'Vuelta a España', 'Kentucky Derby', 'Melbourne Cup', 'Grand National',
  'Daytona 500', 'Indianapolis 500', 'Monaco Grand Prix', 'Abu Dhabi Grand Prix',
  '(?:Boston|London|Berlin|Chicago|New York City|Tokyo) Marathon',
  "(?:Men's |Women's )?Rugby (?:League )?World Cup", 'Cricket World Cup', "ICC (?:Men's |Women's )?T20 World Cup",
  'World Athletics Championships', 'World Aquatics Championships',
].join('|')})$`);

// Peak nights shift by a day or so from year to year, hence "around" in the text.
const SHOWERS = [
  ['Quadrantids', 1, 3, 110, 'best from the Northern Hemisphere'],
  ['Lyrids', 4, 22, 18, 'best from the Northern Hemisphere'],
  ['Eta Aquariids', 5, 6, 50, 'best from the Southern Hemisphere'],
  ['Southern Delta Aquariids', 7, 30, 25, 'best from the Southern Hemisphere'],
  ['Perseids', 8, 12, 100, 'best from the Northern Hemisphere'],
  ['Draconids', 10, 8, 10, 'best from the Northern Hemisphere'],
  ['Orionids', 10, 21, 20, 'visible from both hemispheres'],
  ['Leonids', 11, 17, 15, 'visible from both hemispheres'],
  ['Geminids', 12, 14, 150, 'visible from both hemispheres'],
  ['Ursids', 12, 22, 10, 'best from the Northern Hemisphere'],
];

async function wikitext(page) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json&formatversion=2&redirects=1`;
    const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) return null;
    const t = (await r.json()).parse?.wikitext;
    return t ? t.replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '').replace(/<!--[\s\S]*?-->/g, '') : null;
  } catch { return null; }
}

const LINK = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g;
const links = (s) => [...s.matchAll(LINK)].map((m) => ({ title: m[1].trim(), label: (m[2] || m[1]).trim() }));
const plain = (s) => s.replace(LINK, (_, t, l) => l || t).replace(/\{\{[^{}]*\}\}/g, '').replace(/'{2,}/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// "18–20 September", "September 19 – October 4", "28 September – 4 October", or a bare "19–25"
// inside a month's table, where "19–4 October" in September's table starts in September.
// Returns { d, d2 } as YYYY-MM-DD, or null.
function dateRange(text, year, ctxMonth = null) {
  const pieces = plain(text).split(/\s*[–—-]\s*/).slice(0, 2).map((p) => ({
    day: +(p.match(/\b(\d{1,2})(?!\d)/)?.[1] || 0),
    month: MONTHS.indexOf(p.match(MONTH_RX)?.[1]) + 1 || null,
    year: +(p.match(/\b(20\d\d)\b/)?.[1] || 0) || null,
  }));
  const [a, b] = pieces;
  if (!a?.day) return null;
  a.month ||= ctxMonth || (b?.month && (b.day && b.day < a.day ? b.month - 1 || 12 : b.month)) || null;
  if (!a.month) return null;
  if (b?.day) b.month ||= b.day < a.day ? (a.month % 12) + 1 : a.month;
  const wraps = !!b?.day && b.month < a.month;
  // "21 December – 18" filed under January started the year before.
  a.year ||= b?.year ? b.year - (wraps ? 1 : 0) : wraps && ctxMonth === b.month ? year - 1 : year;
  const out = { d: iso(a.year, a.month, a.day) };
  if (b?.day) out.d2 = iso(b.year || a.year + (wraps ? 1 : 0), b.month, b.day);
  return out;
}

// "* 4 October: [[Elections in Brazil|Brazil]], [[2026 Brazilian general election|President, …]]", with
// several countries on one date listed as "**" lines under it.
function parseElections(text, year, placeOf) {
  const out = [];
  let section = '', date = null;
  for (const line of text.split('\n')) {
    const h = line.match(/^=+\s*(.*?)\s*=+\s*$/);
    if (h) { section = plain(h[1]); date = null; continue; }
    if (/^(Unknown|See also|References|External|Notes)/i.test(section)) continue;
    const m = line.match(/^(\*+)\s*(.*)$/);
    if (!m) continue;
    let rest = m[2];
    if (m[1].length === 1) {
      const c = rest.match(/^([^:[\]]{1,60}):\s*(.*)$/);
      date = c && !/TBD|,/.test(c[1]) ? dateRange(c[1], year) : null;
      rest = c ? c[2] : '';
    }
    const ls = links(rest);
    if (!date || ls.length < 2) continue;
    const country = ls[0].label;
    const body = plain(rest.slice(rest.indexOf(']]') + 2)).replace(/^[,\s]+/, '');
    out.push({
      k: 'election', t: country, s: /^Indirect/i.test(section) ? `${body} (indirect)` : body, ...date,
      p: [placeOf(country)].filter(Boolean), u: wiki(ls[1].title),
    });
  }
  return out;
}

// The month-by-month tables in "YYYY in sports": | day(s) | sport | {{flagicon|USA}} [[event]] | …
function parseSports(text, year, placeOf) {
  const out = [];
  let month = null, cells = null;
  const flush = () => {
    if (cells && cells.length >= 3 && month) {
      const date = dateRange(cells[0], year, month);
      for (const cell of cells.slice(1, 4)) {
        const ev = links(cell).find((l) => MARQUEE.test(l.title.replace(/’/g, "'")));
        if (!date || !ev) continue;
        const flags = [...cell.matchAll(/\{\{\s*(?:flag ?icon|flag|flagcountry)\s*\|\s*([^}|]+)/gi)].map((f) => placeOf(f[1]));
        out.push({ k: 'sports', t: ev.label.replace(/’/g, "'"), ...date, p: [...new Set(flags.filter(Boolean))].slice(0, 3), u: wiki(ev.title) });
        break;
      }
    }
    cells = null;
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const h = line.match(/^=+\s*(.*?)\s*=+$/);
    if (h) { flush(); const name = plain(h[1]); month = MONTHS.includes(name) ? MONTHS.indexOf(name) + 1 : null; continue; }
    if (!month) continue;
    if (line.startsWith('|-') || line.startsWith('|}') || line.startsWith('{|')) { flush(); if (line.startsWith('|-')) cells = []; continue; }
    if (cells && line.startsWith('|')) {
      for (const c of line.slice(1).split('||')) cells.push(c.replace(/^(?:\s*[\w-]+=(?:"[^"]*"|[^\s|]+))+\s*\|(?!\|)/, '').trim());
    }
  }
  flush();
  return out;
}

// Where the Moon is overhead at a given moment: opposite the Sun, near enough during an eclipse.
function subLunar(ts) {
  const rad = Math.PI / 180, d = ts / 864e5 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * rad, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad, e = (23.439 - 0.00000036 * d) * rad;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / rad;
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const sunLng = ((ra - gmst * 15 + 540) % 360) - 180;
  return { lat: +(-dec / rad).toFixed(1), lng: +((((sunLng + 360) % 360) - 180)).toFixed(1) };
}

// Rows of the 21st-century eclipse lists for the next two years. Penumbral lunar eclipses are too
// faint to notice, so they're left out.
function parseEclipses(text, kind, fromDay) {
  const toDay = `${+fromDay.slice(0, 4) + 2}${fromDay.slice(4)}`;
  const out = [];
  for (const row of text.split(/\n\|-/)) {
    const head = links(row).find((l) => (kind === 'solar' ? /^Solar eclipse of /.test(l.title) : / lunar eclipse$/.test(l.title)));
    if (!head) continue;
    const when = new Date(`${head.label} 12:00 UTC`);
    if (Number.isNaN(+when)) continue;
    const day = when.toISOString().slice(0, 10);
    if (day < fromDay || day > toDay) continue;
    const time = row.match(/\n\|\s*(\d{2}:\d{2}(?::\d{2})?)\s*\n/)?.[1];
    const type = row.match(/\n\|\s*(?:''')?(Total|Annular|Hybrid|Partial|Penumbral)(?:''')?\s*\n/)?.[1];
    if (!type || type === 'Penumbral') continue;
    const ts = time ? Date.parse(`${day}T${time.length === 5 ? `${time}:00` : time}Z`) : null;
    const ev = { k: 'eclipse', t: `${type} ${kind} eclipse`, d: day, p: [], u: wiki(head.title), ...(ts && { ts }) };
    if (kind === 'solar') {
      const c = row.match(/\{\{coord\|([\d.]+)\|([NS])\|([\d.]+)\|([EW])/);
      if (c) Object.assign(ev, { lat: +c[1] * (c[2] === 'S' ? -1 : 1), lng: +c[3] * (c[4] === 'W' ? -1 : 1) });
      const vis = row.split('\n').find((l) => /'''(Total|Annular|Hybrid|Partial):'''/.test(l));
      if (vis) ev.s = plain(vis.replace(/^\|\s*(?:[\w-]+="[^"]*"\s*)*\|?/, '').replace(/<br\s*\/?>/g, ' · '));
    } else {
      if (ts) Object.assign(ev, subLunar(ts));
      ev.s = 'Visible wherever the Moon is up: the night side of Earth';
    }
    out.push(ev);
  }
  return out;
}

function showers(today, end) {
  const out = [];
  for (const y of new Set([+today.slice(0, 4), +end.slice(0, 4)])) {
    for (const [name, m, d, zhr, where] of SHOWERS) {
      out.push({ k: 'meteor', t: `${name} meteor shower`, d: iso(y, m, d), p: [], s: `Peaks around this night · up to ~${zhr} meteors an hour in dark skies · ${where}`, u: wiki(name) });
    }
  }
  return out;
}

function makePlaceOf(places, geo) {
  const byCode = new Map([['ENG', 'c:GBR'], ['SCO', 'c:GBR'], ['WAL', 'c:GBR'], ['NIR', 'c:GBR']]);
  for (const c of countries) for (const code of [c.cca3, c.cioc]) if (code && places[`c:${c.cca3}`] && !byCode.has(code)) byCode.set(code, `c:${c.cca3}`);
  const byName = new Map(Object.entries(places).map(([k, p]) => [p.n.toLowerCase(), k]));
  return (s) => {
    s = plain(s);
    if (/^[A-Z]{3}$/.test(s)) return byCode.get(s) || null;
    return byName.get(s.toLowerCase()) || geo(s).find((h) => !h.weak)?.key || null;
  };
}

export async function loadUpcoming({ root, places, geo, today, log = console.log }) {
  const cachePath = path.join(root, 'data', 'upcoming-cache.json');
  let cache = {};
  try { cache = JSON.parse(await fs.readFile(cachePath, 'utf8')); } catch {}
  const end = new Date(Date.parse(`${today}T12:00:00Z`) + HORIZON_DAYS * 864e5).toISOString().slice(0, 10);
  const years = [...new Set([+today.slice(0, 4), +end.slice(0, 4)])];
  const placeOf = makePlaceOf(places, geo);

  // Each source keeps its last good parse; a missing next-year page just means nothing is scheduled yet.
  const source = async (name, fn) => {
    const got = await fn().catch(() => null);
    if (got?.length) cache[name] = got;
    else log(`Coming up: ${name} unavailable, using last good copy`);
    return cache[name] || [];
  };
  const perYear = (page, parse) => async () => (await Promise.all(years.map(async (y) => {
    const t = await wikitext(page(y));
    return t ? parse(t, y, placeOf) : y === years[0] ? null : [];
  }))).flatMap((x) => { if (!x) throw new Error('missing'); return x; });

  const [elections, sports, solar, lunar] = await Promise.all([
    source('elections', perYear((y) => `${y} national electoral calendar`, parseElections)),
    source('sports', perYear((y) => `${y} in sports`, parseSports)),
    source('solar', async () => parseEclipses(await wikitext('List of solar eclipses in the 21st century') || '', 'solar', today)),
    source('lunar', async () => parseEclipses(await wikitext('List of lunar eclipses in the 21st century') || '', 'lunar', today)),
  ]);
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(cache));

  // Anything underway or starting within the horizon. Multi-day events stay listed until they end.
  const seen = new Set();
  const events = [...elections, ...sports, ...solar, ...lunar, ...showers(today, end)]
    .filter((e) => (e.d2 || e.d) >= today && e.d <= end)
    .filter((e) => { const key = `${e.k}|${e.t}|${e.s || ''}|${e.d}`; return !seen.has(key) && seen.add(key); })
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  const unplaced = events.filter((e) => (e.k === 'election' || e.k === 'sports') && !e.p.length).map((e) => e.t);
  if (unplaced.length) log(`Coming up: no place found for ${unplaced.join(', ')}`);
  return { from: today, to: end, events };
}
