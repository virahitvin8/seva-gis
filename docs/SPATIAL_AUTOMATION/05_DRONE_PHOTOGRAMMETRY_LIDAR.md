# 05. Drone Photogrammetry, LiDAR & 3D Point Clouds

> **Centimeter-Resolution UAV Surveying, Orthomosaics & Volumetric Analysis**  
> Repositories powering Structure-from-Motion (SfM), LiDAR point cloud classification, canopy height models (CHM), and 3D mesh rendering.

---

## 1. Flagship Repositories

| Repository | Stars | Language | Primary Role in SEVA·GIS |
| :--- | :--- | :--- | :--- |
| [OpenDroneMap/ODM](https://github.com/OpenDroneMap/ODM) | 5.8k+ | C++ / Python | Open-source photogrammetry engine: stitches drone aerial photos into georeferenced orthophotos, DSMs, DTMs, and 3D point clouds. |
| [PDAL/PDAL](https://github.com/PDAL/PDAL) | 2.4k+ | C++ / Python | Point Data Abstraction Library: translates, filters, ground-classifies, and extracts digital surface/terrain models from LAS/LAZ point clouds. |
| [potree/potree](https://github.com/potree/potree) | 4.8k+ | JavaScript / WebGL | WebGL-based octree point cloud renderer for massive LiDAR datasets (billions of points) viewable directly in browser. |
| [laspy/laspy](https://github.com/laspy/laspy) | 700+ | Python | Native Python library for reading, modifying, and creating ASPRS LAS and compressed LAZ LiDAR point cloud files. |
| [CloudCompare/CloudCompare](https://github.com/CloudCompare/CloudCompare) | 4.2k+ | C++ | 3D point cloud and triangular mesh processing software (distance comparison, registration, curvature, and volume computation). |
| [SmartForest-no/ForestFormer3D](https://github.com/SmartForest-no/ForestFormer3D) | 150+ | Python / PyTorch | Deep learning framework for end-to-end instance segmentation of individual trees in dense drone/airborne LiDAR point clouds. |
| [stefp/BranchPoseNet](https://github.com/stefp/BranchPoseNet) | 50+ | Python / Jupyter | UAV drone laser scanning pose estimation for tree whorl and branch detection. |
| [fab-hinz/Building-Height-Calculator](https://github.com/fab-hinz/Building-Height-Calculator) | 100+ | Python | Calculates physical building and canopy heights using satellite sun-sensor geometry and shadow length trigonometry. |
| [prs-eth/PanopticSegForLargeScalePointCloud](https://github.com/prs-eth/PanopticSegForLargeScalePointCloud) | 200+ | Python | ETH Zurich large-scale point cloud panoptic segmentation for urban infrastructure and terrain classification. |

---

## 2. Technical Integration Blueprint for SEVA·GIS

### Drone Orthomosaic Elevation & Canopy Height Model (CHM) Pipeline
Extracts physical tree and crop canopy heights by computing:
$$\text{CHM} = \text{DSM (Digital Surface Model)} - \text{DTM (Digital Terrain Model)}$$

```python
import pdal
import json

# 1. Define PDAL pipeline to filter ground returns and create raster DTM/DSM
pipeline_json = {
    "pipeline": [
        "drone_flight_raw.laz",
        {
            "type": "filters.elm"  # Extended Local Minimum (noise filter)
        },
        {
            "type": "filters.pmf",  # Progressive Morphological Filter (classify ground)
            "returns": "first, last, intermediate"
        },
        {
            "type": "writers.gdal",
            "filename": "drone_dtm_ground.tif",
            "resolution": 0.05,  # 5cm ground resolution
            "output_type": "min",
            "where": "Classification == 2"  # ASPRS Class 2 = Ground
        }
    ]
}

pipeline = pdal.Pipeline(json.dumps(pipeline_json))
pipeline.execute()
print("[SEVA·GIS Drone Studio] 5cm Digital Terrain Model generated successfully.")
```
