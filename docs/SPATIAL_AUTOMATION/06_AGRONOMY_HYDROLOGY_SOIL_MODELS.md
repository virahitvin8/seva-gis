# 06. Agronomy, Agro-Hydrology & Soil Physics Models

> **Biophysical Soil Water Budgeting, Yield Simulation & Crop Microclimate**  
> Repositories powering pedotransfer functions, actual evapotranspiration (ETa), crop water stress indices (CWSI), and FAO agro-ecological zoning.

---

## 1. Flagship Repositories

| Repository | Stars | Language | Primary Role in SEVA·GIS |
| :--- | :--- | :--- | :--- |
| [microsoft/farmvibes-ai](https://github.com/microsoft/farmvibes-ai) | 1.8k+ | Python / Jupyter | Multi-modal geospatial machine learning models for agriculture: soil carbon modeling, crop stress, and weather assimilation. |
| [farmOS/farmOS](https://github.com/farmOS/farmOS) | 1.2k+ | PHP / JS | Web-based farm management and record-keeping system with spatial boundary mapping and sensor telemetry logs. |
| [ekylibre/ekylibre](https://github.com/ekylibre/ekylibre) | 400+ | Ruby | Farm Management Information System (FMIS) with agronomic accounting, field intervention logs, and GIS mapping. |
| [usetania/tania](https://github.com/usetania/tania) | 600+ | PHP | Open-source farm management software for crop schedules, irrigation events, and farm inventory tracking. |
| [openet/openet](https://github.com/OpenET/openet-core) | 250+ | Python / GEE | OpenET satellite-based actual evapotranspiration (ETa) framework for field-scale water consumption tracking. |
| [m35/pyeto](https://github.com/m35/pyeto) | 350+ | Python | FAO-56 Penman-Monteith reference evapotranspiration (ETo) computation from solar radiation, temperature, and wind speed. |
| [soilgrids/soilgrids-rest](https://github.com/ISRICWorldSoil/SoilGrids250m) | 300+ | Python | ISRIC SoilGrids 2.0 global 250m resolution soil profile properties (sand, silt, clay, bulk density, pH, organic carbon). |
| [FAO-GIAM/pyAEZ](https://github.com/FAO-GIAM/pyAEZ) | 150+ | Python | FAO Agro-Ecological Zoning (AEZ) modeling framework for crop suitability, yield potential, and climate change scenarios. |

---

## 2. Technical Integration Blueprint for SEVA·GIS

### Saxton-Rawls Soil Hydraulics & Available Water Capacity (AWC)
Converts soil texture percentage (sand, clay, organic matter) from SoilGrids 250m into hydraulic moisture constants:

$$\theta_{\text{AWC}} = \theta_{\text{FC}} (\text{Field Capacity}) - \theta_{\text{WP}} (\text{Wilting Point})$$

```typescript
// Implemented natively in src/lib/hydro.ts
export function computeSaxtonRawlsAWC(sandPct: number, clayPct: number, omPct: number) {
  // Saxton & Rawls (2006) Soil Science Society of America pedotransfer equations
  const theta1500t = -0.024 * (sandPct / 100) + 0.487 * (clayPct / 100) + 0.006 * (omPct / 100)
  const wiltingPoint = theta1500t + (0.14 * theta1500t - 0.02)
  
  const theta33t = -0.251 * (sandPct / 100) + 0.195 * (clayPct / 100) + 0.011 * (omPct / 100)
  const fieldCapacity = theta33t + (1.283 * Math.pow(theta33t, 2) - 0.374 * theta33t - 0.015)
  
  const awc = Math.max(0.02, fieldCapacity - wiltingPoint)
  return {
    wiltingPointPct: Math.round(wiltingPoint * 1000) / 10,
    fieldCapacityPct: Math.round(fieldCapacity * 1000) / 10,
    availableWaterCapacityPct: Math.round(awc * 1000) / 10
  }
}
```
