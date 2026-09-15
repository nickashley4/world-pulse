import Globe from 'globe.gl';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import { createSpace } from './space.js';

const CATS = {
  conflict: { label: 'Conflict', color: '#ff4d5e' },
  politics: { label: 'Politics', color: '#6f8cff' },
  disaster: { label: 'Disasters', color: '#ff9a3d' },
  space: { label: 'Space', color: '#c77dff' },
  science: { label: 'Science', color: '#39d0ff' },
  sports: { label: 'Sports', color: '#3ddc84' },
  business: { label: 'Business', color: '#ffd166' },
  culture: { label: 'Culture', color: '#ff6fb5' },
  general: { label: 'World', color: '#c3cede' },
};
const LAYERS = {
  night: { label: 'Day / night', color: '#7a8cff' },
  glow: { label: 'Hotspot glow', color: '#ff4d5e' },
  arcs: { label: 'Story links', color: '#5aa9ff' },
  quakes: { label: 'Earthquakes', color: '#ffc850' },
  events: { label: 'Fires · storms · volcanoes', color: '#ff7a2f' },
};
const SPACE_LAYERS = {
  iss: { label: 'ISS live orbit', color: '#e6d2ff' },
  launches: { label: 'Launches', color: '#c77dff' },
  aurora: { label: 'Aurora forecast', color: '#50ffaa' },
  night: { label: 'Day / night', color: '#7a8cff' },
};
// Story links on/off is remembered per browser.
const PREF_LINKS = 'wp.storyLinks';
const linksPref = () => { try { return localStorage.getItem(PREF_LINKS) !== 'off'; } catch { return true; } };
const IMG = 'https://cdn.jsdelivr.net/npm/three-globe@2.45.0/example/img/';
const WORLD_TOPO = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
const US_TOPO = 'https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json';
const EONET = 'https://eonet.gsfc.nasa.gov/api/v3/events?days=8&status=all&category=wildfires,severeStorms,volcanoes';
const USGS = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const etDay = (ms) => dayFmt.format(new Date(ms));
const getJSON = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json(); });
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');

const S = {
  idx: null, day: null, sel: null,
  cats: new Set(Object.keys(CATS)),
  layers: { night: true, glow: true, arcs: linksPref(), quakes: true, events: true, iss: true, launches: true, aurora: true },
  mode: 'earth',
  cache: new Map(), stats: new Map(), hover: null,
  quakes: [], events: [], play: null, panelToken: 0,
  q: '', hits: null, hitIds: null,
};
let world, polys, material, SP;

// ---------- Helpers ----------
const selDays = () => (S.day === 'week' ? S.idx.days : [S.day]);
const place = (k) => S.idx.places[k];
const flag = (k) => { const p = place(k); return p?.f || (p?.t === 'state' ? '🇺🇸' : '📍'); };
const dayLabel = (d, opts = { weekday: 'long', month: 'short', day: 'numeric' }) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
const periodLabel = () => (S.day === 'week' ? 'Past 7 days' : S.day === S.idx.days.at(-1) ? `Today · ${dayLabel(S.day, { month: 'short', day: 'numeric' })}` : dayLabel(S.day));
const timeLabel = (ts) => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function loadDay(d) {
  if (!S.cache.has(d)) S.cache.set(d, getJSON(`data/day-${d}.json`).then((j) => j.stories).catch(() => []));
  return S.cache.get(d);
}

function computeStats() {
  S.stats.clear();
  const bump = (k, c, n, sc) => {
    if (!S.cats.has(c)) return;
    const st = S.stats.get(k) || { count: 0, top: 0, cat: null, hot: 0 };
    st.count += n;
    if (sc > st.top) { st.top = sc; st.cat = c; }
    if ((c === 'conflict' || c === 'disaster') && sc > st.hot) st.hot = sc;
    S.stats.set(k, st);
  };
  if (S.hits) {
    // Search mode: the globe shows only where matching stories are, across the whole week.
    for (const s of S.hits) for (const k of s.p) bump(k, s.c, 1, s.sc);
  } else {
    for (const d of selDays()) {
      for (const [k, cats] of Object.entries(S.idx.stats[d] || {})) {
        for (const [c, [n, sc]] of Object.entries(cats)) bump(k, c, n, sc);
      }
    }
  }
  S.maxTop = Math.max(1, ...[...S.stats.values()].map((st) => st.top));
}

