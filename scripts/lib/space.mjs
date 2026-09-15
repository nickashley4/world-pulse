// Space data for the week: launches (The Space Devs Launch Library), people in space, NASA APOD,
// near-Earth asteroid flybys (NASA NeoWs), solar flares and Kp (NOAA SWPC), and newly confirmed
// exoplanets (NASA Exoplanet Archive). Falls back to the last good response per source when an API
// is down or rate-limited.
import fs from 'node:fs/promises';
import path from 'node:path';

const LL = 'https://ll.thespacedevs.com/2.3.0';
const flareVal = (c) => ({ A: 1e-8, B: 1e-7, C: 1e-6, M: 1e-5, X: 1e-4 }[c?.[0]] || 0) * parseFloat(c?.slice(1) || 0);

// The archive adds planets in weekly batches; two months keeps the shelf full between quiet weeks.
// Recent disc_year filters out long-known planets whose rows were merely re-released.
const EXO_DAYS = 60;
const EXO_COLS = 'pl_name,hostname,disc_year,disc_pubdate,releasedate,discoverymethod,disc_facility,pl_rade,pl_bmasse,pl_orbper,pl_orbsmax,pl_eqt,sy_dist,sy_pnum,st_spectype,st_teff,disc_refname';
// ADS reference names carry HTML entities for author names (e.g. "Nesvorn&yacute;", "O&#39;Brien").
const ACCENT = { acute: '́', grave: '̀', uml: '̈', circ: '̂', tilde: '̃', cedil: '̧', ring: '̊', caron: '̌' };
const unentity = (s) => s.replace(/&([a-zA-Z])(acute|grave|uml|circ|tilde|cedil|ring|caron);/g, (_, c, k) => c + ACCENT[k])
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&').normalize('NFC');
const num = (v, dp) => (v == null || v === '' || Number.isNaN(+v) ? null : +(+v).toFixed(dp));

