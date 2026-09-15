# World Pulse

A 3D interactive globe of the past week's important and interesting events — world news, conflicts, disasters, science & space, sports, and culture — from trusted sources. Click a country for its stories; the U.S. has a national view plus every state.

**Live:** https://nickashley4.github.io/world-pulse/

## Sources
- **Curated feeds:** BBC, NPR, PBS, The Guardian, Al Jazeera, DW, France 24, UN News, CBC, ESPN, NASA, Space.com
- **Discovery:** Google News search per country/state, filtered to an allowlist of trusted outlets (AP, Reuters, NYT, WSJ, Bloomberg, major networks, vetted state newspapers & public radio)
- **Live layers:** USGS earthquakes (M4.5+), NASA EONET wildfires/storms/volcanoes
- **Space mode:** NASA APOD & NeoWs (asteroid flybys), NOAA SWPC (solar flares, Kp, aurora forecast), The Space Devs Launch Library (launches, people in space), NASA Exoplanet Archive (newly confirmed planets), live ISS orbit propagated from its TLE, plus space news from NASA, ESA, SpaceNews, NASASpaceflight, Spaceflight Now, Space.com, Universe Today. A **Discoveries** pop-up (`D`) profiles each new planet and sorts the week's black hole, stellar, comet and galaxy news. Set `NASA_API_KEY` to avoid DEMO_KEY rate limits.
- **College sports:** only AP Top 25 football and men's basketball teams (ESPN rankings, refreshed each run)

Stories are geolocated from headlines, clustered across outlets (with a second tf-idf merge pass for the same story told differently), ranked by how many trusted sources cover them, and softly capped per place per day (3 per country/state, 6 national, 8 space) — heavily covered stories can exceed the cap. Search (`/`) covers the whole week and filters the globe to matching places.

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