// Hide near-identical headlines (e.g. the same story on consecutive days in week view).
const STOP = new Set('the a an and or of to in on for with at by from as is are was were be has have after over into amid about says say said new more than not but will its it this that who what how why'.split(' '));
const toks = (t) => new Set(t.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !STOP.has(w)));
function dedupe(list) {
  const kept = [];
  for (const s of list) {
    const tk = toks(s.t);
    const dup = kept.some((k) => {
      let sh = 0;
      for (const w of tk) if (k.tk.has(w)) sh++;
      return sh >= 3 && sh / Math.min(tk.size, k.tk.size) >= 0.6;
    });
    if (!dup) kept.push({ s, tk });
  }
  return kept.map((k) => k.s);
}

// ---------- Sun / day-night shader ----------
function sunLatLng(date = new Date()) {
  const rad = Math.PI / 180, d = date.getTime() / 864e5 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * rad, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad, e = (23.439 - 0.00000036 * d) * rad;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / rad;
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  return [dec / rad, ((ra - gmst * 15 + 540) % 360) - 180];
}
const toVec = (lat, lng) => {
  const phi = (90 - lat) * Math.PI / 180, th = (90 - lng) * Math.PI / 180;
  return new THREE.Vector3(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
};

function makeMaterial() {
  const loader = new THREE.TextureLoader();
  return new THREE.ShaderMaterial({
    uniforms: {
      dayTex: { value: loader.load(`${IMG}earth-blue-marble.jpg`) },
      nightTex: { value: loader.load(`${IMG}earth-night.jpg`) },
      sunDir: { value: toVec(...sunLatLng()) },
      nightOn: { value: 1 },
    },
    vertexShader: `
      varying vec3 vN; varying vec2 vUv;
      void main() { vN = normalize(mat3(modelMatrix) * normal); vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D dayTex; uniform sampler2D nightTex; uniform vec3 sunDir; uniform float nightOn;
      varying vec3 vN; varying vec2 vUv;
      void main() {
        float i = dot(normalize(vN), normalize(sunDir));
        vec3 dayC = texture2D(dayTex, vUv).rgb * 0.72;
        vec3 nightC = texture2D(nightTex, vUv).rgb * 1.3 + vec3(0.012, 0.018, 0.04);
        float b = mix(1.0, smoothstep(-0.14, 0.14, i), nightOn);
        vec3 col = mix(nightC, dayC, b);
        float rim = clamp(1.0 - abs(i) / 0.14, 0.0, 1.0);
        col += vec3(0.35, 0.16, 0.05) * rim * 0.22 * nightOn;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// ---------- Globe ----------
function initGlobe() {
  material = makeMaterial();
  world = new Globe($('#globe'), { rendererConfig: { antialias: true } })
    .width(innerWidth).height(innerHeight)
    .backgroundColor('#02040a')
    .backgroundImageUrl(`${IMG}night-sky.png`)
    .globeMaterial(material)
    .showAtmosphere(true).atmosphereColor('#5aa9ff').atmosphereAltitude(0.18)
    .polygonsData(polys)
    .polygonCapColor(capColor)
    .polygonSideColor(() => 'rgba(90,169,255,0.04)')
    .polygonStrokeColor((f) => (f.key === S.sel ? 'rgba(255,255,255,0.9)' : f.isState ? 'rgba(170,205,255,0.22)' : 'rgba(170,205,255,0.32)'))
    .polygonAltitude(polyAlt)
    .polygonsTransitionDuration(250)
    .polygonLabel(polyLabel)
    .onPolygonHover((f) => { S.hover = f; world.polygonAltitude(polyAlt); $('#globe').style.cursor = f?.key ? 'pointer' : ''; })
    .onPolygonClick((f) => f.key && select(f.key))
    // Clicking open water (anything that isn't a country/state) returns to the overview.
    .onGlobeClick(() => {
      if (S.mode !== 'earth' || (!S.sel && !S.hits)) return;
      if (S.hits) clearSearch();
      overview();
    })
    .pointLat('lat').pointLng('lng').pointColor('color').pointAltitude('alt').pointRadius('r')
    .pointsMerge(false).pointsTransitionDuration(500)
    .pointLabel((d) => d.label ?? polyLabel({ key: d.key }))
    .onPointClick((d) => (d.onClick ? d.onClick() : select(d.key)))
    .ringColor((d) => (t) => `rgba(${d.rgb},${(1 - t) * d.a})`)
    .ringMaxRadius('maxR').ringPropagationSpeed('speed').ringRepeatPeriod('period').ringAltitude(0.004)
    .arcStartLat('sLat').arcStartLng('sLng').arcEndLat('eLat').arcEndLng('eLng')
    .arcColor((d) => [`rgba(${d.rgb},0.05)`, `rgba(${d.rgb},0.95)`])
    .arcStroke(0.9).arcDashLength(0.45).arcDashGap(0.25).arcDashInitialGap(() => Math.random()).arcDashAnimateTime(2600)
    .arcAltitude((d) => d.alt ?? null).arcAltitudeAutoScale(0.45)
    .arcLabel((d) => d.label ?? `<div class="tt arc-tt" style="--c:${CATS[d.cat]?.color}">
      <span class="tag">${CATS[d.cat]?.label || ''}</span>
      <b>${esc(d.title || `${d.from} ↔ ${d.to}`)}</b>
      <span>${esc(d.from)} ↔ ${esc(d.to)} · click to open</span></div>`)
    .onArcClick((d) => (d.onClick ? d.onClick() : openStory(d.home, d.id)))
    .labelLat('lat').labelLng('lng').labelText(() => '').labelSize(0).labelDotRadius('rad').labelColor('color')
    .labelAltitude(0.003).labelResolution(1).labelsTransitionDuration(0)
    .labelLabel((d) => `<div class="tt"><b>${esc(d.icon)} ${esc(d.title)}</b><span>${esc(d.kind)} · NASA EONET</span></div>`)
    .htmlElementsData([])
    .htmlAltitude((d) => d.alt ?? 0.02)
    .htmlElement(() => SP.issElement());

  world.pointOfView({ lat: 28, lng: -35, altitude: 2.4 });
  const ctr = world.controls();
  ctr.autoRotate = true;
  ctr.autoRotateSpeed = 0.35;
  let idleTimer;
  $('#globe').addEventListener('pointerdown', () => {
    ctr.autoRotate = false;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!S.sel && !S.play) ctr.autoRotate = true; }, 30000);
  });
  addEventListener('resize', () => world.width(innerWidth).height(innerHeight));
  setInterval(() => material.uniforms.sunDir.value.copy(toVec(...sunLatLng())), 60000);
}

function capColor(f) {
  if (S.mode === 'space') return f === S.hover ? 'rgba(199,125,255,0.10)' : 'rgba(120,130,255,0.012)';
  const st = S.stats.get(f.key);
  if (f.key === S.sel) return 'rgba(90,169,255,0.45)';
  if (!st) return f === S.hover ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.015)';
  const heat = Math.min(1, st.top / S.maxTop);
  const a = 0.08 + 0.32 * heat + (f === S.hover ? 0.15 : 0);
  return `rgba(${hexRgb(CATS[st.cat].color)},${a.toFixed(3)})`;
}
const polyAlt = (f) => (f === S.hover || f.key === S.sel ? 0.018 : 0.006);

function polyLabel(f) {
  const p = place(f.key);
  if (!p) return f.properties?.name ? `<div class="tt"><b>${esc(f.properties.name)}</b></div>` : '';
  const st = S.stats.get(f.key);
  const line = st ? `${st.count} ${st.count === 1 ? 'story' : 'stories'} · top: ${CATS[st.cat].label}` : 'Quiet — no major stories';
  return `<div class="tt"><b>${flag(f.key)} ${esc(p.n)}</b><span>${line}</span></div>`;
}

function pins() {
  const out = [];
  for (const [k, st] of S.stats) {
    const p = place(k);
    if (!p || p.lat == null || k === 'c:USA') continue;
    const norm = Math.sqrt(st.top / S.maxTop);
    out.push({
      key: k, lat: p.lat, lng: p.lng, color: CATS[st.cat].color,
      alt: 0.006 + 0.07 * norm, r: (p.t === 'state' ? 0.18 : 0.28) * (k === S.sel ? 1.7 : 1),
    });
  }
  return out;
}

function rings() {
  const out = [];
  if (S.layers.glow) {
    [...S.stats].filter(([k, st]) => st.hot >= 6 && place(k)?.lat != null).sort((a, b) => b[1].hot - a[1].hot).slice(0, 16)
      .forEach(([k, st]) => {
        const p = place(k), n = st.hot / S.maxTop;
        out.push({ lat: p.lat, lng: p.lng, rgb: hexRgb(CATS[st.cat === 'disaster' ? 'disaster' : 'conflict'].color), a: 0.85, maxR: 2.5 + 5 * n, speed: 1.4, period: 1500 - 500 * n });
      });
  }
  if (S.layers.quakes) {
    const days = new Set(selDays());
    S.quakes.filter((q) => days.has(q.day)).sort((a, b) => b.mag - a.mag).slice(0, 60)
      .forEach((q) => out.push({ lat: q.lat, lng: q.lng, rgb: '255,200,80', a: 0.7, maxR: Math.max(0.8, (q.mag - 4) * 2.2), speed: 1.8, period: Math.max(700, 2600 - q.mag * 250) }));
  }
  return out;
}

function arcs() {
  if (!S.layers.arcs) return [];
  const all = (S.hits ? S.idx.days : selDays()).flatMap((d) => S.idx.arcs[d] || [])
    .filter(([, , c, , id]) => S.cats.has(c) && (!S.hits || S.hitIds.has(id)));
  const seen = new Set();
  return all.sort((a, b) => b[3] - a[3]).filter(([a, b]) => { const k = [a, b].sort().join(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 45).map(([a, b, c, sc, id, title, home]) => {
      const pa = place(a), pb = place(b);
      if (pa?.lat == null || pb?.lat == null) return null;
      return { a, sLat: pa.lat, sLng: pa.lng, eLat: pb.lat, eLng: pb.lng, rgb: hexRgb(CATS[c].color), cat: c, from: pa.n, to: pb.n, id, title, home: home || a };
    }).filter(Boolean);
}

function naturalEvents() {
  if (!S.layers.events) return [];
  const days = new Set(selDays());
  return S.events.filter((e) => days.has(e.day));
}

// ---------- Render ----------
function render({ panel = true } = {}) {
  computeStats();
  const space = S.mode === 'space';
  document.body.classList.toggle('space-mode', space);
  world.polygonCapColor(capColor).polygonStrokeColor(world.polygonStrokeColor()).polygonAltitude(polyAlt);
  if (space) SP.renderGlobe();
  else world.pointsData(pins()).ringsData(rings()).arcsData(arcs()).labelsData(naturalEvents()).hexBinPointsData([]).pathsData([]).htmlElementsData([]);
  material.uniforms.nightOn.value = S.layers.night ? 1 : 0;
  const us = S.stats.get('c:USA');
  const usEl = $('#us-count');
  if (usEl) usEl.textContent = us ? us.count : '';
  $('#us-nav').classList.toggle('on', S.sel === 'c:USA');
  renderChrome();
  if (panel) { if (space && !S.hits) SP.renderPanel($('#panel-body')); else renderPanel(); }
  writeHash();
}

function renderChrome() {
  const { idx } = S;
  const totals = idx.days.map((d) => Object.values(idx.stats[d] || {}).reduce((s, cats) => s + Object.values(cats).reduce((a, [n]) => a + n, 0), 0));
  const max = Math.max(1, ...totals);
  $('#days').innerHTML = idx.days.map((d, i) => `
    <button class="day ${S.day === d ? 'on' : ''}" data-day="${d}" title="${dayLabel(d)} — ${totals[i]} stories">
      <small>${i === idx.days.length - 1 ? 'Today' : dayLabel(d, { weekday: 'short' })}</small><b>${dayLabel(d, { day: 'numeric' })}</b>
      <span class="bar"><i style="width:${(totals[i] / max) * 100}%"></i></span>
    </button>`).join('') + `<button class="day ${S.day === 'week' ? 'on' : ''}" data-day="week"><small>All</small><b>Week</b></button>`;

  const catCounts = {};
  for (const d of selDays()) for (const cats of Object.values(idx.stats[d] || {})) for (const [c, [n]] of Object.entries(cats)) catCounts[c] = (catCounts[c] || 0) + n;
  $('#cats').innerHTML = '<h4>Categories</h4>' + Object.entries(CATS).map(([k, c]) => `
    <button class="chip ${S.cats.has(k) ? '' : 'off'}" data-cat="${k}" style="--c:${c.color}" title="Click to toggle · double-click to show only this">
      <span class="sw"></span>${c.label}<span class="n">${catCounts[k] || 0}</span></button>`).join('');
  document.querySelectorAll('.modes [data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === S.mode));
  $('#layers').innerHTML = '<h4>Layers</h4>' + Object.entries(S.mode === 'space' ? SPACE_LAYERS : LAYERS).map(([k, l]) => `
    <button class="chip toggle ${S.layers[k] ? '' : 'off'}" data-layer="${k}" style="--c:${l.color}"><span class="sw"></span>${l.label}</button>`).join('');
  $('#play').classList.toggle('on', !!S.play);
  $('#play').textContent = S.play ? '❚❚' : '▶';
  $('#links').classList.toggle('on', S.layers.arcs);
  $('#links').setAttribute('aria-pressed', String(S.layers.arcs));
  $('#links span').textContent = S.layers.arcs ? 'Links on' : 'Links off';
}

function card(s) {
  const c = CATS[s.c] || CATS.general;
  const others = [...new Set([...(s.p || []), ...(s.x || [])])]
    .filter((k) => k !== S.sel && place(k) && !(k === 'x:SPACE' && S.mode === 'space')).slice(0, 3);
  const srcs = s.src.map(([n, u]) => (u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a>` : `<span>${esc(n)}</span>`)).join('');
  const more = s.ns > s.src.length ? `<span class="more">+${s.ns - s.src.length} more</span>` : '';
  return `<article class="story" data-story="${s.id}" style="--c:${c.color}">
    ${s.img ? `<img class="thumb" src="${esc(s.img)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
    <div class="s-meta"><span class="tag">${c.label}${s.k === 'college' ? ' · College' : ''}</span><span>${timeLabel(s.ts)}</span>${s.sc >= 14 ? '<span class="major">Major</span>' : ''}</div>
    <a class="hl" href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)}</a>
    ${s.s ? `<p>${esc(s.s)}</p>` : ''}
    <div class="srcs">${srcs}${more}</div>
    ${others.length ? `<div class="also">${others.map((k) => (k === 'x:SPACE' ? '<button data-mode="space">🚀 Space</button>' : `<button data-place="${k}">${flag(k)} ${esc(place(k).n)}</button>`)).join('')}</div>` : ''}
  </article>`;
}

function storyList(stories, group = S.day === 'week') {
  stories = dedupe(stories);
  if (!stories.length) return '<div class="empty">No major stories from trusted outlets for this period and filter.</div>';
  if (!group) return stories.map(card).join('');
  let html = '', cur = null;
  for (const s of stories) {
    if (s.d !== cur) { cur = s.d; html += `<div class="day-head">${dayLabel(cur)}</div>`; }
    html += card(s);
  }
  return html;
}

function searchView() {
  const raw = $('#q').value.trim();
  const hits = S.hits.filter((s) => S.cats.has(s.c));
  const shown = dedupe(hits);
  const places = Object.entries(S.idx.places).filter(([, p]) => p.n.toLowerCase().includes(S.q)).slice(0, 8);
  return `
    <div class="p-head">
      <div class="p-top"><span class="eyebrow">Search · past 7 days</span><button class="close" data-action="clear-search" aria-label="Clear search">✕</button></div>
      <h2>“${esc(raw)}”</h2>
      <div class="sub">${shown.length} ${shown.length === 1 ? 'story' : 'stories'}</div>
    </div>
    ${places.length ? `<h3>Places</h3><div class="hotspots">${places.map(([k, p]) => `<button class="place-chip" data-place="${k}" style="--c:${CATS[S.stats.get(k)?.cat || 'general'].color}"><span class="dot"></span>${flag(k)} ${esc(p.n)}</button>`).join('')}</div>` : ''}
    <h3>Stories</h3>${storyList(shown.slice(0, 60), true)}`;
}

async function runSearch() {
  const q = $('#q').value.trim().toLowerCase();
  S.q = q;
  if (q.length < 2) { clearSearch(); return render(); }
  const all = (await Promise.all(S.idx.days.map(loadDay))).flat();
  if (S.q !== q) return;
  const words = q.split(/\s+/);
  S.hits = all.filter((s) => {
    const names = [...s.p, ...(s.x || [])].map((k) => place(k)?.n || '').join(' ');
    const hay = `${s.t} ${s.s} ${s.src.map((x) => x[0]).join(' ')} ${names} ${CATS[s.c]?.label || ''}${s.k === 'college' ? ' college' : ''}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  }).sort((a, b) => (b.d > a.d ? 1 : b.d < a.d ? -1 : b.sc - a.sc));
  S.hitIds = new Set(S.hits.map((s) => s.id));
  document.body.classList.add('search-dim');
  render();
}

