// Discoveries (Space mode): newly confirmed exoplanets from the NASA Exoplanet Archive, plus the week's
// trusted news about black holes, stellar extremes, comets and interstellar visitors, and galaxies.
const JUP_R = 11.21, JUP_M = 317.8; // Jupiter in Earth radii / masses
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const ageDays = (d) => (Date.now() - Date.parse(`${d}T12:00:00Z`)) / 864e5;

const TABS = {
  planets: {
    icon: '🪐', label: 'New worlds', noun: 'exoplanet',
    intro: 'Planets orbiting other stars, newly confirmed and added to NASA’s Exoplanet Archive — plus the week’s exoplanet research.',
    rx: /\b(exoplanets?|super-Earths?|sub-Neptunes?|hot Jupiters?|rogue planets?|habitable zone|alien worlds?|planets? (orbiting|around|beyond)|TRAPPIST-1|Proxima b)\b/i,
  },
  blackholes: {
    icon: '🕳️', label: 'Black holes', noun: 'black hole',
    intro: 'Regions where gravity is so strong that not even light escapes — from merging stellar remnants to the giants at the centers of galaxies.',
    rx: /\b(black holes?|quasars?|event horizons?|Sagittarius A)/i,
  },
  stellar: {
    icon: '💥', label: 'Stellar extremes', noun: 'supernova & pulsar',
    intro: 'Stars at their most violent: supernovae, neutron stars, pulsars, magnetars, gamma-ray bursts and gravitational waves.',
    rx: /\b(supernovae?|kilonovae?|hypernovae?|neutron stars?|pulsars?|magnetars?|gamma-ray bursts?|gravitational waves?|fast radio bursts?|white dwarfs?|dying stars?)\b/i,
  },
  visitors: {
    icon: '☄️', label: 'Comets & visitors', noun: 'comet & visitor',
    intro: 'Comets, dwarf planets and objects from the edge of the solar system — or from beyond it.',
    rx: /\b(comets?|interstellar (objects?|comets?|visitors?)|3I\/ATLAS|Oumuamua|dwarf planets?|Kuiper Belt|Oort Cloud|trans-Neptunian)\b/i,
  },
  cosmos: {
    icon: '🌌', label: 'Galaxies & cosmos', noun: 'galaxy & cosmos',
    intro: 'Galaxies, nebulae, dark matter, dark energy and the early universe.',
    rx: /\b(galax(y|ies)|nebulae?|dark matter|dark energy|cosmic dawn|Big Bang|early universe|star clusters?|cosmic microwave)\b/i,
  },
};
const TAB_ORDER = ['planets', 'blackholes', 'stellar', 'visitors', 'cosmos'];
// First match wins, so a black hole in a distant galaxy files under black holes.
const MATCH_ORDER = ['blackholes', 'stellar', 'planets', 'visitors', 'cosmos'];

const PAL = {
  scorching: ['#fff0c2', '#ff7a2e', '#6e1606'], hot: ['#ffe0ad', '#e08a45', '#47220b'], warm: ['#f5e4bd', '#c19a62', '#382815'],
  temperate: ['#dcf6ff', '#3e9bd4', '#0b2946'], frozen: ['#f2f8ff', '#8db9dc', '#15304a'], unknown: ['#e6deff', '#8b7ce0', '#1b1546'],
};
const FOUND = {
  Transit: 'It was spotted by the slight dip in starlight as it crossed in front of its star',
  'Radial Velocity': 'It was detected by the tiny wobble its gravity gives its star',
  Microlensing: 'It showed up when its star briefly acted as a lens, magnifying light from a more distant star',
  Imaging: 'It was photographed directly',
  'Transit Timing Variations': 'It was inferred from the way its pull shifts another planet’s transits',
  Astrometry: 'It was found by the tiny side-to-side shift its gravity causes in its star’s position',
  'Eclipse Timing Variations': 'It was inferred from shifts in the timing of its stars’ eclipses',
  'Orbital Brightness Modulation': 'It was found from the rhythmic changes in brightness as it orbits',
  'Pulsar Timing': 'It was found from tiny delays in the pulses of the pulsar it orbits',
};
const temp = (t) => `${fmt(t - 273.15)} °C / ${fmt((t - 273.15) * 1.8 + 32)} °F`;
const CLIMATE = {
  scorching: (t) => `At an estimated ${temp(t)}, it is hot enough to melt lead and aluminum.`,
  hot: (t) => `At an estimated ${temp(t)}, it is far past the boiling point of water.`,
  warm: (t) => `At an estimated ${temp(t)}, it is hotter than Earth’s hottest recorded day.`,
  temperate: (t) => `Its equilibrium temperature, about ${temp(t)}, is in the same broad range as Earth’s (−18 °C by that measure, before the greenhouse effect) — whether it could hold liquid water depends on its atmosphere.`,
  frozen: (t) => `At an estimated ${temp(t)}, it is colder than the coldest temperature ever recorded in Antarctica.`,
};

