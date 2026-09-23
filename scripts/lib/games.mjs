// Upcoming U.S. games for the national panel: NFL, MLB, NBA, NHL, and AP Top 25 college football and
// men's basketball, from ESPN's scoreboards. Preseason games are left out. ESPN rejects date ranges,
// so each league is fetched one day at a time. A league whose fetches all fail keeps its games from
// the previous run that haven't started yet.
import fs from 'node:fs/promises';

export const LEAGUES = [
  { id: 'nfl', label: 'NFL', path: 'football/nfl' },
  { id: 'mlb', label: 'MLB', path: 'baseball/mlb' },
  { id: 'nba', label: 'NBA', path: 'basketball/nba' },
  { id: 'cfb', label: 'NCAA FB', path: 'football/college-football', query: '&groups=80', sport: 'football' },
  { id: 'cbb', label: 'NCAA BB', path: 'basketball/mens-college-basketball', query: '&groups=50', sport: 'basketball' },
  { id: 'nhl', label: 'NHL', path: 'hockey/nhl' },
];
const DAYS = 7;
// Teams the place-name matcher can't place: "Cleveland" reads as a surname, "New England" isn't a
// state, and the Athletics carry no city (Sacramento until their Las Vegas stadium opens).
const TEAM_STATE = { 'Cleveland Browns': 's:OH', 'Cleveland Guardians': 's:OH', 'New England Patriots': 's:MA', Athletics: 's:CA' };

// apRank(sport, displayName) → AP Top 25 rank or null; stateKey(abbr or name) → "s:XX" or null;
// teamState(displayName) → the state a team belongs to ("Dallas Cowboys" → "s:TX") or null.
export async function loadGames({ fetchJSON, today, apRank, stateKey, teamState, prevPath, log = console.log }) {
  const days = Array.from({ length: DAYS }, (_, i) => new Date(Date.parse(`${today}T12:00:00Z`) + i * 864e5).toISOString().slice(0, 10));
  let prev = [];
  try { prev = JSON.parse(await fs.readFile(prevPath, 'utf8')).games || []; } catch {}

  const games = [];
  const failed = [];
  for (const L of LEAGUES) {
    const boards = await Promise.all(days.map((d) => fetchJSON(
      `https://site.api.espn.com/apis/site/v2/sports/${L.path}/scoreboard?dates=${d.replace(/-/g, '')}&limit=300${L.query || ''}`)));
    if (boards.every((b) => !b?.events)) {
      failed.push(L.label);
      games.push(...prev.filter((g) => g.l === L.id && g.ts > Date.now()));
      continue;
    }
    const seen = new Set();
    for (const e of boards.flatMap((b) => b?.events || [])) {
      const c = e.competitions?.[0];
      const slug = e.season?.slug || '';
      if (!c || seen.has(e.id) || e.season?.type === 1 || /pre-?season/.test(slug) || e.status?.type?.state !== 'pre') continue;
      seen.add(e.id);
      const dn = (ha) => c.competitors?.find((t) => t.homeAway === ha)?.team?.displayName;
      const side = (ha) => {
        const x = c.competitors?.find((t) => t.homeAway === ha);
        const r = L.sport ? apRank(L.sport, x?.team?.displayName) : null;
        return { n: x?.team?.shortDisplayName || x?.team?.displayName || 'TBD', ab: x?.team?.abbreviation || '', ...(r && { r }) };
      };
      const a = side('away'), h = side('home');
      // College: only games with an AP Top 25 team, the same bar the rest of the site uses.
      if (L.sport && !a.r && !h.r) continue;
      const addr = c.venue?.address || {};
      // States whose panels list this game: each team's home state, plus wherever it's played.
      const stateOf = (name) => TEAM_STATE[name] || teamState(name);
      const states = [...new Set([stateOf(dn('away')), stateOf(dn('home')), stateKey(addr.state)].filter(Boolean))];
      const tv = [...new Set((c.broadcasts || []).filter((b) => b.market === 'national').flatMap((b) => b.names || []))];
      games.push({
        l: L.id, id: e.id, ts: Date.parse(e.date), a, h,
        ...(c.timeValid === false && { tbd: 1 }),
        ...(c.neutralSite && { neutral: 1 }),
        ...(tv.length && { tv: tv.slice(0, 3).join(', ') }),
        v: c.venue?.fullName || '',
        at: [addr.city, addr.state || (addr.country && addr.country !== 'USA' ? addr.country : '')].filter(Boolean).join(', '),
        ...(stateKey(addr.state) && { st: stateKey(addr.state) }),
        ...(states.length && { s: states }),
        ...(c.notes?.[0]?.headline && { note: c.notes[0].headline }),
        ...(slug.includes('post') && !c.notes?.[0]?.headline && { note: 'Postseason' }),
        u: e.links?.find((x) => x.rel?.includes('summary'))?.href || e.links?.[0]?.href || '',
      });
    }
  }
  games.sort((x, y) => x.ts - y.ts);
  const counts = LEAGUES.map((L) => `${games.filter((g) => g.l === L.id).length} ${L.label}`).join(', ');
  log(`Games (next ${DAYS} days): ${counts}${failed.length ? `; ESPN failed for ${failed.join(', ')}, kept earlier schedule` : ''}`);
  return { from: days[0], to: days.at(-1), leagues: LEAGUES.map(({ id, label }) => ({ id, label })), games };
}
