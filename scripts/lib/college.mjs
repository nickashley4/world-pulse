// College sports filter: only AP Top 25 football and men's basketball teams (via ESPN).
import fs from 'node:fs/promises';
import path from 'node:path';

const LEAGUES = [
  { sport: 'football', site: 'football/college-football', core: 'football/leagues/college-football', feed: 'https://www.espn.com/espn/rss/ncf/news' },
  { sport: 'basketball', site: 'basketball/mens-college-basketball', core: 'basketball/leagues/mens-college-basketball', feed: 'https://www.espn.com/espn/rss/ncb/news' },
];

// Team locations that are common words/names, or places that mean something else in the news.
const LOC_DENY = new Set(['Army', 'Navy', 'Air Force', 'Liberty', 'Rice', 'Temple', 'Southern', 'Pacific', 'Duke', 'Marshall', 'Brown', 'Howard', 'Columbia', 'Wagner', 'Monmouth', 'Hampton', 'Mercer', 'Lafayette', 'Drake', 'Elon', 'Belmont', 'Campbell', 'Stetson', 'Samford', 'Furman', 'Presbyterian', 'Washington', 'Harvard', 'Yale', 'Princeton', 'Stanford', 'Northwestern', 'Vanderbilt', 'Georgetown', 'Providence', 'Dayton', 'Toledo', 'Buffalo', 'Memphis', 'Houston', 'Charlotte', 'Tulsa', 'Miami', 'Cincinnati', 'Louisville', 'Pittsburgh', 'Syracuse', 'Boston College', 'Richmond', 'Portland', 'Denver', 'Hawaii', 'Nevada', 'Idaho', 'Maine', 'Delaware', 'Vermont', 'New Hampshire', 'Rhode Island', 'Wyoming', 'Montana']);
// Nicknames shared with pro teams or ordinary words.
const NICK_DENY = new Set(['Hurricanes', 'Cyclones', 'Volunteers', 'Cardinal', 'Rebels', 'Ducks', 'Storm', 'Thunder', 'Lightning', 'Heat', 'Magic', 'Jazz', 'Wild', 'Stars', 'Blues', 'Kings', 'Flames', 'Rockets', 'Pirates', 'Braves', 'Rams', 'Eagles', 'Bears', 'Lions', 'Panthers', 'Jaguars', 'Falcons', 'Chargers', 'Raiders', 'Titans', 'Vikings', 'Patriots', 'Giants', 'Jets', 'Bills', 'Dolphins', 'Ravens', 'Cowboys', 'Saints', 'Buccaneers', 'Seahawks', 'Commanders', 'Bulls', 'Nets', 'Suns', 'Spurs', 'Warriors', 'Hornets', 'Hawks', 'Pistons', 'Pacers', 'Bucks', 'Cavaliers', 'Celtics', 'Wizards', 'Mavericks', 'Penguins', 'Flyers', 'Rangers', 'Islanders', 'Devils', 'Senators', 'Capitals', 'Predators', 'Avalanche', 'Coyotes', 'Sharks', 'Tigers', 'Royals', 'Twins', 'Astros', 'Mariners', 'Athletics', 'Angels', 'Marlins', 'Nationals', 'Cubs', 'Brewers', 'Reds', 'Padres', 'Rockies', 'Knights', 'Mustangs', 'Pioneers', 'Explorers', 'Dragons', 'Spiders', 'Rebels', 'Owls', 'Monarchs', 'Mountaineers']);

