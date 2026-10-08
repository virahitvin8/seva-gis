#!/usr/bin/env python3
"""
=============================================================================
SEVA·GIS — System Architecture Diagram as Code
Powered by mingrammer/diagrams (https://github.com/mingrammer/diagrams)
=============================================================================

Architecture of SEVA.GIS (Spatial Evaluation & Vegetation Analytics):
A zero-cloud, keyless in-browser GeoAI & remote sensing platform.

Run with:
    python scripts/architecture_diagram.py

Requirements:
    pip install diagrams
    (Graphviz binaries on PATH if generating graphviz dot render)
"""

import os
import sys

def main():
    try:
        from diagrams import Diagram, Cluster, Edge
        from diagrams.programming.framework import React
        from diagrams.onprem.client import User, Client
        from diagrams.generic.storage import Storage
        from diagrams.generic.device import Mobile
        from diagrams.generic.compute import Rack
        from diagrams.programming.language import TypeScript
    except ImportError:
        print("[!] 'diagrams' package is required: pip install diagrams")
        return

    graph_attr = {
        "fontsize": "28",
        "fontname": "Segoe UI",
        "bgcolor": "#f8fafc",
        "pad": "0.5",
        "splines": "ortho",
    }

    node_attr = {
        "fontsize": "12",
        "fontname": "Segoe UI",
    }

    edge_attr = {
        "fontsize": "10",
        "fontname": "Segoe UI",
    }

    try:
        with Diagram(
            "SEVA·GIS System Architecture",
            show=False,
            filename="docs/architecture_diagram_mingrammer",
            outformat="png",
            graph_attr=graph_attr,
            node_attr=node_attr,
            edge_attr=edge_attr,
            direction="TB",
        ):
            # 1. App Workspace & Client Core
            with Cluster("1. App Workspace & Client Core"):
                farmer = User("Field Farmer / User\n[Browser / Mobile PWA]")
                workspace = React("Workspace Shell\n[src/App.tsx]")
                boundary = TypeScript("Boundary Geometry\n[src/AddFarm.tsx]")
                auth = Storage("Local Device Vault\n[src/Auth.tsx & db.ts]")
                mitra = Client("Mitra 60s Tour\n[src/Mitra.tsx]")

                farmer >> Edge(label="opens workspace") >> workspace
                workspace >> Edge(label="traces perimeter") >> boundary
                boundary >> Edge(label="persists offline") >> auth
                auth >> Edge(label="triggers tour") >> mitra

            # 2. Keyless Open Data Providers
            with Cluster("2. Keyless Open Data Providers (REST / STAC / COG)"):
                sentinel = Storage("Sentinel-2 L2A BOA\n[Planetary Computer STAC]")
                dem = Storage("Copernicus DEM (GLO-30)\n[AWS Open Data]")
                meteo = Storage("Open-Meteo Agro API\n[open-meteo.com]")
                soil = Storage("SoilGrids ISRIC 250m\n[ISRIC WCS]")
                osm = Storage("OSM Overpass\n[Overpass API]")

            # 3. Geospatial & Spectral Compute Core
            with Cluster("3. Compute Core (Client-Side)"):
                pipeline = TypeScript("Satellite Pipeline\n[src/seva.ts]")
                raster = TypeScript("Raster Math Engine\n[src/raster.ts]")
                indices = TypeScript("Spectral Indices\n[src/indicators.ts]")
                hydro = TypeScript("Terrain Hydrology\n[src/hydro.ts]")
                compositor = TypeScript("Map Compositor\n[src/gee.ts]")
                proximity = TypeScript("Infrastructure Proximity\n[src/nearby.ts]")

                sentinel >> Edge(label="10m bands") >> pipeline
                dem >> Edge(label="30m elevation") >> hydro
                pipeline >> Edge(label="GeoTIFF tiles") >> raster
                raster >> Edge(label="band math") >> indices
                pipeline >> Edge(label="slope & aspect") >> hydro
                raster >> Edge(label="composites") >> compositor

            # 4. GeoAI Studio & Farm Intelligence
            with Cluster("4. GeoAI Studio & Farm Intelligence"):
                geoai = React("GeoAI Segmentation\n[src/Studio.tsx]")
                intel = React("Intelligence Lab\n[src/Intelligence.tsx]")
                timelapse = React("Seasonal Time-Lapse\n[src/Timelapse.tsx]")
                advisory = React("Agro Advisory\n[src/AgroPanel.tsx]")
                water_diag = React("Water & Soil Diagnostics\n[src/WaterPanel.tsx]")
                nearby_ovl = React("Nearby Overlays\n[src/NearbyLayer.tsx]")

                meteo >> Edge(label="7d forecast") >> advisory
                soil >> Edge(label="soil depth") >> water_diag
                osm >> Edge(label="borewells & canals") >> nearby_ovl
                indices >> Edge(label="NDVI clusters") >> geoai
                indices >> Edge(label="anomalies") >> intel
                indices >> Edge(label="temporal series") >> timelapse
                hydro >> Edge(label="drainage & TWI") >> water_diag
                proximity >> Edge(label="distance rings") >> nearby_ovl

            # 5. Cartographic Deliverables & Field Tools
            with Cluster("5. Cartographic Deliverables & Field Tools"):
                map_canvas = React("Interactive Map Canvas\n[src/IndicatorMap.tsx]")
                report = TypeScript("Branded PDF Dossier\n[src/report.ts]")
                geotools = TypeScript("Geospatial Tools\n[src/GeoTools.tsx]")
                tour_engine = React("Field Operator Tour\n[Mitra Tour Engine]")

                compositor >> Edge(label="GPU WebGL tiles") >> map_canvas
                indices >> Edge(label="NDVI certificate") >> report
                advisory >> Edge(label="agronomic verdict") >> report
                proximity >> Edge(label="WGS84 toolkit") >> geotools
                mitra >> Edge(label="onboarding") >> tour_engine

        print("[✓] mingrammer/diagrams architecture script executed successfully!")
    except Exception as e:
        print(f"[i] mingrammer/diagrams Graphviz renderer: {e}")
        print("[i] Pre-rendered tldraw whiteboard canvas: docs/architecture-diagram.png")
        print("[i] Native tldraw file: docs/seva-gis-architecture.tldr")

if __name__ == "__main__":
    main()
