// Space mode: live ISS orbit, launches, aurora forecast, APOD, asteroid flybys, the Sun, space news.
import * as satellite from 'satellite.js';
import { geoContains } from 'd3-geo';
import { createDiscoveries } from './discoveries.js?v=60cc261735';

const ISS_ALT = 0.066; // ~420 km in globe radii
const STATUS = {
  Success: ['61,220,132', 'Success'], Failure: ['255,77,94', 'Failure'],
  'Partial Failure': ['255,154,61', 'Partial failure'], 'In Flight': ['57,208,255', 'In flight'],
};
const statusOf = (s) => STATUS[s] || ['199,125,255', s || 'Scheduled'];
const flareVal = (c) => ({ A: 1e-8, B: 1e-7, C: 1e-6, M: 1e-5, X: 1e-4 }[c?.[0]] || 0) * parseFloat(c?.slice(1) || 0);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const apodLink = (d) => `https://apod.nasa.gov/apod/ap${d.slice(2).replace(/-/g, '')}.html`;
const kpText = (kp) => (kp >= 5 ? `G${Math.min(5, Math.floor(kp) - 4)} geomagnetic storm` : kp >= 4 ? 'active' : 'quiet');

function moonPhase(date = new Date()) {
  const syn = 29.530588853;
  const age = (((date - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % syn + syn) % syn;
  const names = [['🌑', 'New moon'], ['🌒', 'Waxing crescent'], ['🌓', 'First quarter'], ['🌔', 'Waxing gibbous'], ['🌕', 'Full moon'], ['🌖', 'Waning gibbous'], ['🌗', 'Last quarter'], ['🌘', 'Waning crescent']];
  const [icon, name] = names[Math.floor((age / syn) * 8 + 0.5) % 8];
  return { icon, name, illum: (1 - Math.cos((2 * Math.PI * age) / syn)) / 2 };
}

function oceanName(lat, lng) {
  if (lat < -60) return 'Southern Ocean';
  if (lat > 66) return 'Arctic Ocean';
  if (lng >= 20 && lng < 146 && lat < 25) return 'Indian Ocean';
  if (lng >= -70 && lng < 20) return 'Atlantic Ocean';
  if (lng >= -100 && lng < -70 && lat > 10) return 'Atlantic Ocean';
  return 'Pacific Ocean';
}

function countdown(t) {
  const s = Math.max(0, Math.floor((t - Date.now()) / 1000));
  if (!s) return 'Launching…';
  const d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60, sec = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  return `T−${d ? ` ${d}d` : ''} ${p(h)}:${p(m)}:${p(sec)}`;
}

export function createSpace(ctx) {
  const { world, S, esc, timeLabel, dayLabel, selDays, periodLabel, storyList, loadDay, polys, render, upcomingRows, liveUpcoming, applyFocus } = ctx;
  let data = null, loading = null, satrec = null, aurora = [], kpNow = null;
  let timer = null, pathTimer = null, follow = false, over = '—', tickN = 0, shownLaunches = [], shownUpcoming = [], issPaths = [];
  const iss = { lat: 0, lng: 0, alt: ISS_ALT, iss: true };
  const disc = createDiscoveries({ S, esc, dayLabel, loadDay, storyList, getData: () => data });

  world
    .hexBinPointLat('lat').hexBinPointLng('lng').hexBinPointWeight('p').hexBinResolution(3).hexMargin(0.12).hexBinMerge(true)
    .hexTopColor((d) => `rgba(80,255,170,${(0.1 + Math.min(1, d.sumWeight / d.points.length / 50) * 0.65).toFixed(3)})`)
    .hexSideColor((d) => `rgba(80,255,170,${(0.04 + Math.min(1, d.sumWeight / d.points.length / 50) * 0.25).toFixed(3)})`)
    .hexAltitude((d) => Math.min(0.035, 0.003 + d.sumWeight / d.points.length / 2200))
    .hexTransitionDuration(0)
    .pathPoints('pts').pathPointLat((p) => p[0]).pathPointLng((p) => p[1]).pathPointAlt((p) => p[2])
    .pathColor((d) => d.color).pathStroke(1.6).pathResolution(2).pathTransitionDuration(0)
    .pathDashLength((d) => (d.dash ? 0.012 : 1)).pathDashGap((d) => (d.dash ? 0.006 : 0)).pathDashAnimateTime((d) => (d.dash ? 50000 : 0));

  const getJSON = (u) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error(u))));
  function load() {
    loading ||= Promise.allSettled([
      getJSON(`data/space.json?v=${encodeURIComponent(S.idx.generated)}`).then((j) => { data = j; }),
      getJSON('https://api.wheretheiss.at/v1/satellites/25544/tles').then((t) => { satrec = satellite.twoline2satrec(t.line1, t.line2); }),
      getJSON('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json').then((j) => {
        aurora = j.coordinates.filter((c) => c[2] >= 5).map(([lng, lat, p]) => ({ lat, lng: lng > 180 ? lng - 360 : lng, p }));
      }),
      getJSON('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json').then((j) => {
        const last = j.at(-1);
        kpNow = +(Array.isArray(last) ? last[1] : last.Kp);
      }),
    ]);
    return loading;
  }

  function issAt(date) {
    if (!satrec) return null;
    const pv = satellite.propagate(satrec, date);
    if (!pv?.position) return null;
    const gd = satellite.eciToGeodetic(pv.position, satellite.gstime(date));
    const v = pv.velocity;
    return { lat: satellite.degreesLat(gd.latitude), lng: satellite.degreesLong(gd.longitude), h: gd.height, speed: Math.hypot(v.x, v.y, v.z) * 3600 };
  }

  function buildPaths() {
    const now = Date.now(), past = [], future = [];
    for (let m = -45; m <= 95; m += 0.5) {
      const p = issAt(new Date(now + m * 60000));
      if (!p) continue;
      const pt = [p.lat, p.lng, ISS_ALT];
      if (m <= 0) past.push(pt);
      if (m >= 0) future.push(pt);
    }
    issPaths = [
      { pts: past, color: ['rgba(199,125,255,0.02)', 'rgba(199,125,255,0.55)'] },
      { pts: future, color: ['rgba(235,220,255,0.95)', 'rgba(199,125,255,0.04)'], dash: true },
    ];
  }

  function overWhat(lat, lng) {
    const f = polys.find((p) => geoContains(p, [lng, lat]));
    if (!f) return oceanName(lat, lng);
    return f.isState ? `${f.properties.name}, USA` : f.properties.name;
  }

  function tick() {
    const p = issAt(new Date());
    if (p) {
      iss.lat = p.lat;
      iss.lng = p.lng;
      if (S.layers.iss) world.htmlElementsData([iss]);
      if (tickN++ % 5 === 0) over = overWhat(p.lat, p.lng);
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('iss-over', over);
      set('iss-alt', `${fmt(p.h)} km`);
      set('iss-spd', `${fmt(p.speed)} km/h`);
      if (follow) world.pointOfView({ lat: p.lat, lng: p.lng, altitude: Math.max(1.4, world.pointOfView().altitude) }, 900);
    }
    for (const el of document.querySelectorAll('[data-cd]')) el.textContent = countdown(+el.dataset.cd);
  }

  async function enter() {
    await load();
    if (S.mode !== 'space') return;
    buildPaths();
    clearInterval(timer);
    clearInterval(pathTimer);
    timer = setInterval(tick, 1000);
    pathTimer = setInterval(buildPaths, 60000);
    tick();
    render();
    disc.ready().then(() => { if (S.mode === 'space') disc.toast(); });
  }

  function exit() {
    clearInterval(timer);
    clearInterval(pathTimer);
    follow = false;
    disc.close();
    disc.hideToast();
  }

  function issElement() {
    const el = document.createElement('button');
    el.className = 'iss-marker';
    el.title = 'International Space Station — click to follow';
    el.innerHTML = '<span class="iss-core"></span><span class="iss-tag">ISS</span>';
    el.onclick = () => handle('follow');
    return el;
  }

  function focusLaunch(l) {
    follow = false;
    world.controls().autoRotate = false;
    world.pointOfView({ lat: l.lat, lng: l.lng, altitude: 1.3 }, 1200);
  }

  function launchLabel(l) {
    const [, label] = statusOf(l.status);
    return `<div class="tt"><b>🚀 ${esc(l.rocket)}</b><span>${esc(l.name)} · ${label}</span><span>${esc(l.location || l.pad)} · ${timeLabel(l.ts)}</span></div>`;
  }

  function renderGlobe() {
    const days = new Set(selDays());
    const L = S.layers;
    const launches = L.launches ? (data?.launches || []).filter((l) => days.has(l.day) && l.lat != null) : [];
    const next = L.launches ? (data?.upcoming || []).filter((l) => l.lat != null).slice(0, 5) : [];
    world
      .pointsData([
        ...launches.map((l) => ({ lat: l.lat, lng: l.lng, color: `rgb(${statusOf(l.status)[0]})`, alt: 0.05, r: 0.34, label: launchLabel(l), onClick: () => focusLaunch(l) })),
        ...next.map((l) => ({ lat: l.lat, lng: l.lng, color: 'rgba(199,125,255,0.5)', alt: 0.012, r: 0.26, label: launchLabel(l).replace('🚀', '🗓️ Upcoming:'), onClick: () => focusLaunch(l) })),
      ])
      .ringsData(launches.map((l) => ({ lat: l.lat, lng: l.lng, rgb: '199,125,255', a: 0.9, maxR: 4.5, speed: 2.2, period: 1700 })))
      .arcsData(launches.map((l) => {
        // A stylised ascent: only the rising half of an arc (polar/sun-synchronous missions head south,
        // everything else east), brightest at its peak like a rocket's tip, so it doesn't read as a landing.
        const polar = /SSO|PO|Polar|Sun-Synch/i.test(l.orbit);
        return {
          sLat: l.lat, sLng: l.lng, eLat: polar ? l.lat - 30 : l.lat * 0.6, eLng: polar ? l.lng - 10 : l.lng + 38,
          rgb: '199,125,255', alt: 0.3, label: launchLabel(l), onClick: () => focusLaunch(l),
          colors: ['rgba(199,125,255,0.1)', 'rgba(199,125,255,1)', 'rgba(199,125,255,0)'],
          // three-globe measures dash distance from the arc's end, so offset by half to keep the pad side.
          dash: 0.5, gap: 2, initialGap: 0.5, animate: 0,
        };
      }))
      .labelsData([])
      .hexBinPointsData(L.aurora ? aurora : [])
      .pathsData(L.iss && satrec ? issPaths : [])
      .htmlElementsData(L.iss && satrec ? [iss] : []);
  }

  function handle(action) {
    if (action === 'follow') {
      follow = !follow;
      world.controls().autoRotate = false;
      if (follow) tick();
      document.querySelectorAll('[data-sp="follow"]').forEach((b) => {
        b.classList.toggle('on', follow);
        b.textContent = follow ? 'Stop following' : 'Follow the ISS';
      });
    } else if (action.startsWith('launch:')) {
      const l = shownLaunches[+action.slice(7)];
      if (l?.lat != null) focusLaunch(l);
    } else if (action.startsWith('up:')) {
      const l = shownUpcoming[+action.slice(3)];
      if (l?.lat != null) focusLaunch(l);
    } else if (action.startsWith('go:')) {
      document.getElementById(`sec-${action.slice(3)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (action.startsWith('disc')) {
      disc.handle(action);
    }
  }

  // Marks the jump link for the section you are currently reading.
  function spyOn(body) {
    const nav = body.querySelector('.sec-nav');
    body.onscroll = null;
    if (!nav) return;
    const secs = [...nav.querySelectorAll('[data-sec]')].map((b) => ({ b, el: document.getElementById(`sec-${b.dataset.sec}`) })).filter((x) => x.el);
    if (!secs.length) return;
    let queued = false;
    const spy = () => {
      queued = false;
      const top = body.getBoundingClientRect().top + 58; // just below the pinned nav
      let cur = secs[0];
      for (const s of secs) if (s.el.getBoundingClientRect().top <= top) cur = s;
      for (const s of secs) s.b.classList.toggle('on', s === cur);
    };
    body.onscroll = () => { if (!queued) { queued = true; requestAnimationFrame(spy); } };
    spy();
  }

  async function renderPanel(body) {
    const token = ++S.panelToken;
    await Promise.all([load(), disc.ready()]);
    const days = selDays();
    const week = S.day === 'week';
    const stories = (await Promise.all(days.map(loadDay))).flat().filter((s) => s.p.includes('x:SPACE'))
      .sort((a, b) => (week && a.d !== b.d ? (b.d > a.d ? 1 : -1) : b.sc - a.sc));
    if (token !== S.panelToken || S.mode !== 'space') return;
    const d = data || {};
    const daySet = new Set(days);
    const moon = moonPhase();

    const apodDays = Object.keys(d.apod || {}).sort();
    const aDay = week ? apodDays.at(-1) : apodDays.filter((x) => x <= S.day).at(-1);
    const a = d.apod?.[aDay];
    const apod = a ? `
      <figure class="apod">
        <a href="${apodLink(aDay)}" target="_blank" rel="noopener"><img src="${esc(a.img)}" alt="${esc(a.title)}" loading="lazy"></a>
        <figcaption>
          <span class="eyebrow">NASA Astronomy Picture of the Day · ${dayLabel(aDay, { month: 'short', day: 'numeric' })}</span>
          <b>${esc(a.title)}</b>
          <details><summary>${esc(a.expl.slice(0, 150))}… <u>more</u></summary>${esc(a.expl)}</details>
          <small>© ${esc(a.credit)}</small>
        </figcaption>
      </figure>
      ${week ? `<div class="apod-strip">${apodDays.map((x) => `<button data-day="${x}" title="${esc(d.apod[x].title)}"><img src="${esc(d.apod[x].img)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}` : '';

    const pos = issAt(new Date());
    const crew = d.crew?.count ? `<div class="crew"><b>${d.crew.count}</b> people in space right now
      <div class="crew-names">${d.crew.people.map((p) => `<span>${esc(p.name)}${p.agency ? ` <i>${esc(p.agency)}</i>` : ''}</span>`).join('')}</div></div>` : '';
    const issCard = `
      <div class="iss-card">
        ${satrec ? `<div class="tele">
          <div><b id="iss-over">${esc(pos ? overWhat(pos.lat, pos.lng) : '—')}</b><small>Over</small></div>
          <div><b id="iss-alt">${pos ? `${fmt(pos.h)} km` : '—'}</b><small>Altitude</small></div>
          <div><b id="iss-spd">${pos ? `${fmt(pos.speed)} km/h` : '—'}</b><small>Speed</small></div>
        </div>
        <button class="follow ${follow ? 'on' : ''}" data-sp="follow">${follow ? 'Stop following' : 'Follow the ISS'}</button>` : '<div class="sub">Live ISS tracking is unavailable right now.</div>'}
        ${crew}
      </div>`;

    shownLaunches = (d.launches || []).filter((l) => daySet.has(l.day)).sort((x, y) => y.ts - x.ts);
    shownUpcoming = (d.upcoming || []).filter((l) => l.ts > Date.now());
    const next = shownUpcoming[0];

    // At a glance: what changes hour to hour. Every [data-cd] countdown is retimed by tick().
    const tiles = `
      <div class="now-tiles">
        ${next ? `<button class="tile wide" data-sp="up:0" title="Show the launch pad on the globe">
            <small>Next launch</small><b data-cd="${next.ts}">${countdown(next.ts)}</b>
            <span>${esc(next.rocket)}</span></button>`
          : '<div class="tile wide"><small>Next launch</small><b>—</b><span>Nothing scheduled</span></div>'}
        <div class="tile"><small>In space</small><b>${d.crew?.count ?? '—'}</b><span>people</span></div>
        <div class="tile"><small>Aurora Kp</small><b>${Number.isFinite(kpNow) ? kpNow.toFixed(1) : '—'}</b>
          <span>${Number.isFinite(kpNow) ? kpText(kpNow) : 'unknown'}</span></div>
      </div>`;

    const upcomingRow = shownUpcoming.length ? `
      <div class="up-head">Upcoming</div>
      <div class="up-row">${shownUpcoming.map((l, i) => `
        <button class="up-card" data-sp="up:${i}">
          <span class="cd" data-cd="${l.ts}">${countdown(l.ts)}</span>
          <b>${esc(l.rocket)}</b><small>${esc(l.name)}</small>
          <small class="dim">${esc(l.provider)} · ${timeLabel(l.ts)}</small>
        </button>`).join('')}</div>` : '';

    const launches = `
      ${upcomingRow}
      ${shownLaunches.length ? `<div class="up-head">${week ? 'Flown this week' : 'Flown this day'}</div>${shownLaunches.map((l, i) => {
        const [rgb, label] = statusOf(l.status);
        return `<button class="launch" data-sp="launch:${i}" style="--c:rgb(${rgb})">
          ${l.img ? `<img src="${esc(l.img)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
          <span class="l-body"><span class="s-meta"><span class="tag">${label}</span><span>${timeLabel(l.ts)}</span></span>
          <b>${esc(l.rocket)} · ${esc(l.name)}</b><small>${esc(l.provider)} · ${esc(l.location || l.pad)}</small>
          ${l.desc ? `<p>${esc(l.desc)}</p>` : ''}</span></button>`;
      }).join('')}` : '<div class="empty">No launches in this period.</div>'}`;

    const neos = days.flatMap((x) => d.neos?.[x] || []).sort((p, q) => p.ld - q.ld).slice(0, 6);
    const neoHtml = neos.map((o) => `
      <a class="list-row" href="${esc(o.url)}" target="_blank" rel="noopener">
        <span class="mag neo">${o.ld.toFixed(1)}<small>LD</small></span>
        <span>${esc(o.name)}${o.haz ? ' <span class="major">Potentially hazardous</span>' : ''}
        <small>~${fmt(o.dia)} m wide · ${fmt(o.km)} km away · ${fmt(o.kph)} km/h · ${timeLabel(o.ts)}</small></span>
      </a>`).join('');

    const fl = days.map((x) => d.flares?.[x]).filter(Boolean);
    const strongest = fl.map((f) => f.top).filter(Boolean).sort((p, q) => flareVal(q.c) - flareVal(p.c))[0];
    const big = fl.flatMap((f) => f.big).sort((p, q) => flareVal(q.c) - flareVal(p.c)).slice(0, 12);
    const kpMax = Math.max(0, ...days.map((x) => d.kp?.[x] ?? 0));
    const sun = strongest ? `
      <div class="sun">
        <div class="flare-top"><span class="flare-cls cls-${strongest.c[0]}">${esc(strongest.c)}</span>
          <span>Strongest solar flare<small>${timeLabel(strongest.ts)} · ${fl.reduce((s, f) => s + f.count, 0)} flares total</small></span></div>
        ${big.length ? `<div class="flare-chips">${big.map((f) => `<span title="${timeLabel(f.ts)}">${esc(f.c)}</span>`).join('')}</div>` : ''}
        <div class="sub">Max Kp ${kpMax.toFixed(1)} — ${kpText(kpMax)}${kpMax >= 5 ? ' · auroras reached lower latitudes' : ''}</div>
      </div>` : '';

    const skyEvents = liveUpcoming().filter((e) => e.k === 'eclipse' || e.k === 'meteor');
    const strip = disc.strip();
    const nav = [[strip && 'disc', 'Discoveries'], ['iss', 'ISS'], ['launch', 'Launches'], ['news', 'News'], [(skyEvents.length || neoHtml || sun) && 'sky', 'Sky']]
      .filter(([k]) => k).map(([k, label]) => `<button data-sp="go:${k}" data-sec="${k}">${label}</button>`).join('');

    body.innerHTML = `
      <div class="p-head space-head">
        <div class="p-top"><span class="eyebrow">🚀 Space · ${periodLabel()}</span><button class="close" data-mode="earth">🌍 Back to Earth</button></div>
        <h2>Above the Planet</h2>
        <div class="sub">${moon.icon} ${moon.name}, ${Math.round(moon.illum * 100)}% lit</div>
      </div>
      ${tiles}
      <nav class="sec-nav" aria-label="Jump to section">${nav}</nav>
      ${strip ? `<div id="sec-disc">${strip}</div>` : ''}
      ${apod}
      <h3 id="sec-iss">ISS right now</h3>${issCard}
      <h3 id="sec-launch">Launches</h3>${launches}
      <h3 id="sec-news">Space news</h3>${storyList(stories.slice(0, week ? 40 : 15), week)}
      ${skyEvents.length ? `<h3 id="sec-sky">Coming up in the sky</h3>${upcomingRows(skyEvents)}` : ''}
      ${neoHtml ? `<h3${skyEvents.length ? '' : ' id="sec-sky"'}>Asteroid flybys</h3>${neoHtml}<div class="sub" style="font-size:11px;margin-top:6px">LD = lunar distances (1 LD ≈ 384,400 km)</div>` : ''}
      ${sun ? `<h3${neoHtml || skyEvents.length ? '' : ' id="sec-sky"'}>The Sun</h3>${sun}` : ''}
      <div class="foot">Space data: NASA (APOD, NeoWs, news), ESA, NOAA Space Weather Prediction Center (flares, Kp, aurora forecast), The Space Devs Launch Library, NASA Exoplanet Archive (Caltech/IPAC), live ISS orbit from its current TLE via wheretheiss.at. News from SpaceNews, NASASpaceflight, Spaceflight Now, Space.com, Universe Today and trusted outlets.</div>`;
    body.scrollTop = 0;
    applyFocus(body);
    spyOn(body);
  }

  function teaser() {
    if (!data) return '';
    const days = new Set(selDays());
    const n = (data.launches || []).filter((l) => days.has(l.day)).length;
    const latest = data.apod?.[Object.keys(data.apod || {}).sort().at(-1)];
    return `<button class="space-teaser" data-mode="space">
      ${latest ? `<img src="${esc(latest.img)}" alt="">` : ''}
      <span><span class="eyebrow">🚀 Space mode</span><b>${n} launch${n === 1 ? '' : 'es'} · live ISS · aurora forecast</b>
      <small>${latest ? esc(latest.title) : 'See what’s happening above the planet'}</small></span></button>`;
  }

  return { load, enter, exit, renderGlobe, renderPanel, handle, issElement, teaser, disc };
}
