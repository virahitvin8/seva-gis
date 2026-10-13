# SEVA·GEE Flow — Desktop GIS Plugin Suite

> **Tagline:** Everything is free to the public. Google Earth Engine automated for everyone without writing a single line of JavaScript.

SEVA·GEE Flow bridges **Google Earth Engine (GEE)** planetary analytics with desktop GIS (**QGIS 3.x, ArcGIS Pro, and ArcMap 10.x**). It completely eliminates manual JavaScript coding and complex API keys by offering a modular, re-orderable query-box interface.

---

## Supported Desktop Hosts
1. **QGIS 3.x** (3.16 to 3.38+ LTR) via Python Plugin
2. **ArcGIS Pro** (2.8 to 3.3+) via Python Toolbox (`.pyt`)
3. **ArcMap 10.x** (10.1 to 10.8.2) via legacy Python Toolbox (`.pyt`)

---

## Modular Process Box Concept
Non-technical users, students, and professional analysts can construct custom workflows using re-orderable process boxes:

| Process Box | Functionality |
| :--- | :--- |
| **Box 1: Area of Interest (AOI)** | Select any layer from QGIS/ArcGIS (Shapefile, GeoJSON, KML, DBF) or draw on canvas. |
| **Box 2: Date & Cloud Filter** | Pick custom date ranges (e.g. July to August) and cloud cover threshold (e.g. 2% or 15%). |
| **Box 3: Spectral Indices** | Calculate NDVI, EVI, SAVI, NDWI, NDMI, True Color RGB, or False Color Infrared. |
| **Box 4: Stress Hotspot & Healthy Zones** | Automatic thresholding and polygonization into Danger/Hotspot zones (red) & Healthy crops (green). |
| **Box 5: Water Drainage Streams** | D8 flow direction and hydrological stream lines generated from Copernicus GLO-30 DEM. |
| **Box 6: Infrastructure & Pole Marking** | Edge and point detection for electrical poles, tracks, and boundary fences. |

Boxes can be freely added (`+`), deleted (`✕`), and re-ordered (`▲ / ▼`) at any time.

---

## 1-Click Installation Guide

### For QGIS 3.x:
1. Download `seva_gee_flow_qgis.zip`.
2. Open QGIS and go to the top menu: **Plugins -> Manage and Install Plugins...**
3. Select the **Install from ZIP** tab on the left.
4. Browse to `seva_gee_flow_qgis.zip` and click **Install Plugin**.
5. Click the **SEVA·GEE Flow** icon on your toolbar or under the **Raster** menu to launch.

### For ArcGIS Pro & ArcMap 10.x:
1. Download `seva_gee_flow_arcgis.zip` and extract to any folder.
2. Open the **Catalog** panel in ArcGIS Pro or ArcMap.
3. Right-click **Toolboxes -> Add Toolbox...**
4. Browse to and select `SEVA_GEE_Flow.pyt`.
5. Double-click **SEVA·GEE Flow (Automated Earth Engine Pipeline)** to open the parameter wizard.
6. Select your AOI layer, configure process boxes, and click **Run**.
