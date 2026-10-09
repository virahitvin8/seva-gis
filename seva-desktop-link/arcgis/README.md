# SEVA·GIS Precision Agriculture Toolbox for ArcGIS

Python Toolbox (`.pyt`) compatible with **ArcMap 10.x** and **ArcGIS Pro 2.x / 3.x**.

## Quick Setup

1. Open **ArcToolbox** in ArcMap or ArcGIS Pro.
2. Right-click anywhere in ArcToolbox &rarr; **Add Toolbox...**
3. Browse to this directory and select `SEVA_GIS_Toolbox.pyt`.
4. The toolbox **SEVA·GIS Precision Agriculture Tools** will appear with:
   - `⚡ Send Parcels to SEVA·GIS & Analyze`
   - `📥 Pull Analysis Results from SEVA·GIS`

## Features

- **Automatic WGS84 Reprojection**: Converts cadastral coordinates to standard EPSG:4326.
- **Two-Way Sync**: Push field boundaries &rarr; Receive Sentinel-2 NDVI, moisture stress, and VRA recommendations directly into your attribute table.
- **Shapefile-Safe Fields**: All attribute columns (`sv_ndvi`, `sv_ndmi`, `sv_ndre`, `sv_health`, `sv_stress`, `sv_irrig`, `sv_vran`) are 10 characters or fewer for 100% Shapefile compatibility.
