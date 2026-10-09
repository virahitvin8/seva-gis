# 🛰️ SEVA·GIS Precision Agriculture Bridge — QGIS 3.x Plugin

Connects **QGIS 3.x** directly with **SEVA·GIS** in-browser GeoAI. Select any field boundary or cadastral layer in QGIS, click the plugin icon, and SEVA·GIS will automatically ingest the boundary, fetch live Sentinel-2 satellite passes, calculate NDVI/NDMI/NDRE, compute Fields2Cover tractor swaths, and provide human-grade agronomic advisory in seconds.

---

## ⚡ Quick Installation (1-Minute Setup)

### Method A: Install via ZIP in QGIS (Recommended)
1. In the SEVA·GIS Dashboard header, click the **QGIS & ArcMap Bridge** icon (`🌐 GIS Bridge`).
2. Click **Download QGIS Plugin (.zip)** (or find `seva_gis_qgis_plugin.zip`).
3. Open **QGIS 3**.
4. Navigate to **Plugins** → **Manage and Install Plugins...**
5. Select **Install from ZIP** on the left menu.
6. Browse to `seva_gis_qgis_plugin.zip` and click **Install Plugin**.
7. The **SEVA·GIS** toolbar icon and menu will appear immediately in your QGIS window!

### Method B: Manual Copy to QGIS Plugins Folder
Copy the `plugins/qgis` folder into your local QGIS plugins directory:
- **Windows:** `%APPDATA%\QGIS\QGIS3\profiles\default\python\plugins\seva_gis`
- **Linux:** `~/.local/share/QGIS/QGIS3/profiles/default/python/plugins/seva_gis`
- **macOS:** `~/Library/Application Support/QGIS/QGIS3/profiles/default/python/plugins/seva_gis`

Restart QGIS, go to **Plugins** → **Manage and Install Plugins** → **Installed**, and enable **SEVA·GIS Precision Agriculture Bridge**.

---

## 🚀 How to Use in QGIS

1. **Load Your Cadastral / Field Boundary Layer:**
   - Open your project or add your Shapefile, GeoPackage, or KML field polygon layer into QGIS.
2. **Select the Field:**
   - Use QGIS's standard "Select Feature" tool to highlight the target field boundary (or leave all features selected).
3. **Click the SEVA·GIS Toolbar Icon:**
   - Click **⚡ Send Active Field to SEVA·GIS & Analyze**.
4. **Instant Action:**
   - The plugin automatically:
     - Detects the layer CRS and reprojects polygon vertices to standard WGS84 (`EPSG:4326`).
     - Extracts the polygon ring and field name.
     - Encodes the boundary and launches SEVA·GIS in your browser.
     - SEVA·GIS immediately loads the boundary, triggers live ESA Copernicus Sentinel-2 L2A STAC queries, and computes:
       - **Vegetation Health:** Live NDVI, NDRE, and canopy chlorophyll vigor.
       - **Hydrology & Irrigation:** FAO-56 Penman-Monteith daily water need in mm, L/acre, and pump hours across Drip, Sprinkler, and Furrow methods.
       - **Tractor Swaths:** Fuel-optimized Boustrophedon paths and headlands.
       - **Scout Hotspots:** Priority GPS field walking inspection pins.
5. **Two-Way Pull:**
   - Click **📥 Pull Tractor Swaths & Hotspots from SEVA·GIS** to bring computed tractor paths and GPS inspection pins directly back into your QGIS map canvas as vector layers!
