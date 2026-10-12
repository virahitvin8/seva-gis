# SEVA.GIS Earth Engine Service

This FastAPI service is the optional authenticated cloud-processing path for SEVA.GIS. The browser remains responsible for interaction, local persistence, and client-side processing where practical; this service provides Earth Engine-backed tiles and statistics when configured.

## Endpoints

- `GET /health`
- `POST /api/gee/render`
- `POST /api/earth-engine/render`
- `POST /api/earth-engine/map`
- `POST /api/earth-engine/dem`
- `POST /api/earth-engine/stats`
- `POST /api/earth-engine/timeseries`
- `POST /api/earth-engine/change`
- `POST /api/earth-engine/alert`
- `GET /api/earth-engine/indicators`
- `DELETE /api/cache`

The service uses Sentinel-2 L2A, SCL masking, Copernicus GLO-30 DEM, spectral-index expressions, map tiles, zonal statistics, time series, change maps, and alert calculations.

## Configuration

Use environment variables or the deployment platform's secret manager. Do not put credentials in frontend code, request bodies, `.env` files committed to Git, or Docker images.

```env
EE_PROJECT_ID=your-earth-engine-project
EE_ALLOWED_ORIGINS=http://localhost:8443,http://localhost:5173
EE_RATE_LIMIT_RPM=60
EE_CACHE_TTL=600
PORT=8080
```

Cloud Run should use Application Default Credentials from its attached service identity. A local service-account JSON file may be used only through a protected local environment and must remain ignored and outside version control.

`EE_ALLOWED_ORIGINS` must be enforced as an actual CORS allowlist. Do not use wildcard origins for credentialed or production requests.

## Local Run

```bash
pip install -r requirements.txt
python -m uvicorn main:app --port 8080 --reload
```

Open:

- Swagger: `http://localhost:8080/api/docs`
- ReDoc: `http://localhost:8080/api/redoc`
- Health: `http://localhost:8080/health`

## Docker

```bash
docker build -t seva-gis-earth-engine .
docker run --rm -p 8080:8080 --env-file .env seva-gis-earth-engine
```

## Operational requirements

- Validate WGS84 AOI coordinates as `[lon, lat]` and reject invalid rings.
- Preserve AOI, source, date, scale, resolution, and processing metadata in responses.
- Keep rate limits and caches bounded; use shared infrastructure if multiple service instances require coordinated limits.
- Return explicit errors for no scenes, all-masked pixels, invalid indicators, and unavailable Earth Engine.
- Test every route with representative small, large, concave, and invalid AOIs before deployment.
- Do not claim that cloud processing creates sub-meter Sentinel-2 analytical detail.
