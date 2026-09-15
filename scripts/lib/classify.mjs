// Keyword-based category + importance heuristics.
const RX = {
  sports: /\b(NFL|NBA|MLB|NHL|WNBA|MLS|NCAA|FIFA|UEFA|World Cup|Olympics?|Paralympics?|Grand Prix|F1|Formula 1|Premier League|Champions League|La Liga|Serie A|Bundesliga|touchdowns?|quarterback|playoffs?|tournament|championship|head coach|season opener|preseason|innings|home runs?|goalkeeper|striker|tennis|golf|PGA|LPGA|Ryder Cup|UFC|boxing|cricket|rugby|marathon|Super Bowl|Stanley Cup|World Series|Wimbledon|US Open|free agent|MVP|hat-trick|semifinals?|quarterfinals?|Heisman|medals?|match|scores?|beat|defeat|win over|upsets?|stuns?|rout\w*|comeback|rivalry|\d{2}-\d{1,2})\b/gi,
  disaster: /\b(earthquakes?|quake|tsunami|hurricanes?|typhoons?|cyclones?|tornado(es)?|floods?|flooding|wildfires?|bushfires?|volcano|volcanic|eruption|landslides?|mudslides?|drought|heatwave|heat wave|monsoon|blizzard|avalanche|tropical storm|evacuat\w*|state of emergency|famine|outbreak|epidemic|cholera|ebola|mpox|capsiz\w*|sinks|sank|shipwreck|search and rescue|rescuers|derail\w*|explosion|blast|building collapse|bridge collapse)\b/gi,
  conflict: /\b(war|wartime|military|troops|missiles?|drones?|airstrikes?|air strikes?|shelling|bombing|bombed|bombardment|ceasefire|truce|invasion|invade\w*|offensive|hostages?|soldiers|militants?|militia|rebels?|insurgents?|jihadists?|terrorist|terror attack|coup|armed forces|front ?line|annex\w*|clashes|gunmen|massacre|genocide|nuclear weapons?|nuclear deterren\w*|defen[cs]e ministry|defen[cs]e spending|strikes on|attacks?|Hamas|Hezbollah|Houthis?|IDF|NATO|warships?|navy|sanctions|Pentagon)\b/gi,
  space: /\b(NASA|SpaceX|Blue Origin|Rocket Lab|Starship|Falcon 9|Falcon Heavy|New Glenn|Artemis|ESA|ISRO|JAXA|Roscosmos|CNSA|Tiangong|Shenzhou|Axiom Space|Firefly Aerospace|Intuitive Machines|Planet Labs|Starlink|Kuiper|rocket launch|liftoff|lift-off|spacecraft|spaceflight|spacewalk|space station|ISS|satellites?|telescope|James Webb|JWST|Hubble|Vera Rubin|astronauts?|cosmonauts?|taikonauts?|asteroids?|comets?|meteors?|meteorites?|Mars|Martian|moon|lunar|Jupiter|Saturn|Venus|Neptune|Uranus|Pluto|galax(y|ies)|black holes?|exoplanets?|nebulae?|supernovae?|solar flares?|solar storms?|geomagnetic|auroras?|northern lights|orbit(al|ing|s)?|cosmic|astronom\w*|astrophysic\w*|dark matter|dark energy|Big Bang|Voyager|Perseverance|Curiosity rover|Europa Clipper|eclipse)\b/gi,
  science: /\b(scientists?|researchers?|study|discover(y|ed|s)?|fossils?|species|dinosaurs?|archaeolog\w*|ancient|climate change|global warming|artificial intelligence|AI|quantum|vaccines?|breakthrough|genome|physics|robot\w*)\b/gi,
  politics: /\b(elections?|electoral|vote[sd]?|voters|voting|polls?|parliament\w*|president\w*|prime minister|premier|senate|senators?|congress\w*|governor|legislature|lawmakers|legislation|minister|cabinet|campaign|ballot|referendum|supreme court|court|judge|impeach\w*|opposition|protests?|protesters|White House|Trump|Republicans?|Democrats?|GOP|diplomat\w*|summit|treaty|immigration|deport\w*|shutdown|policy|talks|negotiat\w*|alliance|EU|far right|far-right|midterms?|mayor|parties|party)\b/gi,
  business: /\b(economy|economic|inflation|recession|GDP|stocks?|markets?|Wall Street|Dow|Nasdaq|tariffs?|trade deal|trade war|central bank|interest rates?|Federal Reserve|jobs report|unemployment|layoffs|merger|acquisition|IPO|earnings|revenue|billion|startup|oil prices|OPEC|crypto\w*|bitcoin|CEO|Nvidia|Apple|Tesla)\b/gi,
  culture: /\b(festival|film|movie|box office|music|concert|tour|album|song|singer|rapper|museum|exhibition|art|artist|fashion|celebrity|Emmys?|Oscars?|Grammys?|awards?|book|novel|author|heritage|UNESCO|royal|King Charles|pope|Vatican|tourism|tourists|restaurant|chef|Broadway|Netflix|anniversary|celebrat\w*|parade|zoo|wildlife|whale|panda)\b/gi,
};
const ORDER = ['sports', 'disaster', 'conflict', 'space', 'science', 'politics', 'business', 'culture'];
const WEIGHT = { sports: 1, disaster: 1.6, conflict: 1.4, space: 2, science: 1.1, politics: 1, business: 0.9, culture: 0.9 };

// Unmistakably-space headlines are kept even when they name no place on Earth.
export const SPACE_STRONG = /\b(NASA|SpaceX|Blue Origin|Rocket Lab|Starship|Falcon 9|New Glenn|Artemis|ESA|ISRO|JAXA|Roscosmos|Tiangong|Shenzhou|Axiom Space|Firefly Aerospace|Intuitive Machines|Planet Labs|spacecraft|spacewalk|space station|telescope|James Webb|JWST|Hubble|Vera Rubin|astronauts?|asteroids?|comets?|exoplanets?|galax(y|ies)|black holes?|nebulae?|supernovae?|solar flares?|geomagnetic storm|astronom\w*|Mars rover|lunar|Voyager|Europa Clipper)\b/i;
const SPORTS_DOMAINS = /(espn|cbssports|nbcsports|foxsports|si\.com|skysports|nfl\.com|nba\.com|mlb\.com|nhl\.com|olympics|fifa|uefa|formula1)/;

export function classify(titles, doms, hints) {
  const text = titles.join(' \n ');
  const score = {};
  for (const c of ORDER) score[c] = (text.match(RX[c]) || []).length * WEIGHT[c];
  const sportsDom = doms.filter((d) => SPORTS_DOMAINS.test(d)).length;
  score.sports += sportsDom * 2;
  for (const h of hints) if (h) score[h] = (score[h] || 0) + 2;
  let best = 'general', bestScore = 0.9;
  for (const c of ORDER) if (score[c] > bestScore) { best = c; bestScore = score[c]; }
  return best;
}

const MAJOR = /\b(killed|dead|deaths|death toll|dozens|hundreds|thousands|massive|historic|record|first[- ]ever|unprecedented|emergency|resigns?|ousted|elected|wins|won|champions?|landmark|crisis|collapse|surrender|peace deal|breakthrough)\b/i;
const BLOTTER = /\b(arrested|charged|sentenced|pleads?|stabbing|crash|police say|deputies|missing|found dead|robbery|burglary|DUI|homicide|lawsuit|sues)\b/i;

export function importance(title, nSources) {
  let b = 0;
  if (MAJOR.test(title)) b += 1.5;
  if (BLOTTER.test(title) && nSources < 3) b -= 1.5;
  return b;
}
