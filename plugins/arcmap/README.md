# 🌐 SEVA·GIS Precision Agriculture Tools for ArcMap & ArcGIS Pro

Connects **ArcMap 10.x** and **ArcGIS Pro** directly to **SEVA·GIS** in-browser GeoAI. Select any field polygon in your table of contents, run the tool, and watch SEVA·GIS automatically ingest the boundary, fetch live Sentinel-2 satellite data, calculate NDVI, and optimize tractor swaths.

---

## ⚡ Quick Installation (1-Minute Setup)

### Adding the Toolbox in ArcMap or ArcGIS Pro
1. Open **ArcMap** or **ArcGIS Pro**.
2. Open the **ArcToolbox** panel (or **Catalog** window in ArcGIS Pro).
3. Right-click anywhere in ArcToolbox and select **Add Toolbox...**
4. Browse to `plugins/arcmap/SEVA_GIS_Toolbox.pyt` and click **Open**.
5. The **SEVA·GIS Precision Agriculture Tools** toolbox is now permanently available in your ArcToolbox!

---

## 🚀 How to Use in ArcMap & ArcGIS Pro

### 1. Send Active Field to SEVA·GIS
1. In ArcToolbox, expand **SEVA·GIS Precision Agriculture Tools**.
2. Double-click **⚡ Send Field to SEVA·GIS & Analyze**.
3. Configure the parameters:
   - **Field Boundary Feature Layer:** Select your polygon layer from the map (or select a specific feature).
   - **Field Name:** Enter a name or select an attribute field (e.g. `Khasra_No` or `Farm_Name`).
   - **Crop Type:** Choose your crop (Paddy, Wheat, Cotton, Maize, etc.).
   - **SEVA·GIS Web App Endpoint:** `https://sevagis.dpdns.org` (or your local development server).
4. Click **OK / Run**.
5. The tool will:
   - Automatically project your geometries from any local projection (State Plane, UTM, etc.) to WGS84 (`EPSG:4326`).
   - Package the coordinates.
   - Launch your browser and immediately open SEVA·GIS with your field boundary loaded.
   - SEVA·GIS automatically initiates live Sentinel-2 L2A STAC queries and computes full crop health and agronomic decisions.

### 2. Python Window 1-Liner Shortcut
In ArcMap or ArcGIS Pro, open the Python window and run:
```python
import sys; sys.path.append(r"C:\path\to\plugins\arcmap")
import seva_gis_arcpy
seva_gis_arcpy.send_layer("My_Cadastral_Fields", crop="Wheat", name="North_Parcel")
```