export async function loadSpace({ root, fetchJSON, etDay, days }) {
  const cachePath = path.join(root, 'data', 'space-cache.json');
  let cache = {};
  try { cache = JSON.parse(await fs.readFile(cachePath, 'utf8')); } catch {}
  const key = process.env.NASA_API_KEY || 'DEMO_KEY';
  const start = days[0], end = days.at(-1);
  const since = new Date(Date.parse(`${start}T00:00:00-04:00`)).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const exoSince = new Date(Date.parse(`${end}T12:00:00Z`) - EXO_DAYS * 864e5).toISOString().slice(0, 10);
  const exoUrl = `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?format=json&query=${encodeURIComponent(
    `select ${EXO_COLS} from ps where default_flag=1 and disc_year>=${+end.slice(0, 4) - 1} and releasedate>='${exoSince}' order by releasedate desc`)}`;

  const apodFor = async () => {
    const url = (e) => `https://api.nasa.gov/planetary/apod?api_key=${key}&start_date=${start}&end_date=${e}&thumbs=true`;
    const a = await fetchJSON(url(end));
    return Array.isArray(a) ? a : fetchJSON(url(days.at(-2))); // today's may not be posted yet
  };

  let [prev, up, crew, apod, neo, flares, kp, exo] = await Promise.all([
    fetchJSON(`${LL}/launches/previous/?net__gte=${since}&limit=60&ordering=-net`),
    fetchJSON(`${LL}/launches/upcoming/?limit=12&ordering=net`),
    fetchJSON(`${LL}/astronauts/?in_space=true&limit=40&mode=list`),
    apodFor(),
    fetchJSON(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${start}&end_date=${end}&api_key=${key}`),
    fetchJSON('https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json'),
    fetchJSON('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'),
    fetchJSON(exoUrl),
  ]);
  const keep = (name, val, ok) => { if (ok) { cache[name] = val; return val; } return cache[name] ?? null; };
  prev = keep('prev', prev, Array.isArray(prev?.results));
  up = keep('up', up, Array.isArray(up?.results));
  crew = keep('crew', crew, Array.isArray(crew?.results));
  apod = keep('apod', apod, Array.isArray(apod));
  neo = keep('neo', neo, !!neo?.near_earth_objects);
  flares = keep('flares', flares, Array.isArray(flares));
  kp = keep('kp', kp, Array.isArray(kp));
  exo = keep('exo', exo, Array.isArray(exo));

  const toLaunch = (r) => {
    const ts = Date.parse(r.net);
    return {
      id: r.id, name: r.mission?.name || r.name, rocket: r.rocket?.configuration?.full_name || r.rocket?.configuration?.name || '',
      provider: r.launch_service_provider?.name || '', mtype: r.mission?.type || '', orbit: r.mission?.orbit?.abbrev || '',
      desc: (r.mission?.description || '').slice(0, 280), ts, day: etDay(ts), status: r.status?.abbrev || '',
      lat: r.pad?.latitude != null ? +r.pad.latitude : null, lng: r.pad?.longitude != null ? +r.pad.longitude : null,
      pad: r.pad?.name || '', location: r.pad?.location?.name || '', img: r.image?.image_url || r.image?.thumbnail_url || null,
    };
  };
  const daySet = new Set(days);
  const seen = new Set();
  const launches = [...(prev?.results || []), ...(up?.results || [])].map(toLaunch)
    .filter((l) => daySet.has(l.day) && l.ts <= Date.now() + 3600e3 && !seen.has(l.id) && seen.add(l.id));
  const upcoming = (up?.results || []).map(toLaunch).filter((l) => l.ts > Date.now()).slice(0, 8);

  const people = (crew?.results || []).filter((a) => a.name !== 'Starman' && a.type?.name !== 'Non-Human')
    .map((a) => ({ name: a.name, agency: a.agency?.abbrev || '' }));

  const apodOut = {};
  for (const a of apod || []) {
    const img = a.media_type === 'image' ? a.url : a.thumbnail_url;
    if (!img) continue;
    apodOut[a.date] = { title: a.title, img, hd: a.hdurl || null, media: a.media_type, expl: a.explanation, credit: (a.copyright || 'NASA').replace(/\s+/g, ' ').trim() };
  }

  const neos = {};
  for (const list of Object.values(neo?.near_earth_objects || {})) {
    for (const o of list) {
      const ca = o.close_approach_data?.[0];
      if (!ca || ca.orbiting_body !== 'Earth') continue;
      const ts = ca.epoch_date_close_approach;
      const d = etDay(ts);
      const dia = o.estimated_diameter?.meters;
      (neos[d] ||= []).push({
        name: o.name.replace(/[()]/g, '').trim(), ts, ld: +ca.miss_distance.lunar, km: +ca.miss_distance.kilometers,
        kph: +ca.relative_velocity.kilometers_per_hour, dia: dia ? (dia.estimated_diameter_min + dia.estimated_diameter_max) / 2 : 0,
        haz: o.is_potentially_hazardous_asteroid, url: o.nasa_jpl_url,
      });
    }
  }
  for (const d of Object.keys(neos)) neos[d] = neos[d].sort((a, b) => a.ld - b.ld).slice(0, 6);

  const flaresOut = {};
  for (const f of flares || []) {
    const ts = Date.parse(f.max_time || f.begin_time);
    const d = etDay(ts);
    if (!daySet.has(d) || !f.max_class) continue;
    const e = (flaresOut[d] ||= { count: 0, big: [], top: null });
    e.count++;
    const item = { c: f.max_class, ts };
    if (/^[MX]/.test(f.max_class)) e.big.push(item);
    if (!e.top || flareVal(f.max_class) > flareVal(e.top.c)) e.top = item;
  }

  const kpOut = {};
  for (const row of kp || []) {
    const [t, v] = Array.isArray(row) ? [row[0], row[1]] : [row.time_tag, row.Kp];
    const ts = Date.parse(`${String(t).replace(' ', 'T')}Z`);
    if (Number.isNaN(ts) || Number.isNaN(+v)) continue;
    const d = etDay(ts);
    if (daySet.has(d)) kpOut[d] = Math.max(kpOut[d] || 0, +v);
  }

  // r/m in Earth radii/masses, per(iod) in days, a in AU, t = equilibrium temperature in K.
  const planets = (exo || []).filter((p) => p.pl_name && p.releasedate).slice(0, 60).map((p) => {
    const ref = String(p.disc_refname || '');
    return {
      name: p.pl_name, host: p.hostname, released: String(p.releasedate).slice(0, 10), year: p.disc_year, pub: p.disc_pubdate || null,
      method: p.discoverymethod || '', facility: p.disc_facility || '',
      r: num(p.pl_rade, 2), m: num(p.pl_bmasse, 2), per: num(p.pl_orbper, 3), a: num(p.pl_orbsmax, 4), t: num(p.pl_eqt, 0),
      ly: p.sy_dist != null ? Math.round(p.sy_dist * 3.26156) : null, sibs: p.sy_pnum || 1, spec: p.st_spectype || null, teff: num(p.st_teff, 0),
      ref: ref.match(/href=(https:\/\/[^\s>]+)/)?.[1] || null, refName: unentity(ref.replace(/<[^>]*>/g, '').trim()) || null,
    };
  });

  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(cache));
  return { apod: apodOut, launches, upcoming, crew: { count: people.length, people }, neos, flares: flaresOut, kp: kpOut, planets };
}
