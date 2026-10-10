# SEVA·GIS — Google Earth Engine Proxy Microservice

High-performance FastAPI proxy microservice bridging the SEVA·GIS frontend with Google Earth Engine (`COPERNICUS/S2_SR_HARMONIZED` and `COPERNICUS/DEM/GLO30`).

---

## ⚡ Features

- **Authenticated Earth Engine Session**: Authenticates via Service Account key file, environment variable JSON, or Application Default Credentials (ADC).
- **Sentinel-2 L2A BOA Reflectance**: Real-time tile rendering with 2%–98% percentile linear stretch matching the Earth Engine Code Editor.
- **Copernicus DEM (GLO-30)**: High-resolution elevation, slope, aspect, and hillshade layer tiles.
- **Scene Classification (SCL) Masking**: Bottom-of-Atmosphere cloud, shadow, cirrus, and snow elimination.
- **Analytical Endpoints**:
  - `POST /api/earth-engine/map`: Live map tile URL for 10 band combinations or 16 spectral indices.
  - `POST /api/earth-engine/dem`: Live DEM tile for elevation, slope, aspect, or hillshade.
  - `POST /api/earth-engine/stats`: Zonal statistics (mean, min, max, stdDev, p25, p75).
  - `POST /api/earth-engine/timeseries`: Multi-scene temporal interval trend points.
  - `POST /api/earth-engine/change`: Bi-temporal change detection & loss/gain percentages.
  - `POST /api/earth-engine/alert`: Crop stress threshold alert tile & stressed area percentage.
  - `GET /health`: Service health and Earth Engine readiness status.
  - `DELETE /api/cache`: In-memory tile cache invalidation.

---

## 🛠️ Configuration (`.env`)

Copy `.env.example` to `.env`:

```env
EE_PROJECT_ID=seva-gis-backend
EE_SERVICE_ACCOUNT_EMAIL=seva-gis-runner@seva-gis-backend.iam.gserviceaccount.com
EE_SERVICE_ACCOUNT_KEY_FILE=service-account.json
EE_ALLOWED_ORIGINS=http://localhost:8443,http://localhost:5173,http://localhost:3000,https://seva-gis.web.app
EE_RATE_LIMIT_RPM=120
EE_CACHE_TTL=600
PORT=8080
```

> **Security Note:** Never commit `service-account.json` or `.env` to Git. Both are listed in `.gitignore`.

---

## 🚀 Running Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Start with Uvicorn
python -m uvicorn main:app --port 8080 --reload
```

Interactive documentation:
- Swagger UI: `http://localhost:8080/api/docs`
- ReDoc: `http://localhost:8080/api/redoc`
- Health: `http://localhost:8080/health`

---

## 🐳 Docker & Cloud Run

Build and run locally with Docker:

```bash
docker build -t seva-gis-backend .
docker run -p 8080:8080 --env-file .env seva-gis-backend
```

Deploy directly to Google Cloud Run:

```bash
gcloud run deploy seva-gis-backend \
  --source . \
  --project seva-gis-backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars EE_PROJECT_ID=seva-gis-backend,EE_ALLOWED_ORIGINS="http://localhost:8443,https://seva-gis.web.app"
```