const article = (w) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
const lowerKind = (k) => k.replace(/^(Super|Sub|Hot|Gas|Planet)/, (w) => w.toLowerCase());
function yearText(per) {
  if (per < 2) return `${fmt(per * 24)} hours`;
  if (per < 730) return `${per < 10 ? per.toFixed(1) : fmt(per)} days`;
  return `${(per / 365.25).toFixed(1)} Earth years`;
}

function describe(p) {
  const { r, m, t } = p;
  const estR = r ?? (m == null ? null : m < 120 ? Math.max(0.6, m ** 0.55) : JUP_R);
  let kind = null;
  if (r != null) kind = r < 1.25 ? 'Earth-size world' : r < 2 ? 'Super-Earth' : r < 4 ? 'Sub-Neptune' : r < 6.5 ? 'Neptune-like planet' : null;
  else if (m != null) kind = m < 2 ? 'Earth-mass world' : m < 10 ? 'Super-Earth' : m < 60 ? 'Neptune-like planet' : null;
  const giant = !kind && (r != null || m != null);
  if (giant) kind = m != null && m >= 2 * JUP_M ? 'Super-Jupiter' : t >= 1000 && p.per != null && p.per < 10 ? 'Hot Jupiter' : 'Gas giant';
  kind ||= 'Planet';
  const climate = t == null ? null : t >= 1000 ? 'scorching' : t >= 500 ? 'hot' : t >= 335 ? 'warm' : t >= 175 ? 'temperate' : 'frozen';
  const small = r != null ? r < 2 : m != null && m < 10;
  const near = p.ly != null && p.ly < 60;
  const fresh = ageDays(p.released) <= 7;
  const score = (climate === 'temperate' ? 4 : 0) + (small ? 3 : 0) + (near ? 3 : p.ly != null && p.ly < 200 ? 1 : 0)
    + (p.sibs >= 3 ? 1 : 0) + (fresh ? 1.5 : 0);
  const badges = [fresh && 'New this week', climate === 'temperate' && 'Temperate', small && 'Small, maybe rocky',
    near && `Nearby · ${fmt(p.ly)} ly`, p.sibs >= 3 && `${p.sibs}-planet system`].filter(Boolean);
  return { estR, kind, giant, climate, small, fresh, score, badges };
}

const colors = (p) => (p.small && p.climate === 'temperate' ? ['#e2ffe9', '#39a89c', '#0b3040'] : PAL[p.climate || 'unknown']);
function orb(p, min, max) {
  const [a, b, c] = colors(p);
  const s = p.estR == null ? (min + max) / 2 : min + (max - min) * Math.min(1, Math.log(Math.max(1, p.estR)) / Math.log(20));
  return `<span class="orb${p.giant ? ' giant' : ''}" style="--s:${s.toFixed(0)}px;--c1:${a};--c2:${b};--c3:${c}" aria-hidden="true"></span>`;
}