function clearSearch() {
  $('#q').value = '';
  S.q = '';
  S.hits = S.hitIds = null;
  document.body.classList.remove('search-dim');
}

async function renderPanel() {
  const token = ++S.panelToken;
  const body = $('#panel-body');
  if (S.hits) { body.innerHTML = searchView(); body.scrollTop = 0; return; }
  const stories = (await Promise.all(selDays().map(loadDay))).flat().filter((s) => S.cats.has(s.c));
  if (token !== S.panelToken) return;
  const byRecency = (a, b) => (b.d > a.d ? 1 : b.d < a.d ? -1 : b.sc - a.sc);

  if (!S.sel) {
    const topIds = new Set(selDays().flatMap((d) => S.idx.top[d] || []));
    const top = stories.filter((s) => topIds.has(s.id)).sort((a, b) => b.sc - a.sc).slice(0, S.day === 'week' ? 15 : 12);
    const hot = [...S.stats].filter(([k]) => place(k)?.lat != null).sort((a, b) => b[1].top - a[1].top).slice(0, 12);
    const quakes = S.quakes.filter((q) => selDays().includes(q.day) && q.mag >= 5.5).sort((a, b) => b.mag - a.mag).slice(0, 6);
    const ev = naturalEventsSummary();
    body.innerHTML = `
      <div class="p-head"><div class="eyebrow">${periodLabel()}</div><h2>${S.day === 'week' ? 'The week on Earth' : 'What’s happening'}</h2>
      <div class="sub">Click any country, state, or pin. ${S.idx.stories.toLocaleString()} stories this week from ${S.idx.outlets} trusted outlets.</div></div>
      ${SP.teaser()}
      <h3>Hotspots</h3>
      <div class="hotspots">${hot.map(([k, st]) => `<button class="place-chip" data-place="${k}" style="--c:${CATS[st.cat].color}"><span class="dot"></span>${flag(k)} ${esc(place(k).n)}</button>`).join('')}</div>
      <h3>Top stories</h3>${storyList(top, false)}
      ${quakes.length ? `<h3>Significant earthquakes</h3>${quakes.map((q) => `<a class="list-row" href="${esc(q.url)}" target="_blank" rel="noopener"><span class="mag">M${q.mag.toFixed(1)}</span><span>${esc(q.place)}<small>${timeLabel(q.time)} · USGS</small></span></a>`).join('')}` : ''}
      ${ev ? `<h3>Natural events</h3>${ev}` : ''}
      <div class="foot">Sources: AP, Reuters, BBC, NPR, PBS, The Guardian, Al Jazeera, DW, France 24, UN News, ESPN, NASA, and vetted state outlets. Stories are clustered across outlets and ranked by how many trusted sources cover them. Live layers from USGS and NASA EONET. College sports limited to AP Top 25 football and men’s basketball (via ESPN).<br>Updated ${new Date(S.idx.generated).toLocaleString()}.</div>`;
    return;
  }

  const k = S.sel, p = place(k);
  const mine = stories.filter((s) => s.p.includes(k)).sort(byRecency);
  const st = S.stats.get(k);
  const type = k === 'c:USA' ? 'National' : p.t === 'state' ? 'U.S. State' : 'Country';
  let extra = '';
  if (k === 'c:USA') {
    const states = Object.entries(S.idx.places).filter(([, v]) => v.t === 'state')
      .map(([sk, v]) => [sk, v, S.stats.get(sk)?.count || 0]).sort((a, b) => b[2] - a[2] || a[1].n.localeCompare(b[1].n));
    extra = `<h3>States</h3><div class="states">${states.map(([sk, v, n]) => `<button data-place="${sk}" class="${n ? '' : 'zero'}" title="${esc(v.n)}">${v.ab}<b>${n || ''}</b></button>`).join('')}</div>`;
  }
  body.innerHTML = `
    <div class="p-head">
      <div class="p-top">
        ${p.t === 'state' ? '<button class="back" data-place="c:USA">← U.S. National</button>' : '<button class="back" data-action="overview">← Overview</button>'}
        <button class="close" data-action="overview" aria-label="Close">✕</button>
      </div>
      <div class="eyebrow">${type} · ${periodLabel()}</div>
      <h2>${flag(k)} ${esc(k === 'c:USA' ? 'United States' : p.n)}</h2>
      <div class="sub">${st ? `${st.count} ${st.count === 1 ? 'story' : 'stories'}` : 'Quiet'}</div>
    </div>
    ${k === 'c:USA' ? '<h3>National news</h3>' : ''}${storyList(mine)}${extra}`;
  body.scrollTop = 0;
  // Opened from a story link: scroll to that story and flash it.
  const focused = S.focus && body.querySelector(`[data-story="${S.focus}"]`);
  S.focus = null;
  if (focused) {
    focused.scrollIntoView({ block: 'center' });
    focused.classList.add('focus');
  }
}

