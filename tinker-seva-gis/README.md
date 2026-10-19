# Tinker (Thinking Machine) GeoAI Engine for SEVA.GIS

This subproject integrates the **Tinker Thinking Machine** cloud training and fine-tuning platform into SEVA.GIS, utilizing your **$10 promotional cloud credit** to train custom precision agriculture and geospatial intelligence models.

---

## 1. What is Tinker (Thinking Machine)?

**Tinker** is a developer platform designed for training, fine-tuning, and serving machine learning models (Transformers, PyTorch, LoRA) on remote GPU clusters without managing complex cloud infrastructure.

In SEVA.GIS, Tinker is used to:
1. **Fine-Tune Language & Tabular GeoAI Models**: Train models on Sentinel-2 L2A spectral ratios (NDVI, NDRE, NDMI, SAVI, EVI), Copernicus DEM topography (Slope, TWI), and SoilGrids data.
2. **Predict Early Crop Stress**: Automatically differentiate between **Nitrogen Deficiency** (low NDRE with high NDVI) and **Water Deficit Stress** (negative NDMI with elevated LST).
3. **Generate Actionable Farmer Advisories**: Translate complex multi-spectral telemetry into plain-language advice in English, Telugu, and Hindi.

---

## 2. Quick Setup & Spending Your $10 Credit

### Step 1: Install Dependencies with `uv`
```bash
cd "f:\SEVAGIS\seva gis\tinker-seva-gis"
uv add tinker tinker-cookbook transformers torch datasets
```

### Step 2: Authenticate with Your Account
```bash
uv run tinker auth login akshitvinay4636@gmail.com
```
*Follow the browser prompt or enter the one-time code to link your $10 credit.*

### Step 3: Run the Fine-Tuning Job
```bash
uv run python train_crop_intelligence.py
```
This script will:
- Assemble the ground-truth training dataset (`crop_intelligence_dataset.jsonl`)
- Launch a LoRA fine-tuning run on the Tinker cloud GPU cluster
- Output the active **Job ID** and real-time dashboard link

### Step 4: Run Local / Cloud Prediction
```bash
uv run python predict_spatial.py --json "{\"ndvi\": 0.42, \"ndre\": 0.22, \"ndmi\": -0.05, \"twi\": 6.8, \"lst\": 33.5}"
```

---

## 3. SEVA.GIS TypeScript Integration

The client-side TypeScript service is located at:
`src/services/tinkerGeoAi.ts`

It connects the SEVA.GIS Node Graph Builder and Field Intelligence Dashboard directly to the Tinker model!