function blurbParts(p) {
  const s = [`${p.name} is ${article(p.kind)} ${lowerKind(p.kind)} orbiting the star ${p.host}${p.ly != null ? `, about ${fmt(p.ly)} light-years from Earth` : ''}.`];
  if (p.per != null) s.push(`A year there lasts ${yearText(p.per)}${p.a != null && p.a < 0.39 ? ' — it orbits closer to its star than Mercury does to the Sun' : ''}.`);
  if (p.t != null) s.push(CLIMATE[p.climate](p.t));
  s.push(`${FOUND[p.method] || `It was found by ${String(p.method).toLowerCase()}`}.`);
  if (p.facility) s.push(`Discovered with ${/^Multiple/.test(p.facility) ? p.facility.toLowerCase() : p.facility}.`);
  if (p.sibs > 1) s.push(`Its star has ${p.sibs} known planets.`);
  return s;
}

function tagStories(all) {
  const out = Object.fromEntries(TAB_ORDER.map((k) => [k, []]));
  for (const s of all) {
    if (s.c !== 'space' && s.c !== 'science' && !s.p.includes('x:SPACE')) continue;
    const text = `${s.t} ${s.s || ''}`;
    const k = MATCH_ORDER.find((x) => TABS[x].rx.test(text));
    if (k) out[k].push(s);
  }
  for (const k of TAB_ORDER) out[k].sort((a, b) => (b.d > a.d ? 1 : b.d < a.d ? -1 : b.sc - a.sc));
  return out;
}