function naturalEventsSummary() {
  const ev = naturalEvents();
  if (!ev.length) return '';
  const counts = {};
  ev.forEach((e) => { counts[e.kind] = (counts[e.kind] || 0) + 1; });
  const notable = [...new Map(ev.filter((e) => e.kind !== 'Wildfire').map((e) => [e.title, e])).values()].slice(0, 6);
  return `<div class="sub" style="color:var(--muted);font-size:13px">${Object.entries(counts).map(([k, n]) => `${n} ${k.toLowerCase()}${n > 1 ? 's' : ''}`).join(' · ')}</div>
    ${notable.map((e) => `<div class="list-row"><span class="mag" style="color:${e.color}">${e.icon}</span><span>${esc(e.title)}<small>${e.kind} · ${dayLabel(e.day, { month: 'short', day: 'numeric' })}</small></span></div>`).join('')}`;
}

// ---------- Interaction ----------
function select(key, { fly = true } = {}) {
  if (!place(key)) return;
  if (place(key).t === 'space') return setMode('space');
  if (S.hits) clearSearch();
  if (S.mode === 'space') { S.mode = 'earth'; SP.exit(); }
  S.sel = key;
  world.controls().autoRotate = false;
  if (fly) {
    const p = place(key);
    const alt = key === 'c:USA' ? 1.15 : p.t === 'state' ? 0.75 : 1.5;
    const lat = key === 'c:USA' ? 38 : p.lat;
    world.pointOfView({ lat: lat - (innerWidth < 640 ? 8 * alt : 0), lng: p.lng + (innerWidth > 900 ? 12 * alt : 0), altitude: alt }, 1200);
  }
  $('#panel').classList.remove('collapsed');
  render();
}

