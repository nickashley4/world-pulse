// Trusted sources. Curated feeds are read directly; Google News search is used only as a
// discovery index and every result is filtered against the domain allowlist below.

export const FEEDS = [
  { id: 'bbc-world', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC News', domain: 'bbc.com' },
  ...['africa', 'asia', 'europe', 'latin_america', 'middle_east', 'us_and_canada'].map((r) => ({
    id: `bbc-${r}`, url: `https://feeds.bbci.co.uk/news/world/${r}/rss.xml`, name: 'BBC News', domain: 'bbc.com',
  })),
  { id: 'bbc-science', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', name: 'BBC News', domain: 'bbc.com', hint: 'science' },
  { id: 'bbc-sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml', name: 'BBC Sport', domain: 'bbc.com', hint: 'sports' },
  { id: 'npr-world', url: 'https://feeds.npr.org/1004/rss.xml', name: 'NPR', domain: 'npr.org' },
  { id: 'npr-national', url: 'https://feeds.npr.org/1003/rss.xml', name: 'NPR', domain: 'npr.org', us: true },
  { id: 'npr-politics', url: 'https://feeds.npr.org/1014/rss.xml', name: 'NPR', domain: 'npr.org', us: true },
  { id: 'npr-science', url: 'https://feeds.npr.org/1007/rss.xml', name: 'NPR', domain: 'npr.org', hint: 'science' },
  { id: 'aljazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera', domain: 'aljazeera.com' },
  { id: 'guardian-world', url: 'https://www.theguardian.com/world/rss', name: 'The Guardian', domain: 'theguardian.com' },
  { id: 'dw', url: 'https://rss.dw.com/rdf/rss-en-world', name: 'DW', domain: 'dw.com' },
  { id: 'france24', url: 'https://www.france24.com/en/rss', name: 'France 24', domain: 'france24.com' },
  { id: 'un-news', url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', name: 'UN News', domain: 'news.un.org' },
  { id: 'pbs', url: 'https://www.pbs.org/newshour/feeds/rss/headlines', name: 'PBS News', domain: 'pbs.org', us: true },
  { id: 'cbc-world', url: 'https://www.cbc.ca/webfeed/rss/rss-world', name: 'CBC News', domain: 'cbc.ca' },
  { id: 'espn', url: 'https://www.espn.com/espn/rss/news', name: 'ESPN', domain: 'espn.com', hint: 'sports' },
  { id: 'nasa', url: 'https://www.nasa.gov/news-release/feed/', name: 'NASA', domain: 'nasa.gov', hint: 'science', us: true },
  { id: 'space', url: 'https://www.space.com/feeds/all', name: 'Space.com', domain: 'space.com', hint: 'science' },
];

// Topic searches that surface "big" or "cool" stories anywhere in the world.
export const TOPIC_QUERIES = [
  '"White House"', 'Congress', '"Supreme Court"', '"United States"', 'ceasefire', 'protests', 'election results',
  'earthquake', 'hurricane OR typhoon OR cyclone', 'wildfire', 'volcano', 'flooding',
  '"scientists" discover', '"rocket launch"', 'NASA', 'archaeologists', 'festival', 'UNESCO', 'museum',
  '"World Cup"', 'Olympics', '"Grand Prix"', 'championship', '"Premier League"',
];

const T1 = ['apnews.com', 'reuters.com', 'bbc.com', 'bbc.co.uk', 'npr.org', 'pbs.org', 'nytimes.com', 'washingtonpost.com', 'wsj.com', 'bloomberg.com', 'ft.com', 'economist.com', 'theguardian.com', 'aljazeera.com', 'dw.com', 'france24.com', 'news.un.org', 'afp.com', 'nasa.gov'];
const T2 = ['cnn.com', 'abcnews.go.com', 'abcnews.com', 'cbsnews.com', 'nbcnews.com', 'foxnews.com', 'usatoday.com', 'axios.com', 'politico.com', 'politico.eu', 'thehill.com', 'latimes.com', 'time.com', 'theatlantic.com', 'cnbc.com', 'propublica.org', 'semafor.com', 'marketwatch.com',
  'espn.com', 'cbssports.com', 'nbcsports.com', 'foxsports.com', 'si.com', 'skysports.com', 'nfl.com', 'nba.com', 'mlb.com', 'nhl.com', 'olympics.com', 'fifa.com', 'uefa.com', 'formula1.com',
  'cbc.ca', 'abc.net.au', 'scmp.com', 'japantimes.co.jp', 'thehindu.com', 'indianexpress.com', 'hindustantimes.com', 'timesofindia.indiatimes.com', 'dawn.com', 'straitstimes.com', 'channelnewsasia.com', 'koreaherald.com', 'koreatimes.co.kr', 'yna.co.kr', 'asia.nikkei.com',
  'kyivindependent.com', 'timesofisrael.com', 'haaretz.com', 'euronews.com', 'rferl.org', 'voanews.com', 'rfi.fr', 'lemonde.fr', 'spiegel.de', 'independent.co.uk', 'telegraph.co.uk', 'thetimes.com', 'news.sky.com', 'irishtimes.com', 'rte.ie',
  'africanews.com', 'theeastafrican.co.ke', 'nation.africa', 'premiumtimesng.com', 'news24.com', 'dailymaverick.co.za', 'mercopress.com', 'batimes.com.ar', 'mexiconewsdaily.com', 'smh.com.au', 'nzherald.co.nz', 'rnz.co.nz', 'globalnews.ca', 'ctvnews.ca', 'theglobeandmail.com',
  'space.com', 'science.org', 'nature.com', 'scientificamerican.com', 'newscientist.com', 'nationalgeographic.com', 'smithsonianmag.com', 'livescience.com', 'arstechnica.com', 'theverge.com',
  'variety.com', 'hollywoodreporter.com', 'billboard.com', 'rollingstone.com', 'weather.com', 'foxweather.com'];

const BLOCK = new Set(['wnd.com', 'wsws.org']);
const LOCAL_TV = /^(?:[kw][a-z]{2,3}(?:tv)?\d{0,2}|(?:abc|nbc|cbs|fox)\d{1,2}[a-z]*|\d{1,2}(?:abc|nbc|cbs|news)[a-z]*|[a-z]{4,12}\d{1,2})\.(?:com|org|tv)$/;

const tier = new Map([...T1.map((d) => [d, 3]), ...T2.map((d) => [d, 2])]);

export function host(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export function trustOf(dom, q, outletStates) {
  if (!dom || BLOCK.has(dom) || /wire\.usatoday\.com$/.test(dom)) return null;
  const parts = dom.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const cand = parts.slice(i).join('.');
    if (tier.has(cand)) return { w: tier.get(cand) };
    if (outletStates.has(cand)) return { w: 1.5, st: outletStates.get(cand) };
  }
  if (q?.startsWith('s:') && LOCAL_TV.test(dom)) return { w: 1, local: true };
  return null;
}

// Headlines that are filler, not news.
const BLOCKED = [
  /^(live|watch|video|photos?|in pictures|opinion|quiz|podcast|listen|newsletter|sponsored)\b/i,
  /\b(horoscope|crossword|wordle|connections hints|coupon|promo code|recipes?|obituar\w*|lottery|powerball|mega millions)\b/i,
  /\b(how to watch|where to watch|live stream|livestream|what time|tv channel|injury report|best bets|expert picks|picks against the spread|odds and|odds,|predictions? and|mock draft|power rankings|fantasy football|fantasy baseball|player props)\b/i,
  /\b(deals? of the|best .{0,30} to buy|things to do|week in review|letters to the editor|stock price|shares (rise|fall|jump|slide)|traffic alert|weather forecast)\b/i,
  /\b(ranked|ranking every|top \d+ )\b/i,
];
export const isBlockedTitle = (t) => t.length < 18 || BLOCKED.some((r) => r.test(t));