export const COLLEGE_RX = /\b(college football|college basketball|CFB|NCAA|CFP|College Football Playoff|Heisman|Big Ten|SEC|ACC|Big 12|Big East|Pac-12|bowl game|March Madness|Final Four|Sweet 16|Elite Eight|AP Top 25|AP poll|Coaches Poll|transfer portal|recruiting|five-star|four-star)\b/;
export const OTHER_SPORT_RX = /\b(volleyball|baseball|softball|soccer|hockey|lacrosse|track and field|cross country|golf|tennis|gymnastics|wrestling|swimming|rowing|water polo)\b/i;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function loadCollege({ root, fetchJSON, isPlaceAlias, stateKeys, stateByName }) {
  // "Iowa State", "Texas Tech", "Illinois" → the state in the name beats ESPN's venue data.
  const stateFromName = (loc) => {
    if (loc === 'Kansas City') return null;
    let best = null;
    for (const [n, ab] of stateByName) if ((loc === n || loc.startsWith(`${n} `)) && (!best || n.length > best[0].length)) best = [n, ab];
    return best?.[1] || null;
  };
  const cachePath = path.join(root, 'data', 'college.json');
  let cache = { states: {}, ranked: [], polls: {} };
  try { cache = { ...cache, ...JSON.parse(await fs.readFile(cachePath, 'utf8')) }; } catch {}

  const teams = new Map(); // displayName → team
  const ensure = (location, name, displayName) => {
    const dn = displayName || `${location} ${name}`;
    if (!teams.has(dn)) teams.set(dn, { dn, location, name, ids: {}, ranks: {} });
    return teams.get(dn);
  };
  const polls = {};
  let gotRankings = false;

  await Promise.all(LEAGUES.map(async (L) => {
    const [list, rk] = await Promise.all([
      fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/${L.site}/teams?limit=1000`),
      fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/${L.site}/rankings`),
    ]);
    for (const { team: t } of list?.sports?.[0]?.leagues?.[0]?.teams || []) ensure(t.location, t.name, t.displayName).ids[L.sport] = t.id;
    const ap = rk?.rankings?.find((r) => r.name === 'AP Top 25');
    if (ap?.ranks?.length) {
      gotRankings = true;
      polls[L.sport] = ap.date;
      for (const r of ap.ranks) {
        const t = ensure(r.team.location, r.team.name);
        t.ranks[L.sport] = r.current;
        t.ids[L.sport] ||= r.team.id;
      }
    }
  }));

  if (!gotRankings) { // ESPN unavailable: fall back to last saved rankings
    for (const c of cache.ranked) Object.assign(ensure(c.location, c.name, c.dn).ranks, c.ranks);
    Object.assign(polls, cache.polls);
  }

  const ranked = [...teams.values()].filter((t) => Object.keys(t.ranks).length);
  await Promise.all(ranked.map(async (t) => {
    t.state = stateFromName(t.location) || cache.states[t.dn];
    if (t.state) { cache.states[t.dn] = t.state; return; }
    for (const L of LEAGUES) {
      if (!t.ids[L.sport]) continue;
      const j = await fetchJSON(`https://sports.core.api.espn.com/v2/sports/${L.core}/teams/${t.ids[L.sport]}`);
      const st = j?.venue?.address?.state;
      if (st) { t.state = st; cache.states[t.dn] = st; return; }
    }
  }));

  // Strings that identify a college team, longest first.
  const nickCount = new Map();
  for (const t of teams.values()) nickCount.set(t.name, (nickCount.get(t.name) || 0) + 1);
  const uniqueNick = (t) => nickCount.get(t.name) === 1 && !NICK_DENY.has(t.name) && t.name.length >= 4;
  const strings = new Map();
  const put = (s, t, placeLike) => { if (s && s.length >= 3 && !strings.has(s)) strings.set(s, { dn: t.dn, placeLike }); };
  for (const t of teams.values()) put(t.dn, t, false);
  for (const t of teams.values()) if (!LOC_DENY.has(t.location)) put(t.location, t, isPlaceAlias(t.location));
  for (const t of teams.values()) if (uniqueNick(t) && !isPlaceAlias(t.name)) put(t.name, t, false);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${[...strings.keys()].sort((a, b) => b.length - a.length).map(esc).join('|')})(?![\\p{L}\\p{N}])`, 'gu');
  const rankedSet = new Set(ranked.map((t) => t.dn));

  // strong = explicit college signal (keyword, full team name, or nickname), not just a school/place name.
  function detect(text) {
    let strong = COLLEGE_RX.test(text), isCollege = strong, hasRanked = false;
    for (const m of text.matchAll(re)) {
      const s = strings.get(m[1]);
      if (s.placeLike) { if (rankedSet.has(s.dn)) hasRanked = true; continue; }
      isCollege = true;
      if (m[1] !== teams.get(s.dn).location) strong = true;
      if (rankedSet.has(s.dn)) hasRanked = true;
    }
    return { isCollege, strong, ranked: hasRanked };
  }

  const aliases = [];
  const queries = [];
  for (const t of ranked) {
    const key = t.state && stateKeys.has(`s:${t.state}`) ? `s:${t.state}` : null;
    if (!key) continue;
    for (const s of [t.dn, LOC_DENY.has(t.location) ? null : t.location, uniqueNick(t) ? t.name : null]) {
      if (s && !isPlaceAlias(s)) aliases.push([s, key]);
    }
    queries.push({ key, q: `"${t.dn}"` });
  }

  async function save() {
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify({
      polls, states: cache.states,
      ranked: ranked.map((t) => ({ dn: t.dn, location: t.location, name: t.name, ranks: t.ranks, state: t.state })),
    }, null, 1));
  }

  return {
    aliases, queries, detect, save, polls,
    ranked: ranked.map((t) => ({ dn: t.dn, ranks: t.ranks, state: t.state })),
    feeds: LEAGUES.map((L) => ({ id: `espn-${L.sport}`, url: L.feed, name: 'ESPN', domain: 'espn.com', hint: 'sports' })),
  };
}