function overview() {
  S.sel = null;
  world.pointOfView({ altitude: 2.4 }, 1000);
  render();
}

function openStory(key, id) {
  S.focus = id;
  select(key);
}

function toggleLinks() {
  S.layers.arcs = !S.layers.arcs;
  try { localStorage.setItem(PREF_LINKS, S.layers.arcs ? 'on' : 'off'); } catch {}
  render({ panel: false });
}

function setMode(mode) {
  if (S.mode === mode) return;
  S.mode = mode;
  if (mode === 'space') {
    S.sel = null;
    world.controls().autoRotate = true;
    world.pointOfView({ altitude: 3.1 }, 1200);
    $('#panel').classList.remove('collapsed');
    render();
    SP.enter();
  } else {
    SP.exit();
    world.pointOfView({ altitude: 2.4 }, 1000);
    render();
  }
}

function setDay(d) {
  S.day = d;
  render();
}

function togglePlay() {
  if (S.play) { clearInterval(S.play); S.play = null; renderChrome(); return; }
  const days = S.idx.days;
  let i = S.day === 'week' || S.day === days.at(-1) ? 0 : days.indexOf(S.day) + 1;
  const step = () => {
    setDay(days[i]);
    i++;
    if (i >= days.length) { clearInterval(S.play); S.play = null; renderChrome(); }
  };
  S.play = setInterval(step, 2400);
  step();
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-day],[data-cat],[data-layer],[data-place],[data-action],[data-mode],[data-sp],#play,#links,#grip');
  if (!t) return;
  if (t.id === 'play') return togglePlay();
  if (t.id === 'links' || t.dataset.layer === 'arcs') return toggleLinks();
  if (t.id === 'grip') return $('#panel').classList.toggle('collapsed');
  if (t.dataset.day) { if (S.play) togglePlay(); return setDay(t.dataset.day); }
  if (t.dataset.cat) {
    const c = t.dataset.cat;
    if (e.detail === 2) { S.cats = new Set([c]); } else if (S.cats.has(c)) { S.cats.delete(c); } else { S.cats.add(c); }
    if (!S.cats.size) S.cats = new Set(Object.keys(CATS));
    return render();
  }
  if (t.dataset.layer) { S.layers[t.dataset.layer] = !S.layers[t.dataset.layer]; return render({ panel: false }); }
  if (t.dataset.mode) return setMode(t.dataset.mode);
  if (t.dataset.sp) return SP.handle(t.dataset.sp);
  if (t.dataset.place) return select(t.dataset.place);
  if (t.dataset.action === 'overview') return overview();
  if (t.dataset.action === 'clear-search') { clearSearch(); return render(); }
});

