# -*- coding: utf-8 -*-
r"""
SEVA·GIS ArcPy Standalone Integration Script
Execute directly from ArcMap Python Window, ArcGIS Pro Notebook, or command-line.

Example Usage in ArcMap Python Window:
    >>> import sys; sys.path.append(r"C:\path\to\plugins\arcmap")
    >>> import seva_gis_arcpy
    >>> seva_gis_arcpy.send_layer("My_Cadastral_Fields", crop="Wheat", name="Plot_42")
"""

import base64
import json
import webbrowser

try:
    import arcpy
except ImportError:
    arcpy = None


def send_layer(layer_name, crop="Paddy (Rice)", name="ArcGIS Field", app_url="https://sevagis.dpdns.org"):
    """Extracts polygon boundary from an ArcMap or ArcGIS Pro layer, reprojects to WGS84, and launches SEVA·GIS."""
    if not arcpy:
        print("Error: arcpy is not installed or not in python environment.")
        return False

    print(f"🛰️ SEVA·GIS ArcMap Bridge: Ingesting '{layer_name}'...")
    sr_wgs84 = arcpy.SpatialReference(4326)
    rings = []

    with arcpy.da.SearchCursor(layer_name, ["SHAPE@"], spatial_reference=sr_wgs84) as cursor:
        for row in cursor:
            geom = row[0]
            if geom and geom.type == "polygon":
                for part in geom:
                    poly_ring = [[round(pt.X, 6), round(pt.Y, 6)] for pt in part if pt]
                    if len(poly_ring) >= 3:
                        rings.append(poly_ring)
                        break
                if rings:
                    break

    if not rings:
        print(f"Error: No valid polygon geometry found in layer '{layer_name}'.")
        return False

    ring = rings[0]
    payload = {
        "source": "arcmap",
        "name": name,
        "crop": crop,
        "ring": ring,
    }

    json_str = json.dumps(payload)
    b64_data = base64.urlsafe_b64encode(json_str.encode("utf-8")).decode("utf-8")
    target_url = f"{app_url.rstrip('/')}/?import={b64_data}"

    print(f"✅ Extracted polygon with {len(ring)} points.")
    print(f"🚀 Launching SEVA·GIS in browser...")
    webbrowser.open(target_url, new=2)
    return True


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Send ArcMap / ArcGIS layer to SEVA·GIS")
    parser.add_argument("--layer", required=True, help="Layer name in ArcMap or shapefile path")
    parser.add_argument("--crop", default="Paddy (Rice)", help="Crop type")
    parser.add_argument("--name", default="ArcGIS Field", help="Farm name")
    parser.add_argument("--url", default="https://sevagis.dpdns.org", help="SEVA·GIS URL")
    args = parser.parse_args()
    send_layer(args.layer, args.crop, args.name, args.url)
