# SEVA.GIS Domain Glossary

Shared vocabulary across SEVA.GIS client spatial engines, field GNSS modules, GeoAI routers, and CI release pipelines.

## Spatial & Spectral Nouns

- **AOI (Area of Interest)**: A single-ring WGS84 (`EPSG:4326`) polygon representing a farmer's field boundary. Stored locally in browser IndexedDB (`Dexie`) and never uploaded without explicit user share action.
- **NDVI / NDMI / NDRE**: Normalized Difference Vegetation Index `(B08 - B04)/(B08 + B04)`, Moisture Index `(B08 - B11)/(B08 + B11)`, and Red-Edge Nitrogen Index `(B08 - B05)/(B08 + B05)` computed directly from Sentinel-2 L2A Cloud-Optimized GeoTIFFs.
- **SCL (Scene Classification Layer)**: Sentinel-2 20 m mask band used to exclude cloud, cloud-shadow, and cirrus pixels from field statistics.
- **DIGIPIN**: India Post 10-character alphanumeric grid code (`XXX-XXX-XXXX`) identifying ~4 m x 4 m land cells offline from latitude/longitude.

## Field Geodesy & Robotics

- **EGM2008 / Geoid Separation ($N$)**: Elevation offset between WGS84 ellipsoidal height ($h$) and Mean Sea Level orthometric height ($H = h - N$). Negative in South Asia (around `-85 m` to `-105 m`).
- **IGRF-2025**: International Geomagnetic Reference Field (14th generation, epoch 2025.00, spherical harmonic degrees $1..13$) used to convert true north azimuth to magnetic compass heading.
- **FDRS (Farm Data Relay System)**: MIT-licensed sensor packet standard (`LAT_T`, `LON_T`, `ALT_T`, `SPD_T`, `ACC_T`) plus `fdrs_node_config.h` firmware headers for off-grid ESP32 / LoRa nodes.

## AI Routing & Guardrails (FreeLLMAPI Pattern)

- **Route Score**: Bounded `[0, 1]` score combining Beta-posterior empirical reliability, speed, and intelligence multiplied by quota headroom and rate-limit cooldown guardrails.
- **Cooldown Ladder**: Escalating backoff (`2 min -> 10 min -> 1 h -> 24 h`) applied per failed/429 provider route, honoring authoritative `Retry-After` headers and half-time early probe recovery (`isCooldownProbeRipe`).

## Delivery & OTA Manifests

- **`version.json` & `updates/latest.json`**: Cache-busted JSON manifests stamped on every Vite build (`dist/version.json`, `dist/updates/latest.json`) so Android Capacitor WebViews and PWAs auto-detect new Git commits.
- **`latest-android.yml`**: YAML artifact manifest (`version`, `versionCode`, `sha512`, `size`, `releaseDate`) published alongside every GitHub Release APK.