let searchTimer;
$('#q').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 180); });

document.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input,textarea')) {
    if (e.key === 'Escape') { clearSearch(); e.target.blur(); render(); }
    return;
  }
  if (e.key === '/') { e.preventDefault(); $('#q').focus(); return; }
  const days = [...S.idx.days, 'week'];
  const i = days.indexOf(S.day);
  if (e.key === 'ArrowLeft' && i > 0) setDay(days[i - 1]);
  else if (e.key === 'ArrowRight' && i < days.length - 1) setDay(days[i + 1]);
  else if (e.key === 'Escape' && S.mode === 'space') setMode('earth');
  else if (e.key === 'Escape' && S.sel) overview();
  else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  else if (e.key.toLowerCase() === 'l' && S.mode === 'earth') toggleLinks();
});

function writeHash() {
  const h = new URLSearchParams();
  if (S.day !== S.idx.days.at(-1)) h.set('day', S.day);
  if (S.sel) h.set('place', S.sel);
  if (S.mode === 'space') h.set('mode', 'space');
  history.replaceState(null, '', h.toString() ? `#${h}` : location.pathname);
}
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  const d = h.get('day');
  if (d && (d === 'week' || S.idx.days.includes(d))) S.day = d;
  const p = h.get('place');
  if (h.get('mode') === 'space' && !p) return 'x:SPACE';
  return p && place(p) ? p : null;
}

