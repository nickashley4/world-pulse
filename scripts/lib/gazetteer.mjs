// Place names → place keys. Countries come from the world-countries dataset;
// US states, cities, teams and outlets are curated here.
import { createRequire } from 'node:module';
const countries = createRequire(import.meta.url)('world-countries');

// [abbr, name, fips, lat, lng, aliases (cities/teams/landmarks), state outlets]
export const STATES = [
  ['AL', 'Alabama', '01', 32.8, -86.8, ['Birmingham', 'Montgomery', 'Huntsville', 'Crimson Tide', 'Auburn'], ['al.com', 'montgomeryadvertiser.com', 'alabamareflector.com']],
  ['AK', 'Alaska', '02', 64.2, -152.5, ['Anchorage', 'Juneau', 'Fairbanks', 'Denali'], ['adn.com', 'alaskapublic.org', 'alaskabeacon.com']],
  ['AZ', 'Arizona', '04', 34.2, -111.7, ['Phoenix', 'Tucson', 'Scottsdale', 'Tempe', 'Flagstaff', 'Sedona', 'Grand Canyon', 'Arizona Cardinals', 'Diamondbacks', 'Phoenix Suns', 'Phoenix Mercury'], ['azcentral.com', 'kjzz.org', 'azmirror.com', 'azfamily.com']],
  ['AR', 'Arkansas', '05', 34.9, -92.4, ['Little Rock', 'Bentonville', 'Razorbacks'], ['arkansasonline.com', 'arkansasadvocate.com']],
  ['CA', 'California', '06', 37.2, -119.5, ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Oakland', 'Fresno', 'Long Beach', 'Anaheim', 'Malibu', 'Palo Alto', 'Pasadena', 'Santa Monica', 'Hollywood', 'Silicon Valley', 'Bay Area', 'Yosemite', 'Lakers', 'Clippers', 'Golden State', '49ers', 'Dodgers', 'Padres', 'Chargers', 'Los Angeles Rams', 'LA Rams', 'Sacramento Kings', 'Los Angeles Kings', 'San Jose Sharks', 'Anaheim Ducks', 'San Francisco Giants', 'Los Angeles Angels', 'Los Angeles Sparks', 'LAFC', 'LA Galaxy', 'UCLA', 'Stanford', 'Berkeley', 'Newsom'], ['latimes.com', 'sfchronicle.com', 'calmatters.org', 'sacbee.com', 'mercurynews.com', 'sandiegouniontribune.com', 'kqed.org', 'laist.com']],
  ['CO', 'Colorado', '08', 39.0, -105.5, ['Denver', 'Boulder', 'Colorado Springs', 'Broncos', 'Nuggets', 'Rockies', 'Colorado Avalanche'], ['denverpost.com', 'coloradosun.com', 'cpr.org', 'coloradonewsline.com']],
  ['CT', 'Connecticut', '09', 41.6, -72.7, ['Hartford', 'New Haven', 'Stamford', 'Bridgeport', 'UConn', 'Yale'], ['ctmirror.org', 'courant.com', 'ctinsider.com', 'ctpublic.org']],
  ['DE', 'Delaware', '10', 39.0, -75.5, ['Wilmington, Del'], ['delawareonline.com', 'spotlightdelaware.org', 'whyy.org']],
  ['DC', 'Washington, D.C.', '11', 38.9, -77.03, ['Washington, DC', 'D.C.', 'Commanders', 'Wizards', 'Washington Capitals', 'Washington Nationals', 'Mystics'], ['wamu.org', 'dcist.com']],
  ['FL', 'Florida', '12', 28.6, -82.4, ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Tallahassee', 'Fort Lauderdale', 'St. Petersburg, Fla', 'Key West', 'Everglades', 'Cape Canaveral', 'Kennedy Space Center', 'Dolphins', 'Buccaneers', 'Jaguars', 'Miami Heat', 'Orlando Magic', 'Tampa Bay Lightning', 'Florida Panthers', 'Tampa Bay Rays', 'Marlins', 'Inter Miami', 'Gators', 'Seminoles', 'DeSantis'], ['tampabay.com', 'miamiherald.com', 'orlandosentinel.com', 'floridaphoenix.com', 'wusf.org', 'wlrn.org', 'tallahassee.com']],
  ['GA', 'Georgia', '13', 32.7, -83.4, ['Atlanta', 'Savannah', 'Athens, Ga', 'Falcons', 'Braves', 'Atlanta Hawks', 'Atlanta Dream', 'Atlanta United', 'Georgia Tech'], ['ajc.com', 'gpb.org', 'georgiarecorder.com', 'wabe.org']],
  ['HI', 'Hawaii', '15', 20.8, -156.3, ['Honolulu', 'Maui', 'Oahu', 'Kauai', 'Kilauea', 'Mauna Loa', 'Pearl Harbor'], ['staradvertiser.com', 'civilbeat.org', 'hawaiipublicradio.org', 'hawaiinewsnow.com']],
  ['ID', 'Idaho', '16', 44.4, -114.6, ['Boise'], ['idahostatesman.com', 'idahocapitalsun.com', 'boisestatepublicradio.org']],
  ['IL', 'Illinois', '17', 40.0, -89.2, ['Chicago', 'Springfield, Ill', 'Chicago Bears', 'Chicago Bulls', 'Cubs', 'White Sox', 'Blackhawks', 'Chicago Sky', 'Northwestern', 'Pritzker'], ['chicagotribune.com', 'suntimes.com', 'wbez.org', 'capitolnewsillinois.com', 'blockclubchicago.org']],
  ['IN', 'Indiana', '18', 39.9, -86.3, ['Indianapolis', 'Fort Wayne', 'South Bend', 'Colts', 'Pacers', 'Indiana Fever', 'Notre Dame', 'Hoosiers', 'Purdue', 'Indy 500', 'Indianapolis 500'], ['indystar.com', 'indianacapitalchronicle.com', 'wfyi.org']],
  ['IA', 'Iowa', '19', 42.1, -93.5, ['Des Moines', 'Cedar Rapids', 'Iowa City', 'Hawkeyes', 'Iowa State'], ['desmoinesregister.com', 'iowacapitaldispatch.com', 'thegazette.com', 'iowapublicradio.org']],
  ['KS', 'Kansas', '20', 38.5, -98.4, ['Wichita', 'Topeka', 'Overland Park', 'Jayhawks', 'Kansas State'], ['kansasreflector.com', 'kansas.com', 'kcur.org']],
  ['KY', 'Kentucky', '21', 37.5, -85.3, ['Louisville', 'Lexington, Ky', 'Kentucky Derby', 'Churchill Downs'], ['courier-journal.com', 'kentucky.com', 'kentuckylantern.com', 'lpm.org']],
  ['LA', 'Louisiana', '22', 31.0, -92.0, ['New Orleans', 'Baton Rouge', 'Shreveport', 'New Orleans Saints', 'Pelicans', 'LSU'], ['nola.com', 'theadvocate.com', 'lailluminator.com', 'wwno.org']],
  ['ME', 'Maine', '23', 45.3, -69.2, ['Bangor', 'Portland, Maine', 'Acadia'], ['pressherald.com', 'bangordailynews.com', 'mainepublic.org', 'mainemorningstar.com']],
  ['MD', 'Maryland', '24', 39.0, -76.8, ['Baltimore', 'Annapolis', 'Ravens', 'Orioles'], ['baltimoresun.com', 'thebaltimorebanner.com', 'marylandmatters.org', 'wypr.org']],
  ['MA', 'Massachusetts', '25', 42.3, -71.8, ['Boston', 'Cambridge, Mass', 'Worcester', 'Harvard', 'Patriots', 'Celtics', 'Red Sox', 'Bruins', 'Cape Cod', 'Nantucket'], ['bostonglobe.com', 'wbur.org', 'boston.com', 'masslive.com', 'wgbh.org']],
  ['MI', 'Michigan', '26', 44.3, -85.4, ['Detroit', 'Lansing', 'Grand Rapids', 'Ann Arbor', 'Flint', 'Detroit Lions', 'Pistons', 'Detroit Tigers', 'Red Wings', 'Wolverines', 'Michigan State'], ['freep.com', 'detroitnews.com', 'mlive.com', 'bridgemi.com', 'michiganadvance.com', 'michiganradio.org']],
  ['MN', 'Minnesota', '27', 46.3, -94.3, ['Minneapolis', 'St. Paul', 'Duluth', 'Vikings', 'Timberwolves', 'Minnesota Twins', 'Minnesota Wild', 'Minnesota Lynx'], ['startribune.com', 'mprnews.org', 'minnesotareformer.com', 'sahanjournal.com']],
  ['MS', 'Mississippi', '28', 32.7, -89.7, ['Biloxi', 'Gulfport', 'Tupelo', 'Jackson, Miss', 'Ole Miss', 'Mississippi State'], ['clarionledger.com', 'mississippitoday.org', 'mpbonline.org']],
  ['MO', 'Missouri', '29', 38.4, -92.5, ['St. Louis', 'Kansas City', 'Springfield, Mo', 'Chiefs', 'Royals', 'St. Louis Cardinals', 'St. Louis Blues', 'Mizzou'], ['stltoday.com', 'kansascity.com', 'missouriindependent.com', 'stlpr.org']],
  ['MT', 'Montana', '30', 47.0, -109.6, ['Billings', 'Missoula', 'Bozeman', 'Glacier National Park'], ['dailymontanan.com', 'mtpr.org', 'montanafreepress.org']],
  ['NE', 'Nebraska', '31', 41.5, -99.8, ['Omaha', 'Lincoln, Neb', 'Cornhuskers', 'Huskers'], ['omaha.com', 'nebraskaexaminer.com', 'nebraskapublicmedia.org']],
  ['NV', 'Nevada', '32', 39.3, -116.6, ['Las Vegas', 'Reno', 'Carson City', 'Raiders', 'Golden Knights', 'Las Vegas Aces'], ['reviewjournal.com', 'thenevadaindependent.com', 'nevadacurrent.com', 'knpr.org']],
  ['NH', 'New Hampshire', '33', 43.7, -71.6, ['Concord, N.H', 'Manchester, N.H', 'Nashua'], ['unionleader.com', 'nhpr.org', 'newhampshirebulletin.com']],
  ['NJ', 'New Jersey', '34', 40.1, -74.7, ['Newark', 'Jersey City', 'Trenton', 'Atlantic City', 'Hoboken', 'Princeton', 'Rutgers', 'New Jersey Devils', 'MetLife Stadium'], ['nj.com', 'northjersey.com', 'newjerseymonitor.com', 'njspotlightnews.org']],
  ['NM', 'New Mexico', '35', 34.4, -106.1, ['Albuquerque', 'Santa Fe', 'Las Cruces', 'Roswell', 'Los Alamos'], ['abqjournal.com', 'sourcenm.com', 'santafenewmexican.com', 'kunm.org']],
  ['NY', 'New York', '36', 42.9, -75.5, ['New York City', 'NYC', 'Manhattan', 'Brooklyn', 'Bronx', 'Queens', 'Staten Island', 'Long Island', 'Albany', 'Buffalo', 'Syracuse', 'Broadway', 'Central Park', 'Times Square', 'US Open', 'Yankees', 'Mets', 'Knicks', 'Brooklyn Nets', 'Buffalo Bills', 'Sabres', 'New York Rangers', 'Islanders', 'New York Liberty', 'New York Giants', 'New York Jets', 'Hochul', 'Mamdani'], ['gothamist.com', 'timesunion.com', 'syracuse.com', 'buffalonews.com', 'nysfocus.com', 'newsday.com', 'ny1.com', 'thecity.nyc']],
  ['NC', 'North Carolina', '37', 35.5, -79.4, ['Charlotte', 'Raleigh', 'Durham', 'Asheville', 'Greensboro', 'Chapel Hill', 'Outer Banks', 'Carolina Panthers', 'Charlotte Hornets', 'Carolina Hurricanes', 'Tar Heels', 'Wake Forest'], ['newsobserver.com', 'charlotteobserver.com', 'wral.com', 'ncnewsline.com', 'wunc.org']],
  ['ND', 'North Dakota', '38', 47.5, -100.5, ['Fargo', 'Bismarck', 'Grand Forks'], ['inforum.com', 'northdakotamonitor.com', 'bismarcktribune.com', 'prairiepublic.org']],
  ['OH', 'Ohio', '39', 40.3, -82.8, ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton', 'East Palestine', 'Browns', 'Bengals', 'Cavaliers', 'Cavs', 'Guardians', 'Cincinnati Reds', 'Buckeyes', 'Ohio State', 'Blue Jackets'], ['cleveland.com', 'dispatch.com', 'cincinnati.com', 'ohiocapitaljournal.com', 'signalohio.org', 'wosu.org']],
  ['OK', 'Oklahoma', '40', 35.6, -97.5, ['Oklahoma City', 'Tulsa', 'Oklahoma City Thunder', 'OKC', 'Sooners', 'Oklahoma State'], ['oklahoman.com', 'tulsaworld.com', 'oklahomavoice.com', 'kosu.org']],
  ['OR', 'Oregon', '41', 43.9, -120.6, ['Portland', 'Eugene', 'Salem, Ore', 'Trail Blazers', 'Portland Timbers', 'Crater Lake'], ['oregonlive.com', 'opb.org', 'oregoncapitalchronicle.com']],
  ['PA', 'Pennsylvania', '42', 40.9, -77.8, ['Philadelphia', 'Philly', 'Pittsburgh', 'Harrisburg', 'Allentown', 'Scranton', 'Philadelphia Eagles', 'Steelers', '76ers', 'Sixers', 'Phillies', 'Pittsburgh Pirates', 'Penguins', 'Flyers', 'Penn State'], ['inquirer.com', 'post-gazette.com', 'spotlightpa.org', 'penncapital-star.com', 'wesa.fm']],
  ['RI', 'Rhode Island', '44', 41.7, -71.5, ['Providence', 'Newport, R.I'], ['providencejournal.com', 'rhodeislandcurrent.com', 'thepublicsradio.org']],
  ['SC', 'South Carolina', '45', 33.9, -80.9, ['Charleston', 'Columbia, S.C', 'Greenville, S.C', 'Myrtle Beach', 'Hilton Head', 'Clemson', 'Gamecocks'], ['postandcourier.com', 'thestate.com', 'scdailygazette.com', 'greenvilleonline.com']],
  ['SD', 'South Dakota', '46', 44.4, -100.2, ['Sioux Falls', 'Rapid City', 'Mount Rushmore', 'Sturgis'], ['argusleader.com', 'southdakotasearchlight.com', 'sdpb.org']],
  ['TN', 'Tennessee', '47', 35.9, -86.4, ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Titans', 'Grizzlies', 'Predators', 'Volunteers', 'Vanderbilt'], ['tennessean.com', 'commercialappeal.com', 'tennesseelookout.com', 'knoxnews.com', 'wpln.org']],
  ['TX', 'Texas', '48', 31.5, -99.3, ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth', 'El Paso', 'Galveston', 'Corpus Christi', 'Starbase', 'Boca Chica', 'Cowboys', 'Houston Texans', 'Astros', 'Texas Rangers', 'Mavericks', 'Houston Rockets', 'San Antonio Spurs', 'Dallas Stars', 'Longhorns', 'Aggies', 'Texas A&M', 'Baylor', 'TCU'], ['texastribune.org', 'houstonchronicle.com', 'dallasnews.com', 'expressnews.com', 'kut.org', 'houstonpublicmedia.org', 'statesman.com']],
  ['UT', 'Utah', '49', 39.3, -111.7, ['Salt Lake City', 'Provo', 'Ogden', 'Park City', 'Zion National Park', 'Utah Jazz', 'BYU'], ['sltrib.com', 'deseret.com', 'ksl.com', 'utahnewsdispatch.com', 'kuer.org']],
  ['VT', 'Vermont', '50', 44.0, -72.7, ['Burlington, Vt', 'Montpelier'], ['vtdigger.org', 'vermontpublic.org', 'sevendaysvt.com']],
  ['VA', 'Virginia', '51', 37.5, -78.8, ['Richmond', 'Norfolk', 'Virginia Beach', 'Arlington, Va', 'Alexandria, Va', 'Charlottesville', 'Virginia Tech', 'Quantico'], ['richmond.com', 'cardinalnews.org', 'pilotonline.com', 'virginiamercury.com', 'vpm.org']],
  ['WA', 'Washington', '53', 47.4, -120.5, ['Washington state', 'Washington State', 'Seattle', 'Spokane', 'Tacoma', 'Mount Rainier', 'Seahawks', 'Mariners', 'Kraken', 'Sounders', 'Seattle Storm'], ['seattletimes.com', 'kuow.org', 'washingtonstatestandard.com', 'spokesman.com', 'cascadepbs.org']],
  ['WV', 'West Virginia', '54', 38.6, -80.6, ['Morgantown', 'Huntington, W.Va', 'Charleston, W.Va', 'Mountaineers'], ['wvgazettemail.com', 'wvpublic.org', 'westvirginiawatch.com', 'mountainstatespotlight.org']],
  ['WI', 'Wisconsin', '55', 44.6, -89.9, ['Milwaukee', 'Madison, Wis', 'Green Bay', 'Packers', 'Milwaukee Bucks', 'Brewers', 'Badgers'], ['jsonline.com', 'wpr.org', 'wisconsinexaminer.com', 'madison.com']],
  ['WY', 'Wyoming', '56', 43.0, -107.5, ['Cheyenne', 'Casper', 'Jackson Hole', 'Yellowstone', 'Grand Teton'], ['wyofile.com', 'trib.com', 'wyomingpublicmedia.org', 'cowboystatedaily.com']],
];

// Strong generic US aliases vs. federal-government signals (see placement rules in refresh.mjs).
export const US_GENERIC = new Set(['U.S.', 'US', 'USA', 'United States', 'Americans']);
const US_ALIASES = [...US_GENERIC, 'White House', 'Capitol Hill', 'Congress', 'Pentagon', 'FBI', 'CIA', 'FDA', 'CDC', 'EPA', 'ICE', 'FEMA', 'NOAA', 'DOJ', 'Justice Department', 'State Department', 'Homeland Security', 'Secret Service', 'Federal Reserve', 'Supreme Court', 'Trump', 'Vance', 'Rubio', 'Hegseth', 'Medicare', 'Medicaid', 'Social Security', 'Wall Street', 'Senate Republicans', 'Senate Democrats', 'House Republicans', 'House Democrats', 'GOP', 'National Guard'];

// Extra aliases for countries (cities, leaders, groups, sports).
const EXTRA = {
  GBR: ['UK', 'U.K.', 'Britain', 'British', 'England', 'Scotland', 'Scottish', 'Wales', 'Welsh', 'Northern Ireland', 'London', 'Manchester', 'Liverpool', 'Birmingham, England', 'Downing Street', 'Starmer', 'King Charles', 'Premier League', 'Wimbledon', 'Arsenal', 'Chelsea', 'Manchester United', 'Manchester City', 'Tottenham', 'Silverstone'],
  RUS: ['Kremlin', 'Putin', 'Moscow', 'St Petersburg'],
  UKR: ['Kyiv', 'Kiev', 'Zelensky', 'Zelenskyy', 'Donbas', 'Kharkiv', 'Odesa', 'Crimea', 'Zaporizhzhia'],
  ISR: ['Tel Aviv', 'Jerusalem', 'Netanyahu', 'IDF', 'Knesset'],
  PSE: ['Gaza', 'West Bank', 'Hamas', 'Palestinian', 'Palestinians', 'Ramallah'],
  LBN: ['Hezbollah', 'Beirut'],
  YEM: ['Houthi', 'Houthis', 'Sanaa'],
  CHN: ['Beijing', 'Shanghai', 'Xi Jinping', 'Chinese'],
  HKG: ['Hong Kong'],
  TWN: ['Taipei', 'Taiwanese'],
  KOR: ['Seoul', 'South Korean', 'Korea'],
  PRK: ['Pyongyang', 'Kim Jong Un', 'North Korean'],
  IRN: ['Tehran', 'Khamenei', 'Iranian'],
  IND: ['New Delhi', 'Delhi', 'Mumbai', 'Bengaluru', 'Kashmir', 'Modi', 'Indian Premier League', 'IPL'],
  PAK: ['Islamabad', 'Karachi', 'Lahore'],
  TUR: ['Türkiye', 'Turkiye', 'Istanbul', 'Ankara', 'Erdogan', 'Erdoğan'],
  FRA: ['Paris', 'Marseille', 'Macron', 'Élysée', 'Tour de France', 'Roland Garros', 'Paris Saint-Germain', 'PSG', 'Ligue 1'],
  DEU: ['Berlin', 'Munich', 'Frankfurt', 'Bundestag', 'Bayern Munich', 'Bundesliga'],
  ITA: ['Rome', 'Milan', 'Venice', 'Naples', 'Serie A', 'Juventus', 'Napoli', 'Inter Milan', 'AC Milan', 'Monza'],
  ESP: ['Madrid', 'Barcelona', 'Catalonia', 'La Liga', 'Real Madrid', 'Atletico Madrid'],
  BRA: ['Brasília', 'Brasilia', 'Rio de Janeiro', 'São Paulo', 'Sao Paulo', 'Lula'],
  ARG: ['Buenos Aires', 'Milei'],
  MEX: ['Mexico City', 'Guadalajara', 'Monterrey', 'Tijuana', 'Cancún', 'Cancun', 'Sheinbaum'],
  CAN: ['Ottawa', 'Toronto', 'Montreal', 'Vancouver', 'Quebec', 'Alberta', 'Ontario', 'British Columbia', 'Canadians'],
  AUS: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane', 'Aussie'],
  JPN: ['Tokyo', 'Osaka', 'Kyoto', 'Hokkaido', 'Okinawa'],
  COD: ['DR Congo', 'DRC', 'Democratic Republic of Congo', 'Democratic Republic of the Congo', 'Congo', 'Kinshasa', 'Goma'],
  COG: ['Republic of Congo', 'Brazzaville'],
  CIV: ['Ivory Coast', "Côte d'Ivoire"],
  CZE: ['Czech Republic', 'Czech', 'Prague'],
  MMR: ['Burma', 'Yangon'],
  SYR: ['Damascus', 'Aleppo'],
  SDN: ['Khartoum', 'Darfur'],
  EGY: ['Cairo'],
  SAU: ['Riyadh', 'Saudi', 'Jeddah', 'Mecca'],
  ARE: ['UAE', 'Dubai', 'Abu Dhabi', 'Emirati'],
  QAT: ['Doha'],
  AFG: ['Kabul', 'Taliban'],
  IRQ: ['Baghdad'],
  NGA: ['Lagos', 'Abuja'],
  KEN: ['Nairobi'],
  ETH: ['Addis Ababa'],
  ZAF: ['Johannesburg', 'Cape Town', 'Pretoria'],
  COL: ['Bogotá', 'Bogota'],
  CUB: ['Havana'],
  HTI: ['Port-au-Prince', 'Haitian'],
  PHL: ['Manila', 'Philippine', 'Filipino'],
  IDN: ['Jakarta', 'Bali'],
  THA: ['Bangkok'],
  VNM: ['Hanoi', 'Ho Chi Minh City'],
  NZL: ['Wellington', 'Auckland'],
  IRL: ['Dublin'],
  NLD: ['Amsterdam', 'The Hague', 'Dutch'],
  BEL: ['Brussels'],
  CHE: ['Geneva', 'Zurich', 'Davos'],
  AUT: ['Vienna'],
  POL: ['Warsaw'],
  GRC: ['Athens', 'Greek'],
  VAT: ['Vatican', 'Pope Leo'],
  DNK: ['Copenhagen'],
  GRL: ['Greenland', 'Nuuk'],
  GEO: ['Tbilisi', 'Georgian government', 'Georgian Dream'],
  JOR: ['Amman'],
  PRI: ['Puerto Rico', 'San Juan'],
  SGP: ['Singaporean'],
  VEN: ['Caracas'],
  MCO: ['Monte Carlo'],
};

// Aliases that should never place a story (outlet names etc.) or that are only weak evidence.
const IGNORE = ['New York Times', 'New York Post', 'Washington Post', 'Los Angeles Times', 'LA Times', 'Wall Street Journal', 'Chicago Tribune', 'Texas Tribune', 'Boston Globe', 'Denver Post', 'Houston Chronicle', 'Miami Herald', 'Times of India', 'Jerusalem Post', 'Japan Times', 'Moscow Times', 'South China Morning Post', 'Kyiv Independent', 'Indiana Jones', 'Paris Hilton', 'Jordan Love', 'Michael Jordan', 'New England', 'Latin America', 'South America', 'North America', 'Central America', 'Native American', 'Indian Ocean', 'Mexican-American', 'Georgia Bulldogs'];
const WEAK = new Set(['Jordan', 'Chad', 'Korea', 'Congo', 'Charleston', 'Portland', 'Richmond', 'Columbus', 'Aggies', 'Cowboys', 'Raiders', 'Chiefs', 'Titans', 'Patriots', 'Vikings', 'Falcons', 'Dolphins', 'Jaguars', 'Browns', 'Guardians', 'Volunteers', 'Wolverines', 'Mountaineers', 'Badgers', 'Predators', 'Penguins', 'Kraken', 'Thunder']);

// City aliases that are also common names or other places ("Colson Montgomery", "Birmingham,
// England"): weak, and unlike other weak aliases a Google News query for the city isn't enough to
// place a story. It takes a strong alias in the text or an outlet from that state.
const NAME_LIKE = new Set(['Montgomery', 'Auburn', 'Orlando', 'Savannah', 'Charlotte', 'Cleveland', 'Eugene', 'Austin', 'Casper', 'Raleigh', 'Lansing', 'Dayton', 'Durham', 'Flint', 'Billings', 'Reno', 'Providence', 'Birmingham', 'Stamford', 'Worcester', 'Bangor', 'Norfolk', 'Toledo', 'Memphis', 'Springfield']);
NAME_LIKE.forEach((a) => WEAK.add(a));
// Words that can precede a place in a Title Case headline without making it a person's name.
const LEAD = new Set('In At Near From To Of For On By Into Across Around Outside Inside Downtown North South East West Northern Southern Eastern Western Central Greater Metro Rural Suburban Northeast Northwest Southeast Southwest New Old Man Woman Teen Boy Girl Police Fire City Hits Rocks Slams Storm Flood Flooding Shooting Crash After Before Amid Over Leaves Kills Hits'.split(' '));
const STATE_NAMES = new Set(STATES.map((s) => s[1]));

const DEMONYM_SKIP = new Set(['American', 'Georgian', 'Dominican', 'Guinean', 'Congolese', 'Samoan', 'Virgin Islander', 'Micronesian', 'Chadian', 'Nigerien']);
const CAPITAL_SKIP = new Set(['Washington D.C.', 'Victoria', 'Kingston', 'Georgetown', 'Hamilton', 'Jamestown', 'Stanley', 'Plymouth', "Saint John's", 'Kingstown', 'Panama City', 'San José', 'Nassau', 'Castries', 'Basseterre', 'Roseau', 'Road Town', 'The Valley', 'Avarua', 'Palikir']);
const INCLUDE_NON_INDEPENDENT = new Set(['PSE', 'TWN', 'UNK', 'ESH', 'GRL', 'PRI', 'NCL', 'FLK', 'HKG']);

// Google News query overrides for ambiguous country names.
const QUERY_OVERRIDE = {
  GEO: 'Tbilisi OR "Georgian government"', JOR: 'Jordan Amman OR "Jordan\'s"', COD: '"DR Congo" OR "Democratic Republic of Congo"',
  COG: 'Brazzaville', PSE: 'Gaza OR "West Bank"', CHN: 'China', KOR: '"South Korea"', PRK: '"North Korea"', CHD: 'Chad',
  TCD: 'Chad N\'Djamena OR "Chad\'s"', GBR: '"United Kingdom" OR Britain', VAT: 'Vatican', HKG: '"Hong Kong"', UNK: 'Kosovo',
};

const COLLEGE_STATIC = new Set(['Crimson Tide', 'Auburn', 'Razorbacks', 'UCLA', 'Stanford', 'UConn', 'Gators', 'Seminoles', 'Georgia Tech', 'Northwestern', 'Notre Dame', 'Hoosiers', 'Purdue', 'Hawkeyes', 'Iowa State', 'Jayhawks', 'Kansas State', 'LSU', 'Wolverines', 'Michigan State', 'Ole Miss', 'Mississippi State', 'Mizzou', 'Cornhuskers', 'Huskers', 'Rutgers', 'Tar Heels', 'Wake Forest', 'Buckeyes', 'Ohio State', 'Sooners', 'Oklahoma State', 'Penn State', 'Clemson', 'Gamecocks', 'Volunteers', 'Vanderbilt', 'Longhorns', 'Aggies', 'Texas A&M', 'Baylor', 'TCU', 'BYU', 'Virginia Tech', 'Mountaineers', 'Badgers', 'Washington State']);

// extraAliases: [[alias, placeKey]] added with top priority (e.g. ranked college teams).
export function buildGazetteer(extraAliases = []) {
  const places = {};
  const alias = new Map(); // alias → key (null = ignore)
  const add = (a, key) => { if (a && a.length >= 2 && !alias.has(a)) alias.set(a, key); };
  const queries = [];

  IGNORE.forEach((a) => alias.set(a, null));
  extraAliases.forEach(([a, key]) => add(a, key));
  US_ALIASES.forEach((a) => add(a, 'c:USA'));

  // States first so "Georgia" etc. resolve to the state.
  for (const [ab, name, fips, lat, lng, al, outlets] of STATES) {
    const key = `s:${ab}`;
    places[key] = { n: name, t: 'state', ab, lat, lng, poly: `us${fips}`, outlets };
    if (ab !== 'WA') add(name, key); // bare "Washington" is ambiguous
    // College programs are placed only when ranked (added dynamically from the AP Top 25).
    al.filter((a) => !COLLEGE_STATIC.has(a)).forEach((a) => add(a, key));
    queries.push({ key, q: ab === 'DC' ? '"Washington, D.C."' : ab === 'WA' ? '"Washington state" OR Seattle' : `"${name}"` });
    // Second query on major cities + "governor" to deepen state coverage beyond one 100-item result page.
    const cities = al.filter((a) => !a.includes(',') && /^[A-Z][a-z]+( [A-Z][a-z]+)?$/.test(a)).slice(0, 3);
    queries.push({ key, q: `${[...cities, `${ab === 'DC' ? 'D.C.' : name} governor`].map((c) => `"${c}"`).join(' OR ')}` });
  }

  const list = countries.filter((c) => c.independent || c.unMember || INCLUDE_NON_INDEPENDENT.has(c.cca3));
  const priority = [];
  for (const c of list) {
    const key = `c:${c.cca3}`;
    const name = c.cca3 === 'UNK' ? 'Kosovo' : c.name.common;
    places[key] = { n: c.cca3 === 'USA' ? 'United States' : name, t: 'country', lat: c.latlng[0], lng: c.latlng[1], f: c.flag, poly: c.ccn3 || null, iso2: c.cca2 };
    (EXTRA[c.cca3] || []).forEach((a) => add(a, key));
    if (c.cca3 !== 'USA') queries.push({ key, q: QUERY_OVERRIDE[c.cca3] || `"${name}"` });
    priority.push(c);
  }
  places['c:USA'].lat = 39.5; places['c:USA'].lng = -98.35;
  for (const c of priority) if (c.cca3 !== 'GEO') add(c.name.common, `c:${c.cca3}`);
  for (const c of priority) {
    for (const cap of c.capital || []) if (cap.length >= 4 && !CAPITAL_SKIP.has(cap)) add(cap, `c:${c.cca3}`);
  }
  for (const c of priority) {
    const d = c.demonyms?.eng?.m;
    if (d && d.length >= 4 && !DEMONYM_SKIP.has(d) && !d.includes(' or ') && c.cca3 !== 'USA') add(d, `c:${c.cca3}`);
  }

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sorted = [...alias.keys()].sort((a, b) => b.length - a.length);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${sorted.map(esc).join('|')})(?![\\p{L}\\p{N}])`, 'gu');

  // Returns ordered matches [{key, alias, weak}]
  function geo(text) {
    const out = [];
    if (!text) return out;
    // In Title Case headlines every word is capitalized, so neighbouring capitals say nothing.
    const titleCase = !/(?<![\p{L}'’])\p{Ll}\p{L}{4,}/u.test(text);
    for (const m of text.matchAll(re)) {
      const a = m[1];
      const key = alias.get(a);
      if (!key) continue;
      const after = text.slice(m.index + a.length, m.index + a.length + 10);
      // "Montgomery County", "Orange Parish": a county named like a city, often in another state.
      if (key.startsWith('s:') && !STATE_NAMES.has(a) && /^ (County|Parish|Township)\b/.test(after)) continue;
      if (NAME_LIKE.has(a) && !titleCase) {
        // "Colson Montgomery", "Austin Reaves": preceded or followed by another capitalized name.
        const prev = text.slice(0, m.index).match(/([A-Z][\p{L}'’.-]+) $/u)?.[1];
        const next = after.match(/^ ([A-Z][\p{L}'’-]+)/u)?.[1];
        if ((prev && !LEAD.has(prev)) || (next && /^[A-Z][a-z]+$/.test(next) && !alias.has(`${a} ${next}`) && !LEAD.has(next))) continue;
      }
      out.push({ key, alias: a, weak: WEAK.has(a), nameLike: NAME_LIKE.has(a) });
    }
    return out;
  }

  const outletStates = new Map();
  for (const [ab, , , , , , outlets] of STATES) for (const d of outlets) {
    outletStates.set(d, [...(outletStates.get(d) || []), ab]);
  }

  return { places, geo, queries, outletStates, isAlias: (a) => alias.has(a), aliasList: () => [...alias.keys()] };
}
