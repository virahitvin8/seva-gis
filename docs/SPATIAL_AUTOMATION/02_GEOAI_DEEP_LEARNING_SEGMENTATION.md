# 02. GeoAI, Deep Learning & Boundary Segmentation

> **State-of-the-Art Computer Vision for Satellite & Aerial Earth Observation**  
> Repositories powering zero-shot parcel boundary delineation, multi-spectral foundation models, crop classification, and smallholder cadastral mapping.

---

## 1. Flagship Repositories

| Repository | Stars | Language | Primary Role in SEVA·GIS |
| :--- | :--- | :--- | :--- |
| [opengeos/segment-geospatial](https://github.com/opengeos/segment-geospatial) (samgeo) | 3.5k+ | Python | Segment Anything Model (SAM, SAM 2, FastSAM) adapted for geographic data: promptable zero-shot field boundary delineation from satellite and drone imagery. |
| [starfiee/field-boundary-delineation](https://github.com/starfiee/field-boundary-delineation) | 400+ | Python / PyTorch | Sentinel-2 field boundary segmentation using U-Net. Extracts Indian smallholder plot boundaries and farm bunds (*medhs*). |
| [microsoft/torchgeo](https://github.com/microsoft/torchgeo) | 2.8k+ | Python / PyTorch | PyTorch domain library with geospatial samplers, datasets, and benchmark architectures (ResNet, ViT, U-Net) for multispectral Earth observation. |
| [Clay-Foundation/model](https://github.com/Clay-Foundation/model) | 1.2k+ | Python | Clay: Open-source foundation model for Earth observation trained on multi-sensor global satellite imagery (Sentinel-1, Sentinel-2, Landsat, DEM). |
| [NASA-IMPACT/Prithvi](https://github.com/NASA-IMPACT/Prithvi) | 1.1k+ | Python | NASA & IBM 100M-parameter geospatial foundation model for flood mapping, burn scar detection, and multi-temporal crop segmentation. |
| [kornia/kornia](https://github.com/kornia/kornia) | 10.5k+ | Python / PyTorch | Differentiable spatial AI and geometric computer vision: real-time image alignment, homography estimation, and edge gradients. |
| [Project-AgML/AgML](https://github.com/Project-AgML/AgML) | 600+ | Python | Agricultural computer vision framework: pre-trained crop disease detectors, yield estimators, and synthetic agricultural datasets. |
| [ESA-PhiLab/eolearn](https://github.com/sentinel-hub/eo-learn) | 1.2k+ | Python | Earth observation processing library seamlessly bridging remote sensing data and machine learning feature engineering. |
| [facebookresearch/segment-anything-2](https://github.com/facebookresearch/segment-anything-2) | 18k+ | Python / PyTorch | Meta's SAM 2: Real-time visual segmentation foundation model with promptable point, box, and mask propagation. |
| [wenhwu/awesome-remote-sensing-change-detection](https://github.com/wenhwu/awesome-remote-sensing-change-detection) | 1.3k+ | Markdown | Compilation of deep learning models, datasets, and methods for remote sensing multi-temporal change detection. |

---

## 2. Technical Integration Blueprint for SEVA·GIS

### Automated Smallholder Parcel Snapping with samgeo
When a farmer or surveyor taps a single coordinate inside a field in SEVA·GIS, the GeoAI engine extracts the bounding contour without manual vertex-by-vertex drawing:

```python
from samgeo import SamGeo
import geopandas as gpd

# 1. Initialize SAM with agricultural weights
sam = SamGeo(
    model_type="vit_h",
    checkpoint="sam_vit_h_4b8939.pth",
    device="cuda" if torch.cuda.is_available() else "cpu"
)

# 2. Segment farm parcel from Sentinel-2 10m RGB/NIR composite
sam.generate(
    source="sentinel2_field_composite.tif",
    output="delineated_field_mask.tif",
    foreground=True,
    points_per_side=32,
    pred_iou_thresh=0.88,
    stability_score_thresh=0.92
)

# 3. Vectorize mask to GeoJSON Polygon with RDP polygon smoothing
gdf = sam.tiff_to_geojson("delineated_field_mask.tif", min_size=50)
gdf["geometry"] = gdf["geometry"].simplify(tolerance=0.00004, preserve_topology=True)
gdf.to_file("final_legal_parcel.geojson", driver="GeoJSON")
```