// ---------- Live layers ----------
async function loadLive() {
  const [q, ev] = await Promise.allSettled([getJSON(USGS), getJSON(EONET)]);
  if (q.status === 'fulfilled') {
    S.quakes = q.value.features.map((f) => ({
      mag: f.properties.mag, place: f.properties.place, time: f.properties.time, url: f.properties.url,
      lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], day: etDay(f.properties.time),
    }));
  }
  if (ev.status === 'fulfilled') {
    const KIND = { wildfires: ['Wildfire', '🔥', '#ff7a2f', 0.16], severeStorms: ['Storm', '🌀', '#6fd3ff', 0.35], volcanoes: ['Volcano', '🌋', '#ff3b3b', 0.4] };
    const seen = new Set();
    for (const e of ev.value.events) {
      const [kind, icon, color, rad] = KIND[e.categories[0].id] || [];
      if (!kind) continue;
      for (const g of e.geometry) {
        if (g.type !== 'Point') continue;
        const day = etDay(Date.parse(g.date));
        const key = `${e.id}|${day}`;
        if (seen.has(key)) continue;
        seen.add(key);
        S.events.push({ title: e.title, kind, icon, color, rad, day, lng: g.coordinates[0], lat: g.coordinates[1] });
      }
    }
  }
  render({ panel: !S.sel });
}

