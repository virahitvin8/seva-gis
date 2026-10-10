# SEVA·GIS

A browser based GIS workspace for exploring farm boundaries, satellite imagery, terrain and water infrastructure.

## What it does

- Save and manage farm locations and boundaries in the current browser.
- View Sentinel-2 imagery and spectral layers such as NDVI, NDMI, NDWI and NDRE.
- Inspect elevation, slope, drainage and terrain derived from Copernicus DEM data.
- Review weather and soil estimates, compare available satellite dates, and create reports.
- Measure on the map and add or remove borewell points and pipeline routes.

## Data and limits

Satellite imagery and terrain are fetched from Microsoft Planetary Computer. Weather forecasts come from Open-Meteo; soil estimates come from SoilGrids. Basemap availability depends on the map provider and network connection.

Satellite indices are calculated from the available imagery and can be affected by clouds, shadows, resolution and scene coverage. Terrain and soil outputs are estimates, not site surveys or field measurements. SEVA·GIS does not connect to government land registries, farm sensors or cloud account sync. Check results on the ground before making operational decisions.

## Run locally

Requirements: Node.js and pnpm.

```sh
pnpm install
pnpm dev
```

Create a production build with:

```sh
pnpm build
```

## License

MIT. See [LICENSE](LICENSE).