export function createDiscoveries({ S, esc, dayLabel, loadDay, storyList, inertOthers, getData }) {
  const modal = document.getElementById('disc');
  const tabsEl = document.getElementById('disc-tabs');
  const body = document.getElementById('disc-body');
  const toastEl = document.getElementById('disc-toast');
  let tab = 'planets', open = null, news = null, newsLoading = null, src, cache = [], lastFocus = null, toastTimer = null;

  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  function planets() {
    const list = getData()?.planets;
    if (list !== src) { src = list; cache = (list || []).map((p, i) => ({ ...p, i, ...describe(p) })); }
    return cache;
  }
  const byScore = (a, b) => b.score - a.score || (b.released > a.released ? 1 : -1);
  const count = (k) => (k === 'planets' ? planets().length : news?.[k]?.length || 0);
  const ready = () => (newsLoading ||= Promise.all(S.idx.days.map(loadDay))
    .then((days) => { news = tagStories(days.flat()); }, () => { news = tagStories([]); }));

  const badges = (p) => (p.badges.length ? `<span class="pl-badges">${p.badges.map((b) => `<i>${esc(b)}</i>`).join('')}</span>` : '');
  const kindLine = (p) => `<span class="pl-kind">${esc(p.kind)}${p.climate ? ` · ${p.climate}` : ''}</span>`;
  const source = '<p class="note disc-src">Planets: NASA Exoplanet Archive (Caltech/IPAC), updated weekly. News: trusted outlets, sorted by subject.</p>';

  // ---------- Space panel strip ----------
  function strip() {
    const ps = planets();
    const el = document.getElementById('disc-count');
    const total = ps.length + TAB_ORDER.slice(1).reduce((s, k) => s + count(k), 0);
    if (el) el.textContent = total || '';
    if (!total) return '';
    const top = [...ps].sort(byScore);
    const fresh = ps.filter((p) => p.fresh).length;
    const since = ps.map((p) => p.released).sort()[0];
    const f = top[0];
    return `<section class="disc-strip" aria-label="Discoveries">
      ${ps.length ? `<button class="disc-hero" data-sp="disc:tab:planets">
        <span class="orbs">${top.slice(0, 4).map((p) => orb(p, 22, 36)).join('')}</span>
        <span class="dh-body"><span class="eyebrow">🪐 New worlds</span>
          <b>${fresh ? `${fresh} new planet${fresh === 1 ? '' : 's'} added this week` : `${ps.length} planets confirmed recently`}</b>
          <small>${ps.length} since ${dayLabel(since, { month: 'short', day: 'numeric' })} · NASA Exoplanet Archive</small></span>
        <span class="go" aria-hidden="true">→</span></button>
      <button class="disc-feature" data-sp="disc:planet:${f.i}"><span class="eyebrow">★ Standout</span> <b>${esc(f.name)}</b> —
        ${esc(lowerKind(f.kind))}${f.climate ? `, ${f.climate}` : ''}${f.ly != null ? `, ${fmt(f.ly)} light-years away` : ''}</button>` : ''}
      <div class="disc-chips">${TAB_ORDER.slice(1).map((k) => `<button data-sp="disc:tab:${k}" class="${count(k) ? '' : 'zero'}">${TABS[k].icon} ${TABS[k].label} <b>${count(k)}</b></button>`).join('')}</div>
    </section>`;
  }

  // ---------- Pop-up views ----------
  function newsBlock(k, limit, heading) {
    const list = news?.[k] || [];
    if (!list.length) return heading ? '' : `<div class="empty">No ${TABS[k].noun} stories from trusted outlets this week. Check back after the next refresh.</div>`;
    // Ungrouped: each card already carries its date, and per-day headings strand single cards in the grid.
    return `${heading ? `<h3>${heading}</h3>` : ''}<div class="disc-news">${storyList(list.slice(0, limit), false)}</div>`;
  }

  const planetCard = (p) => `<button class="planet" data-sp="disc:planet:${p.i}">
    <span class="orb-slot">${orb(p, 24, 54)}</span>
    <span class="pl-body"><b>${esc(p.name)}</b>${kindLine(p)}
      <small>${[p.ly != null && `${fmt(p.ly)} ly away`, p.per != null && `orbits in ${yearText(p.per)}`, p.method].filter(Boolean).map(esc).join(' · ')}</small>
      ${badges(p)}</span></button>`;

  function planetsView() {
    const ps = planets();
    if (!ps.length) return `<p class="disc-intro">${TABS.planets.intro}</p><div class="empty">NASA’s Exoplanet Archive couldn’t be reached. New worlds will appear after the next refresh.</div>${newsBlock('planets', 6, 'In the news this week')}`;
    const f = [...ps].sort(byScore)[0];
    const groups = new Map();
    for (const p of [...ps].sort((a, b) => (b.released > a.released ? 1 : b.released < a.released ? -1 : b.score - a.score))) {
      (groups.get(p.released) || groups.set(p.released, []).get(p.released)).push(p);
    }
    return `<p class="disc-intro">${TABS.planets.intro}</p>
      <button class="pl-feature" data-sp="disc:planet:${f.i}">
        <span class="orb-slot">${orb(f, 72, 108)}</span>
        <span class="pl-body"><span class="eyebrow">★ Standout discovery</span><b>${esc(f.name)}</b>${kindLine(f)}
          <small>${esc(blurbParts(f).slice(0, 2).join(' '))}</small>${badges(f)}</span></button>
      ${newsBlock('planets', 4, 'In the news this week')}
      ${[...groups].map(([d, list]) => `<h3>Added ${dayLabel(d, { month: 'short', day: 'numeric' })} · ${list.length} planet${list.length === 1 ? '' : 's'}</h3>
        <div class="planet-grid">${list.map(planetCard).join('')}</div>`).join('')}
      ${source}`;
  }

  function stats(p) {
    const least = p.method === 'Radial Velocity' ? 'at least ' : '';
    const rows = [
      ['Size', p.r != null ? `${p.r.toFixed(1)} × Earth` : '—', p.r != null && p.r >= 6 ? `${(p.r / JUP_R).toFixed(2)} × Jupiter` : p.r != null ? 'in width' : ''],
      ['Mass', p.m == null ? '—' : p.m >= JUP_M / 2 ? `${(p.m / JUP_M).toFixed(1)} × Jupiter` : `${p.m < 10 ? p.m.toFixed(1) : fmt(p.m)} × Earth`, p.m != null && least ? 'minimum mass' : ''],
      ['Year length', p.per != null ? yearText(p.per) : '—', ''],
      ['Temperature', p.t != null ? `${fmt(p.t - 273.15)} °C` : '—', p.t != null ? `${fmt((p.t - 273.15) * 1.8 + 32)} °F · equilibrium` : ''],
      ['From its star', p.a != null ? `${p.a < 0.1 ? p.a.toFixed(3) : p.a.toFixed(2)} AU` : '—', p.a != null ? 'Earth–Sun = 1 AU' : ''],
      ['From Earth', p.ly != null ? `${fmt(p.ly)} ly` : '—', p.ly != null ? 'light-years' : ''],
    ];
    return rows.map(([k, v, sub]) => `<div><small>${k}</small><b>${esc(v)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`).join('');
  }

  function sizeCompare(p) {
    const r = p.r ?? p.estR;
    if (r == null) return '<p class="note">Size unknown.</p>';
    const all = [{ n: 'Earth', r: 1, col: '#3e9bd4' }, { n: 'Neptune', r: 3.88, col: '#5b7bd6' }, { n: 'Jupiter', r: JUP_R, col: '#c9a26b' },
      { n: 'This planet', r, col: colors(p)[1], me: true }].sort((a, b) => a.r - b.r);
    const R = 54, k = R / Math.max(...all.map((b) => b.r));
    let x = 0;
    for (const b of all) {
      b.pr = Math.max(2, b.r * k);
      const slot = Math.max(b.pr, 46);
      b.cx = x + slot;
      x += slot * 2 + 8;
    }
    const est = p.r == null;
    return `<div class="size-cmp"><svg viewBox="0 0 ${x.toFixed(0)} ${R * 2 + 30}" role="img" aria-label="${esc(`${p.name} compared with Earth, Neptune and Jupiter`)}">
      ${all.map((b) => `<circle cx="${b.cx.toFixed(1)}" cy="${R}" r="${b.pr.toFixed(1)}" fill="${b.col}" ${b.me ? `stroke="#fff" stroke-width="1.2"${est ? ' stroke-dasharray="3 3" fill-opacity=".55"' : ''}` : 'fill-opacity=".8"'}/>
        <text x="${b.cx.toFixed(1)}" y="${R * 2 + 22}" text-anchor="middle"${b.me ? ' class="me"' : ''}>${b.n}</text>`).join('')}
    </svg>${est && p.method !== 'Microlensing' ? '<p class="note">Size estimated from mass — this discovery method doesn’t measure width.</p>' : ''}</div>`;
  }

  function detailView(p) {
    const pub = p.pub ? new Date(`${p.pub.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : p.year;
    return `<article class="pl-detail">
      <button class="back" data-sp="disc:back">← All new worlds</button>
      <div class="pl-hero">
        <span class="orb-slot big">${orb(p, 100, 150)}</span>
        <div><h2>${esc(p.name)}</h2>
          <div class="sub">${esc(p.kind)}${p.climate ? ` · ${p.climate}` : ''} · orbits the star ${esc(p.host)}${p.spec ? ` · spectral type ${esc(p.spec)}` : ''}</div>${badges(p)}</div>
      </div>
      <p class="pl-blurb">${esc(blurbParts(p).join(' '))}</p>
      <div class="pl-stats">${stats(p)}</div>
      ${p.method === 'Microlensing' ? '<p class="note">Microlensing reveals a planet’s mass and distance, but not its width, orbit period or temperature.</p>' : ''}
      <h3>Size compared</h3>${sizeCompare(p)}
      <h3>Discovery</h3>
      <p class="pl-found">${esc(p.method)}${p.facility ? ` · ${esc(p.facility)}` : ''} · published ${esc(String(pub))} · added to NASA’s archive ${dayLabel(p.released, { month: 'short', day: 'numeric' })}</p>
      <div class="pl-links">
        <a href="https://exoplanetarchive.ipac.caltech.edu/overview/${encodeURIComponent(p.name)}" target="_blank" rel="noopener">NASA Exoplanet Archive ↗</a>
        ${p.ref ? `<a href="${esc(p.ref)}" target="_blank" rel="noopener">Discovery paper${p.refName ? ` · ${esc(p.refName)}` : ''} ↗</a>` : ''}
      </div>
    </article>`;
  }

  function draw() {
    const refocus = tabsEl.contains(document.activeElement);
    tabsEl.innerHTML = TAB_ORDER.map((k) => `<button data-sp="disc:tab:${k}" aria-pressed="${k === tab && open == null}" class="${k === tab ? 'on' : ''}">${TABS[k].icon} ${TABS[k].label} <b>${count(k)}</b></button>`).join('');
    const p = open != null ? planets()[open] : null;
    body.innerHTML = p ? detailView(p)
      : tab === 'planets' ? planetsView()
      : `<p class="disc-intro">${TABS[tab].intro}</p>${newsBlock(tab, 40)}${source}`;
    body.scrollTop = 0;
    if (refocus) tabsEl.querySelector('.on')?.focus({ preventScroll: true });
  }

  async function show(t, planet = null) {
    hideToast();
    tab = TABS[t] ? t : 'planets';
    open = planet != null && planets()[planet] ? planet : null;
    const opening = modal.hidden;
    if (opening) {
      lastFocus = document.activeElement;
      modal.hidden = false;
      inertOthers(modal, true);
      document.body.classList.add('disc-open');
    }
    if (!news) {
      body.innerHTML = '<div class="empty">Gathering discoveries…</div>';
      await ready();
      if (modal.hidden) return;
    }
    draw();
    if (opening) modal.querySelector('.disc-close').focus({ preventScroll: true });
    else if (open != null) body.querySelector('.back')?.focus({ preventScroll: true });
  }

  function close() {
    if (modal.hidden) return;
    modal.hidden = true;
    inertOthers(modal, false);
    open = null;
    document.body.classList.remove('disc-open');
    lastFocus?.focus?.({ preventScroll: true });
  }

  function back() {
    const prev = open;
    open = null;
    draw();
    const card = body.querySelector(`[data-sp="disc:planet:${prev}"]:not(.pl-feature)`);
    card?.focus({ preventScroll: true });
    card?.scrollIntoView({ block: 'center' });
  }

  function handle(action) {
    const [, cmd, arg] = action.split(':');
    if (!cmd) return modal.hidden ? show(tab) : close();
    if (cmd === 'tab') return show(arg);
    if (cmd === 'planet') return show('planets', +arg);
    if (cmd === 'back') return back();
    if (cmd === 'close') return close();
    if (cmd === 'dismiss') return hideToast();
  }

  // ---------- Arrival pop-up (once per browser session) ----------
  function toast() {
    try { if (sessionStorage.getItem('wp.discToast')) return; } catch {}
    const fresh = planets().filter((p) => p.fresh).sort(byScore);
    const other = TAB_ORDER.slice(1).filter((k) => count(k)).sort((a, b) => count(b) - count(a))[0];
    if (!fresh.length && !other) return;
    try { sessionStorage.setItem('wp.discToast', '1'); } catch {}
    const n = other ? count(other) : 0;
    const bits = [fresh.length && `${fresh.length} new planet${fresh.length === 1 ? '' : 's'} this week`,
      other && `${n} ${n === 1 ? 'story' : 'stories'} on ${TABS[other].label.toLowerCase()}`].filter(Boolean);
    toastEl.innerHTML = `<button class="toast-main" data-sp="disc:tab:${fresh.length ? 'planets' : other}">
        <span class="orbs">${fresh.length ? fresh.slice(0, 3).map((p) => orb(p, 20, 30)).join('') : TABS[other].icon}</span>
        <span><b>New in deep space</b><small>${esc(bits.join(' · '))}</small></span><span class="go">Explore →</span></button>
      <button class="toast-x" data-sp="disc:dismiss" aria-label="Dismiss"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
    toastEl.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => toastEl.classList.add('in')));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 14000);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    toastEl.classList.remove('in');
    toastEl.hidden = true;
  }

  return { ready, strip, toast, hideToast, handle, close, escape: () => (open != null ? back() : close()), isOpen: () => !modal.hidden };
}