// ---------- Boot ----------
async function main() {
  const [idx, wt, ut] = await Promise.all([getJSON('data/index.json'), getJSON(WORLD_TOPO), getJSON(US_TOPO)]);
  S.idx = idx;
  S.day = idx.days.at(-1);
  const countries = feature(wt, wt.objects.countries).features
    .filter((f) => f.id !== '840' && f.properties.name !== 'Antarctica')
    .map((f) => Object.assign(f, { key: idx.poly[f.id] }));
  const states = feature(ut, ut.objects.states).features
    .map((f) => Object.assign(f, { key: idx.poly[`us${f.id}`], isState: true }));
  polys = [...countries, ...states];

  const gen = new Date(idx.generated);
  $('#meta').textContent = `Updated ${gen.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${gen.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · ${idx.stories.toLocaleString()} stories`;

  initGlobe();
  SP = createSpace({ world, S, esc, timeLabel, dayLabel, selDays, periodLabel, storyList, loadDay, polys, render });
  const initial = readHash();
  if (innerWidth < 640) $('#panel').classList.add('collapsed');
  if (initial) select(initial); else render();
  setTimeout(() => $('#loading').classList.add('done'), 600);
  loadLive();
  SP.load().then(() => { if (S.mode === 'earth' && !S.sel && !S.hits) renderPanel(); });
}

main().catch((err) => {
  console.error(err);
  $('#loading').textContent = 'Could not load data. Try refreshing.';
});
