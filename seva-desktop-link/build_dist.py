# -*- coding: utf-8 -*-
"""Packaging script for SEVA·GIS Desktop Link plugins."""
import os
import shutil
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(ROOT, "dist")
PUBLIC_PLUGINS = os.path.abspath(os.path.join(ROOT, "..", "public", "plugins"))
PLUGINS_DIST = os.path.abspath(os.path.join(ROOT, "..", "plugins", "dist"))

for d in (DIST_DIR, PUBLIC_PLUGINS, PLUGINS_DIST):
    os.makedirs(d, exist_ok=True)


def package_qgis():
    zip_path = os.path.join(DIST_DIR, "seva_gis_qgis_plugin.zip")
    src_dir = os.path.join(ROOT, "qgis", "seva_gis")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(src_dir):
            if "__pycache__" in root:
                continue
            for f in files:
                if f.endswith((".pyc", ".part")):
                    continue
                full = os.path.join(root, f)
                rel = os.path.relpath(full, os.path.join(ROOT, "qgis"))
                z.write(full, rel)
    print("Created %s (%.1f KB)" % (zip_path, os.path.getsize(zip_path) / 1024.0))
    shutil.copy2(zip_path, PUBLIC_PLUGINS)
    shutil.copy2(zip_path, PLUGINS_DIST)


def package_arcgis():
    zip_path = os.path.join(DIST_DIR, "seva_gis_arcgis_toolbox.zip")
    src_dir = os.path.join(ROOT, "arcgis")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(src_dir):
            if "__pycache__" in root:
                continue
            for f in files:
                if f.endswith((".pyc", ".part")):
                    continue
                full = os.path.join(root, f)
                rel = os.path.relpath(full, src_dir)
                z.write(full, rel)
    print("Created %s (%.1f KB)" % (zip_path, os.path.getsize(zip_path) / 1024.0))
    shutil.copy2(zip_path, PUBLIC_PLUGINS)
    shutil.copy2(zip_path, PLUGINS_DIST)


def package_bridge():
    src = os.path.join(ROOT, "bridge", "seva_bridge.py")
    dst = os.path.join(DIST_DIR, "seva_bridge.py")
    shutil.copy2(src, dst)
    shutil.copy2(src, PUBLIC_PLUGINS)
    shutil.copy2(src, PLUGINS_DIST)
    print("Copied seva_bridge.py to dist and public/plugins")


if __name__ == "__main__":
    package_qgis()
    package_arcgis()
    package_bridge()
    print("Packaging complete!")
