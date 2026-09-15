# World Pulse

A 3D interactive globe of the past week's important and interesting events — world news, conflicts, disasters, science & space, sports, and culture — from trusted sources. Click a country for its stories; the U.S. has a national view plus every state.

**Live:** https://nickashley4.github.io/world-pulse/

## Sources
- **Curated feeds:** BBC, NPR, PBS, The Guardian, Al Jazeera, DW, France 24, UN News, CBC, ESPN, NASA, Space.com
- **Discovery:** Google News search per country/state, filtered to an allowlist of trusted outlets (AP, Reuters, NYT, WSJ, Bloomberg, major networks, vetted state newspapers & public radio)
- **Live layers:** USGS earthquakes (M4.5+), NASA EONET wildfires/storms/volcanoes

Stories are geolocated from headlines, clustered across outlets, ranked by how many trusted sources cover them, and capped per place per day (3 per country/state, 6 national).

## Refresh data
```sh
npm install
npm run publish-data   # refresh + commit + push
```
Or run the **Refresh data** workflow from the GitHub Actions tab.

## Local
```sh
npm run refresh && npm run dev   # http://localhost:8080
```
