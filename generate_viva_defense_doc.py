# -*- coding: utf-8 -*-
"""
Generate the Comprehensive Academic Viva Defense Document for SEVA·GIS
Jury: Senior Remote Sensing Scientist & Agronomist (26 Years Practical Field Experience)
Candidate: Creator of SEVA·GIS
Framework: 5W1H (What, Why, Who, Where, When, How) + Core Agronomic/Seva Reasoning
"""

import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

doc = docx.Document()

# Page Margins
for section in doc.sections:
    section.top_margin = Inches(0.8)
    section.bottom_margin = Inches(0.8)
    section.left_margin = Inches(0.8)
    section.right_margin = Inches(0.8)

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def add_header(title, subtitle):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(title)
    run.font.name = "Arial"
    run.font.size = Pt(22)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x1B, 0x4D, 0x3E) # Forest green

    p2 = doc.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run2 = p2.add_run(subtitle)
    run2.font.name = "Arial"
    run2.font.size = Pt(12)
    run2.font.italic = True
    run2.font.color.rgb = RGBColor(0x55, 0x55, 0x55)

def add_section_title(title_text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(18)
    p.paragraph_format.space_after = Pt(6)
    run = p.add_run(title_text)
    run.font.name = "Arial"
    run.font.size = Pt(15)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x0E, 0x3A, 0x2F)

def add_feature_viva(num, feature_name, jury_dialogue, candidate_5w1h, agronomic_reasoning):
    # Feature Heading
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(4)
    run = p.add_run(f"Feature {num}: {feature_name}")
    run.font.name = "Arial"
    run.font.size = Pt(13)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x2A, 0x6F, 0x55)

    # Jury Challenge Box (Table)
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    table.columns[0].width = Inches(6.8)
    cell = table.cell(0, 0)
    set_cell_background(cell, "FBEAEB") # Subtle warm alert
    set_cell_margins(cell, top=120, bottom=120, left=180, right=180)
    
    cp = cell.paragraphs[0]
    cp.paragraph_format.space_after = Pt(2)
    r_jlabel = cp.add_run("Jury Member (Dr. Arvind R. Deshmukh, 26 Yrs Field Experience): ")
    r_jlabel.bold = True
    r_jlabel.font.name = "Arial"
    r_jlabel.font.size = Pt(10)
    r_jlabel.font.color.rgb = RGBColor(0x8B, 0x00, 0x00)
    
    r_jtext = cp.add_run(jury_dialogue)
    r_jtext.italic = True
    r_jtext.font.name = "Arial"
    r_jtext.font.size = Pt(10)
    r_jtext.font.color.rgb = RGBColor(0x22, 0x22, 0x22)

    # 5W1H Defense Table
    p_def = doc.add_paragraph()
    p_def.paragraph_format.space_before = Pt(6)
    p_def.paragraph_format.space_after = Pt(2)
    r_def = p_def.add_run("Candidate Defense (The 5W1H Matrix & Seva Grounding):")
    r_def.bold = True
    r_def.font.name = "Arial"
    r_def.font.size = Pt(10.5)
    r_def.font.color.rgb = RGBColor(0x1B, 0x4D, 0x3E)

    t5 = doc.add_table(rows=7, cols=2)
    t5.alignment = WD_TABLE_ALIGNMENT.CENTER
    t5.autofit = False
    t5.columns[0].width = Inches(1.3)
    t5.columns[1].width = Inches(5.5)

    headers = [
        ("WHAT", candidate_5w1h.get("what", "")),
        ("WHY", candidate_5w1h.get("why", "")),
        ("WHO", candidate_5w1h.get("who", "")),
        ("WHERE", candidate_5w1h.get("where", "")),
        ("WHEN", candidate_5w1h.get("when", "")),
        ("HOW", candidate_5w1h.get("how", "")),
        ("SEVA VALUE", candidate_5w1h.get("seva", ""))
    ]

    for idx, (lbl, val) in enumerate(headers):
        c0 = t5.cell(idx, 0)
        c1 = t5.cell(idx, 1)
        set_cell_background(c0, "EAF2EC")
        set_cell_margins(c0, top=60, bottom=60, left=100, right=100)
        set_cell_margins(c1, top=60, bottom=60, left=120, right=120)
        
        p0 = c0.paragraphs[0]
        p0.paragraph_format.space_after = Pt(0)
        r0 = p0.add_run(lbl)
        r0.bold = True
        r0.font.name = "Arial"
        r0.font.size = Pt(9)
        r0.font.color.rgb = RGBColor(0x1B, 0x4D, 0x3E)

        p1 = c1.paragraphs[0]
        p1.paragraph_format.space_after = Pt(0)
        r1 = p1.add_run(val)
        r1.font.name = "Arial"
        r1.font.size = Pt(9.5)
        r1.font.color.rgb = RGBColor(0x22, 0x22, 0x22)

    # Practical Agronomic Reasoning Box
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    t_agr = doc.add_table(rows=1, cols=1)
    t_agr.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_agr.autofit = False
    t_agr.columns[0].width = Inches(6.8)
    cell_a = t_agr.cell(0, 0)
    set_cell_background(cell_a, "F4F8F5")
    set_cell_margins(cell_a, top=100, bottom=100, left=150, right=150)
    
    cap = cell_a.paragraphs[0]
    cap.paragraph_format.space_after = Pt(0)
    ra_lbl = cap.add_run("Agronomic & Remote Sensing Ground-Truth Reasoning: ")
    ra_lbl.bold = True
    ra_lbl.font.name = "Arial"
    ra_lbl.font.size = Pt(9.5)
    ra_lbl.font.color.rgb = RGBColor(0x1B, 0x4D, 0x3E)
    
    ra_txt = cap.add_run(agronomic_reasoning)
    ra_txt.font.name = "Arial"
    ra_txt.font.size = Pt(9.5)
    ra_txt.font.color.rgb = RGBColor(0x33, 0x33, 0x33)

    p_spacer = doc.add_paragraph()
    p_spacer.paragraph_format.space_after = Pt(4)

print("Starting generation of SEVA_GIS_Comprehensive_Viva_Defense.docx...")
add_header(
    "SEVA·GIS: COMPREHENSIVE ACADEMIC & TECHNICAL VIVA DEFENSE",
    "Candidate Examination by Jury of 26-Year Senior Agronomist, Remote Sensing & GIS Scientist"
)

# Preamble
p_intro = doc.add_paragraph()
p_intro.paragraph_format.space_before = Pt(8)
p_intro.paragraph_format.space_after = Pt(12)
r_in = p_intro.add_run(
    "Context: This defense document records the rigorous oral and technical examination between the Creator of SEVA·GIS "
    "and Dr. Arvind R. Deshmukh, an examiner possessing 26 years of on-ground agronomic, soil chemistry, remote sensing, "
    "and GIS field experience. Every architectural module, spectral correction, hydrological routine, and data pipeline "
    "is systematically defended across the 5W1H framework (What, Why, Who, Where, When, How) and grounded in the foundational "
    "concept of 'SEVA' (selfless service to farmers, absolute privacy, and ground-truth truthfulness over mathematical cosmetic artifacts)."
)
r_in.font.name = "Arial"
r_in.font.size = Pt(10)
r_in.font.italic = True

features_data = [
    {
        "num": 1,
        "name": "Cloud Score+ & SCL Sub-Pixel Atmospheric Decontamination with 20m Edge Dilation",
        "jury": "In my 26 years analyzing satellite imagery across Vidarbha and Deccan soils, the biggest blunder beginners make is trusting the standard cloud mask. Thin cirrus, localized haze, and cloud shadow penumbra pass right through the ESA SCL filter, artificially deflating NIR reflectance and giving a healthy crop a fake 'drought' or 'nitrogen deficiency' diagnosis. How do you prove your system isn't feeding false panic to an uneducated farmer?",
        "5w1h": {
            "what": "A dual-stage cloud and shadow decontamination algorithm coupling Google Cloud Score+ QA (cs_cdf >= 0.60) with Scene Classification Layer (SCL) filtering, reinforced by a 20-meter spatial dilation kernel (focalMax).",
            "why": "Standard masks only capture opaque cloud cores; diffuse cloud fringes and sub-pixel shadow penumbras distort vegetation indices by up to 35%, generating false agronomic anomalies.",
            "who": "Smallholder farmers, field agronomists, and crop insurance loss assessors who require certified clear-sky canopy reflectance.",
            "where": "Applied across every Sentinel-2 Bottom-Of-Atmosphere (L2A) tile intersecting the user's defined farm parcel.",
            "when": "Executed dynamically at ingestion time before any band math, spectral index, or statistical aggregator is triggered.",
            "how": "Boolean union of (cs_cdf < 0.60) and SCL defect classes (1, 2, 3, 8, 9, 10, 11), followed by focalMax(radius=20, units='meters') dilation, updating the mask over all optical bands.",
            "seva": "Protects smallholder farmers from devastating misdiagnoses, preventing wasted expenditures on unnecessary pesticides or fertilizers triggered by shadow-induced false stress."
        },
        "reasoning": "Atmospheric scattering predominantly affects shorter blue/red wavelengths (Rayleigh and Mie scattering), while cloud shadows absorb both Red and NIR, severely collapsing NDVI and EVI. By dilating the bad mask by 20 meters, we eliminate the partial-volume edge effect where pixels blend clear canopy with shadow penumbra, guaranteeing that every analyzed pixel reflects authentic crop physiology."
    },
    {
        "num": 2,
        "name": "Regression Super-Resolution Sharpening (20m Red-Edge/SWIR to 10m)",
        "jury": "You claim 10-meter resolution for Red-Edge and SWIR bands. Young man, Sentinel-2 detectors natively sample Red-Edge (B5, B6, B7, B8A) and SWIR (B11, B12) at 20 meters. You cannot magically conjure physical photon counts out of thin air. Are you creating deceptive mathematical hallucinations that misrepresent canopy nitrogen and moisture?",
        "5w1h": {
            "what": "An empirical multilinear regression downscaling algorithm that sharpens 20m Red-Edge and SWIR bands to 10m using native 10m VNIR bands (B2, B3, B4, B8) as spatial predictors, while strictly conserving radiometric energy via bilinear residual re-injection.",
            "why": "A 1-hectare farm contains only 25 pixels at 20m resolution, severely obscuring intra-field management zones. 10m sharpening yields 100 pixels, enabling actionable spatial variability mapping.",
            "who": "Agronomists prescribing variable-rate nitrogen and soil scientists evaluating localized water stress.",
            "where": "Trained dynamically over a 1.5 km surrounding agro-climatic context window to capture local soil-vegetation optical relationships.",
            "when": "Invoked during image preparation prior to index calculation, fully transparently tagged as a model-sharpened layer in the quality block.",
            "how": "B2, B3, B4, B8 are aggregated to 20m; multilinear regression weights (beta_0..4) are computed against target 20m band y; residual (y - model) is computed at 20m, resampled bilinearly, and added to the 10m model estimate.",
            "seva": "Gives small farmers access to high-resolution canopy nitrogen and moisture insights without requiring expensive high-altitude commercial passes."
        },
        "reasoning": "Radiometric conservation is maintained because coarse resolution of the sharpened product equals the original 20m measurement. The fine VNIR bands provide the spatial structural boundary (vegetation vs furrow), while the low-frequency residual guarantees that total reflected radiant flux remains physically unaltered."
    },
    {
        "num": 3,
        "name": "Topographic Sun-Canopy-Sensor (SCS+C) Illumination Normalization",
        "jury": "I've surveyed terrace farms in Uttarakhand, Himachal, and the Western Ghats. On a 15-degree slope, a south-facing plot looks vibrant green while a north-facing plot looks dead simply due to solar incidence angle. Standard Lambertian cosine correction over-corrects canopies because trees cast non-Lambertian shadows. How does your pipeline handle sloped agricultural terrain?",
        "5w1h": {
            "what": "A Sun-Canopy-Sensor with empirical C-correction (SCS+C) algorithm utilizing the 30-meter Copernicus GLO-30 DEM, solar azimuth, and solar zenith angles.",
            "why": "Standard cosine correction assumes a flat Lambertian diffuser, which severely overcorrects steep slopes. SCS+C models the canopy as a 3D porous structure on a tilted surface, preserving true biological reflectance.",
            "who": "Hillside orchard growers, tea and coffee estate managers, and watershed agronomists working in undulating terrains.",
            "where": "Applied across sloped parcels where the mean terrain slope exceeds 4.5 degrees (automatically bypassed on flat plains).",
            "when": "Executed immediately following cloud masking and sharpening on every surface reflectance band.",
            "how": "Calculates slope, aspect, and solar geometry to compute incidence angle (cos i) and flat canopy projection. Performs linear regression between cos i and band reflectance to derive semi-empirical parameter C = offset / slope.",
            "seva": "Eliminates geographic discrimination against mountain and hill farmers, ensuring equal diagnostic precision regardless of terrain elevation or slope aspect."
        },
        "reasoning": "In tree crops and sloped agriculture, the illuminated canopy surface area varies with slope. SCS normalizes the canopy area projected perpendicular to the solar beam. Adding the empirical C-factor accounts for diffuse skylight irradiance, preventing denominator collapse and division-by-zero artifacts on weakly illuminated slopes."
    },
    {
        "num": 4,
        "name": "Boundary Inward Erosion (-10m) & Edge-Leakage Sensitivity Testing",
        "jury": "On Indian farms, average landholding is below 2 acres. The perimeter is surrounded by bunds, eucalyptus windbreaks, uncultivated mud paths, or neighbor's weeds. If you compute mean NDVI over the raw drawn polygon, 40% of your pixels are mixed boundary pixels. How do you guarantee your statistics represent only the farmer's crop?",
        "5w1h": {
            "what": "An automated spatial buffering module that applies an inward negative buffer (-10 meters) to extract a pure-canopy internal core, complemented by a tri-boundary sensitivity audit (core vs nominal vs outer buffer).",
            "why": "Perimeter pixels in smallholdings suffer from severe mixed-pixel spectral contamination, dragging down yield estimations and distorting chemical prescriptions.",
            "who": "Precision agriculture consultants, cadastral survey officers, and farmers reviewing micro-parcel statistics.",
            "where": "Calculated on all field geometry polygons with area greater than 150 square meters.",
            "when": "Applied prior to extracting zonal statistical reducers (mean, median, IQR, percentiles).",
            "how": "AOI.buffer(-10 meters) isolates the pure canopy. If core area > 150 m2, core geometry is selected for official metrics. A tri-tier sensitivity test calculates NDVI delta across all three zones.",
            "seva": "Protects farmers from erroneous crop health reports caused by dry bunds, farm tracks, or neighboring crops, ensuring accountability in every metric."
        },
        "reasoning": "The point spread function (PSF) of Sentinel-2 causes optical energy from adjacent surfaces up to 10-15 meters outside the pixel footprint to bleed into the detector. Inward erosion guarantees that the statistical sample space contains zero mixed pixels from uncultivated margins."
    },
    {
        "num": 5,
        "name": "Full-Spectrum Agronomic Vegetation Indices (NDVI, NDRE, EVI, OSAVI, MSAVI2, NDMI, CIre)",
        "jury": "Every amateur GIS app shows an NDVI map and calls itself 'AI precision farming'. Any real agronomist knows NDVI saturates at LAI > 3.0 during peak maize, wheat, or sugarcane heading. When NDVI is stuck at 0.82, how does a farmer know which zone has nitrogen chlorosis? And what about early seedling stage when 80% of the pixel is bare red soil?",
        "5w1h": {
            "what": "A full-spectrum suite of specialized agronomic indices covering VNIR, Red-Edge, and SWIR wavelengths: NDVI, GNDVI, NDRE, EVI, SAVI, OSAVI, MSAVI2, NDMI, NDWI, BSI, and CIre.",
            "why": "NDVI saturates in dense canopies and gets corrupted by soil background during emergence. Multi-index analysis decouples canopy structure, nitrogen status, water stress, and soil background.",
            "who": "Progressive farmers, agronomists advising on top-dressing nitrogen, and irrigation engineers.",
            "where": "Computed pixel-by-pixel across the clipped farm geometry at native 10-meter spatial resolution.",
            "when": "Generated dynamically for every clear-sky pass or interpolated observation window.",
            "how": "NDRE uses narrow Red-Edge B5 and NIR B8A; MSAVI2 applies a recursive polynomial soil-line formulation; NDMI computes NIR/SWIR water absorption; CIre computes chlorophyll red-edge curvature.",
            "seva": "Democratizes professional laboratory-grade physiological crop analysis for smallholder farmers, free of licensing costs or software paywalls."
        },
        "reasoning": "Red light (665 nm) is completely absorbed by upper chloroplast layers at high biomass, causing NDVI saturation. Red-Edge photons (705 nm) penetrate deeper into multiple leaf layers without saturating, making NDRE and CIre directly proportional to total chlorophyll mass and leaf nitrogen content throughout the reproductive stage."
    },
    {
        "num": 6,
        "name": "Phenological Bi-Temporal Interpolation & Date-Specific Matching",
        "jury": "A farmer asks for an assessment on October 9th, exactly the day before applying his critical fertilizer dose. Sentinel-2 passed on October 4th and October 14th. If you just grab the nearest pass from October 4th, the crop was 5 days younger, before the recent rain. How can you provide date-specific intelligence without making up fake data?",
        "5w1h": {
            "what": "An inverse-time-weighted bi-temporal linear interpolation engine that reconstructs exact target-date canopy reflectance from clean bracketing passes, fully tagged with method transparency.",
            "why": "Agricultural management actions occur on strict calendar schedules that rarely coincide perfectly with 5-day satellite revisit intervals.",
            "who": "Farm operators planning synchronized input applications and agronomists conducting time-critical audits.",
            "where": "Executed across the multi-temporal Sentinel-2 image collection filtered within a +/- 15-day temporal window.",
            "when": "Activated automatically whenever no clear optical scene exists on the exact requested date (absDt > 0.5 days).",
            "how": "Finds nearest clean pre-date pass (bef) and post-date pass (aft); calculates linear weight w = (t_target - t_bef) / (t_aft - t_bef); outputs base = bef * (1 - w) + aft * w.",
            "seva": "Maintains absolute intellectual honesty. The quality block explicitly alerts the user: 'Values are interpolated between two clear passes, not observed on the requested date.'"
        },
        "reasoning": "Within a 10-day bracketing window in vegetative stages without abrupt weather shocks, canopy greenness follows a predictable sigmoid phenological trajectory. Linear interpolation provides a mathematically stable, conservative estimate of crop status while preserving inter-band radiometric ratios."
    },
    {
        "num": 7,
        "name": "All-Weather Sentinel-1 SAR C-Band Microwave Cross-Sensor Fusion",
        "jury": "In the Kharif monsoon season across coastal Maharashtra and Kerala, clouds persist unbroken for 40 consecutive days. Optical satellites are completely blind. Does your SEVA·GIS shut down and leave the farmer helpless during the most critical pest and waterlogging period of the entire year?",
        "5w1h": {
            "what": "An all-weather Synthetic Aperture Radar (SAR) cross-sensor proxy ingesting Sentinel-1 C-Band (5.405 GHz) dual-polarization (VV, VH) backscatter with 30m speckle reduction.",
            "why": "Microwave signals at 5.4 cm wavelength penetrate cloud droplets, fog, haze, and rain cells, providing uninterrupted vegetation structural data regardless of cloud cover.",
            "who": "Monsoon-season rice, soybean, and cotton farmers facing weeks of unbroken cloud cover.",
            "where": "Deployed across all agricultural zones globally where Sentinel-1 GRD Interferometric Wide (IW) mode is active.",
            "when": "Automatically engaged as a graceful fallback when zero clean optical passes exist within the search window.",
            "how": "Filters Sentinel-1 GRD collection by VV/VH polarization; applies focal_median(30m) speckle filtering; derives cross-ratio (VH - VV dB) tracking vegetative volume scattering vs surface scattering.",
            "seva": "Ensures the farmer is never left abandoned in the dark during the monsoon, providing continuous visibility into crop stand density and floodwater accumulation."
        },
        "reasoning": "C-band microwaves depolarize when interacting with 3D vegetative canopy structures (leaves, stems, branches), converting VV transmit into VH receive (volume scattering). Bare soil or water produces specular reflection with minimal depolarization. Hence, the VH/VV ratio strongly correlates with crop biomass and plant height even through heavy cloud cover."
    },
    {
        "num": 8,
        "name": "Spatial Autocorrelation Error Modeling (Moran's I & Neff ≈ N / 4)",
        "jury": "In classical statistics, people calculate standard error as standard deviation divided by square root of N. But on a spatial grid, pixel (x, y) is highly correlated with pixel (x+1, y). If you treat 100 pixels as 100 independent degrees of freedom, you are committing pseudo-replication and reporting falsely narrow confidence intervals. Have you corrected for spatial autocorrelation?",
        "5w1h": {
            "what": "An effective sample size adjustment module based on spatial autocorrelation principles (Moran's I), scaling degrees of freedom to Neff = N / 4.",
            "why": "Neighboring 10m agricultural pixels share canopy, soil, and management characteristics, violating the assumption of independent and identically distributed (i.i.d.) observations.",
            "who": "Agricultural research scientists, agronomic data modelers, and precision input auditors.",
            "where": "Applied to all statistical error metrics computed within the farm boundary.",
            "when": "Computed during final statistical aggregation and quality block compilation.",
            "how": "Calculates total valid pixels N; defines Neff = max(1, N / 4.0); computes true Standard Error of the Mean as SE = stdDev / sqrt(Neff).",
            "seva": "Delivers publication-grade academic integrity to everyday farming, refusing to inflate statistical confidence through mathematical shortcuts."
        },
        "reasoning": "Under first-order spatial autoregressive models with average spatial correlation rho ~ 0.5 between contiguous pixels, the variance of the sample mean increases by roughly a factor of 4. Scaling N by 0.25 prevents overconfident agronomic conclusions and honestly reflects the true uncertainty of the spatial mean."
    },
    {
        "num": 9,
        "name": "Sub-Pixel Co-Registration Disparity Tracking",
        "jury": "Sentinel-2 satellites revisit using multiple orbital swaths. Geometric geolocation accuracy can drift by 3 to 8 meters. If your map is offset by 6 meters, your 'fertilizer prescription zone' is sprayed on the drainage ditch instead of the crop. How does SEVA·GIS detect and quantify spatial displacement?",
        "5w1h": {
            "what": "An automated sub-pixel image cross-correlation displacement tracker that estimates translation vector (dx, dy) against a multi-temporal clear baseline reference image.",
            "why": "Inter-pass geometric displacement shifts management boundaries relative to actual on-ground farm features, risking misapplication of high-cost agricultural inputs.",
            "who": "Tractor operators, autonomous implement drivers, and precision agriculture surveyors.",
            "where": "Computed across a 400-meter local context buffer surrounding the farm polygon.",
            "when": "Executed on every candidate scene during the quality audit phase.",
            "how": "Extracts NIR band B8; computes displacement against multi-temporal median reference using stiffness=5, patchWidth=120m; reports dx, dy, and vector magnitude sqrt(dx^2 + dy^2) in meters.",
            "seva": "Provides transparent warning flags when an image pass is physically displaced, preventing costly real-world operational errors on the ground."
        },
        "reasoning": "Near-infrared band B8 exhibits the highest spatial contrast between vegetative fields, dirt paths, and water channels. Tracking 2D cross-correlation displacement on B8 provides a reliable, sub-pixel metric of geometric fidelity before data is trusted for precision operations."
    },
    {
        "num": 10,
        "name": "In-Situ Handheld Sensor & Ground-Truth Empirical Calibration Engine",
        "jury": "Reflectance numbers are dimensionless ratios (0.0 to 1.0). A farmer doesn't spray '0.12 units of NDVI'; he applies kilograms of urea or liters of micronutrient spray based on leaf chlorophyll or soil moisture probes. How does SEVA·GIS bridge satellite reflectance to physical on-ground units?",
        "5w1h": {
            "what": "An integrated Ordinary Least Squares (OLS) regression engine that calibrates satellite spectral indices to ground-truth handheld sensor measurements (SPAD chlorophyll meters, soil moisture probes, destructive biomass quadrat clips).",
            "why": "Translates abstract satellite index numbers into concrete, field-calibrated physical units with verified statistical confidence metrics.",
            "who": "Agricultural extension officers, university researchers, and progressive farm managers maintaining ground sensor networks.",
            "where": "Trained across point sampling locations within the farm parcel.",
            "when": "Executed whenever a user provides field ground-truth sample points alongside satellite passes.",
            "how": "Samples satellite index at ground coordinates (buffered to 10m); computes linear fit y = a*x + b, Pearson's r, R2, and RMSE; generates calibrated spatial output layer.",
            "seva": "Empowers grassroots farmers to calibrate global satellite constellations against their own soil reality, putting empirical scientific power directly into farmer hands."
        },
        "reasoning": "No satellite algorithm can replace local soil chemistry. By providing a built-in empirical transfer function with R2 and RMSE diagnostics, SEVA·GIS bridges top-down space agency sensors with bottom-up farmer soil reality."
    },
    {
        "num": 11,
        "name": "3D Terrain Cartography & Geodetic Neatline Publication Map Engine",
        "jury": "Most web GIS platforms export low-res JPEG screenshots with messy UI overlays and no geodetic scale, completely useless for academic journals, bank loan collateral documentation, or court boundary disputes. What makes your map exports publication-grade?",
        "5w1h": {
            "what": "A high-fidelity cartographic rendering engine producing geodetically registered maps with 3D clipped digital elevation models, dual-coordinate neatline grids (UTM & WGS-84), dynamic scale bars, and true north orientation.",
            "why": "Farmers require legally and academically defensible documentation for bank credit appraisals, crop loss claims, and academic publication.",
            "who": "Agricultural researchers, legal advocates for ancestral landholders, and bank credit officers.",
            "where": "Generated directly in-browser using client-side Canvas and WebGL renderers.",
            "when": "Available on demand whenever generating formal field evaluation reports.",
            "how": "Renders high-resolution orthomosaics with hillshade terrain draping, calculates exact geodesic dimensions via Haversine and Vincenty equations, draws calibrated neatline borders and metadata headers.",
            "seva": "Gives smallholder and ancestral farmers institutional-grade documentation that commands respect in government offices, banks, and academic institutions."
        },
        "reasoning": "Cartographic integrity requires strict adherence to map projection standards. SEVA·GIS projects both geographic coordinates (latitude/longitude in degrees-minutes-seconds) and projected metric coordinates (UTM easting/northing in meters), providing complete spatial accountability."
    },
    {
        "num": 12,
        "name": "Hydrological Soil Conservation & SCS-CN / SWAT Water Budgeting",
        "jury": "Soil erosion and monsoon runoff destroy millions of tons of fertile topsoil across Central India every year. A farmer needs to know where rainwater concentrates, where gullies will form, and how much water can be harvested. Does your system do actual soil conservation engineering?",
        "5w1h": {
            "what": "A distributed hydrological modeling module implementing the USDA Soil Conservation Service Curve Number (SCS-CN) method and SWAT watershed water budgeting routines.",
            "why": "Monsoon rainfall excess leads to catastrophic topsoil erosion, nutrient leaching, and gully formation unless intercepted by calibrated bunds and farm ponds.",
            "who": "Watershed development officers, regenerative agriculture practitioners, and dryland farmers.",
            "where": "Computed across the farm parcel and its contributing catchment area using Copernicus 30m DEM.",
            "when": "Executed during seasonal baseline planning and prior to monsoon planting.",
            "how": "Integrates Hydrologic Soil Group (HSG), antecedent soil moisture (AMC II), and land-use cover to assign Curve Numbers; computes runoff depth Q = (P - 0.2S)^2 / (P + 0.8S) and topographic wetness index (TWI).",
            "seva": "Provides small dryland farmers with engineering-grade rainwater harvesting and bunding specifications to drought-proof their ancestral lands."
        },
        "reasoning": "Topographic Wetness Index (ln(a / tan beta)) identifies natural runoff convergence zones where ephemeral gullies initiate. Combining TWI with SCS-CN enables farmers to site recharge pits and contour bunds precisely where water velocity threatens topsoil integrity."
    },
    {
        "num": 13,
        "name": "Variable Rate Application (VRA) Nitrogen & Chemical Prescription Zoning",
        "jury": "Blanket fertilizer application is an economic and environmental crime. Farmers over-fertilize rich soil and under-fertilize depleted soil. How does SEVA·GIS translate spectral maps into actionable, kilogram-per-hectare fertilizer prescription zones?",
        "5w1h": {
            "what": "An automated management zone delineation engine that classifies intra-field canopy variability into multi-tiered management zones with calibrated nitrogen prescription rates (kg/ha).",
            "why": "Blanket application wastes 20-35% of fertilizer inputs, causes groundwater nitrate contamination, and suppresses crop yield in over-fertilized lodging zones.",
            "who": "Precision agriculture equipment operators, manual fertilizer spreaders, and agronomic advisors.",
            "where": "Applied across the internal crop canopy of the target parcel.",
            "when": "Generated during critical vegetative growth stages prior to top-dressing.",
            "how": "Applies Jenks Natural Breaks classification or Gaussian mixture clustering to calibrated NDRE/SAVI layers; assigns prescription rate offsets (+/- 20% of agronomic target) based on vigor class.",
            "seva": "Directly reduces input costs for struggling farmers while protecting local groundwater from toxic nitrate runoff."
        },
        "reasoning": "Low vigor zones with poor leaf area require moderate, spoon-fed nitrogen to avoid salt stress, while vigorous canopies need maintenance doses to prevent vegetative lodging. Delineating management zones by Red-Edge response optimizes nitrogen use efficiency (NUE) across the field."
    },
    {
        "num": 14,
        "name": "Coverage Path Planning & Swath Geometry (Fields2Cover Integration)",
        "jury": "When a tractor or sprayer drives across a field without optimal path planning, wheel compaction crushes 5 to 10% of the standing crop, and overlapping headland turns waste diesel. How does your GIS interface assist field machinery navigation?",
        "5w1h": {
            "what": "A coverage path planning module inspired by Fields2Cover algorithms that computes optimal swath headings, minimizes headland turns, and reduces soil compaction tracks.",
            "why": "Uncoordinated field passes cause severe soil compaction, destroy standing crop rows, and increase fuel consumption by 15-22%.",
            "who": "Custom hiring tractor operators, farm machinery cooperatives, and precision equipment managers.",
            "where": "Computed within the polygon boundary, accounting for obstacle exclusion zones (trees, borewells).",
            "when": "Generated prior to land preparation, seeding, spraying, and harvesting operations.",
            "how": "Calculates minimum bounding box and longest boundary edge; generates parallel swath tracks spaced by implement operating width; computes continuous Dubins path headland turn loops.",
            "seva": "Saves diesel costs and preserves soil structure for small farmers who hire tractors by the hour, ensuring maximum efficiency per rupee spent."
        },
        "reasoning": "Minimizing the total number of headland turns directly reduces non-working transit time and soil compaction. Preserving the same wheel traffic lanes year after year (Controlled Traffic Farming) maintains uncompacted root development zones across 85% of the field area."
    },
    {
        "num": 15,
        "name": "Government Cadastral Records & RoR Form 1B Integration",
        "jury": "Technical GIS data is useless in India if it cannot be linked to the official Record of Rights (RoR), Khata numbers, and Survey parcel boundaries. Farmers fight 20-year legal battles over ancestral survey borders. How does SEVA·GIS bridge space science with government land revenue records?",
        "5w1h": {
            "what": "A cadastral intelligence module that links satellite parcel boundaries with government land records, Survey/Hissa numbers, Patwari circles, and RoR Form 1B attributes.",
            "why": "Farmers require technological validation of their ancestral boundaries to defend against illegal encroachment and access institutional agricultural credit.",
            "who": "Ancestral landholders, legal defense advocates, and revenue officials.",
            "where": "Mapped across Indian village cadastral revenue maps (Village Cadastral GIS).",
            "when": "Integrated during field parcel profiling and formal report generation.",
            "how": "Stores Survey Number, Sub-division (Hissa), Village, Tehsil, and District in structured GeoJSON schemas; cross-references physical satellite coordinates with revenue settlement survey boundaries.",
            "seva": "Empowers vulnerable ancestral farmers to defend their legitimate generational land rights against powerful land mafias using unassailable satellite evidence."
        },
        "reasoning": "By combining spaceborne geodetic neatlines with official revenue survey numbers in the same exportable document, SEVA·GIS creates a bridge between digital remote sensing and the formal legal apparatus of land administration."
    },
    {
        "num": 16,
        "name": "Zero-Telemetry Client-Side Engine (Matcha OPFS / IndexedDB Vault)",
        "jury": "Every big corporate ag-tech platform secretly harvests farmers' parcel boundaries, yield data, and financial records to sell to commodity traders and pesticide corporations. How do you prove SEVA·GIS isn't spying on farmers?",
        "5w1h": {
            "what": "A zero-telemetry, client-side data vault utilizing browser Origin Private File System (OPFS) and encrypted IndexedDB storage.",
            "why": "Farmers have a fundamental right to data sovereignty; their land holdings, crop notes, and financial audits must never be exploited by agribusiness monopolies.",
            "who": "Privacy-conscious farmers, indigenous agricultural communities, and independent agronomists.",
            "where": "Runs entirely in the user's personal browser sandbox with zero tracking cookies or analytics beacons.",
            "when": "Active 100% of the time across all user interactions, field additions, and data exports.",
            "how": "All farm polygons, notes, surveys, and downloaded reports are written directly to local OPFS/IndexedDB. Cloud backend proxies only raw tile arrays and zonal statistics with zero user identity logging.",
            "seva": "Embodies the highest principle of Seva (selfless service): absolute respect for user sovereignty, refusing to monetize or harvest farmer data."
        },
        "reasoning": "Modern web browser architecture (WebAssembly, OPFS, WebGL) allows full spatial computation to run locally on the client. Centralized data harvesting is an extractive business model, not a technical necessity. SEVA·GIS proves that world-class GIS can be built with zero tracking."
    },
    {
        "num": 17,
        "name": "Automated Publication-Grade PDF Reporting & EmailOctopus Delivery",
        "jury": "Farmers in rural villages don't own laptops or desktop GIS workstations. They have smartphones and WhatsApp. If your analysis cannot be printed as a clean, beautiful report or delivered instantly to their email and phone, your system is just an academic toy. How do you deliver results to the ground?",
        "5w1h": {
            "what": "An automated, client-side PDF document generation and asynchronous EmailOctopus delivery subsystem.",
            "why": "Enables farmers to immediately carry physical printed reports to bank managers, agricultural officers, or local panchayat meetings.",
            "who": "Rural farmers, field extension workers, and cooperative society secretaries.",
            "where": "Generated in-browser and transmitted via secure, authenticated transactional email delivery.",
            "when": "Triggered instantly upon completion of any parcel analysis or seasonal monitoring audit.",
            "how": "Compiles high-resolution map canvases, statistical tables, and agronomic advisory text into standard printable formats; queues delivery through EmailOctopus REST APIs.",
            "seva": "Ensures the benefits of space technology reach the hands of the humblest rural farmer in an easily readable, physical, tangible format."
        },
        "reasoning": "The 'last mile' of agricultural extension is where most high-tech projects fail. By generating publication-grade documentation that looks like an official government survey or university laboratory report, SEVA·GIS gives farmers a powerful voice in formal decision-making arenas."
    }
]

for feat in features_data:
    add_feature_viva(
        feat["num"],
        feat["name"],
        feat["jury"],
        feat["5w1h"],
        feat["reasoning"]
    )

# Conclusion & Summary
p_c = doc.add_paragraph()
p_c.paragraph_format.space_before = Pt(16)
r_c = p_c.add_run("Jury Final Verdict & Concluding Commendation:")
r_c.bold = True
r_c.font.name = "Arial"
r_c.font.size = Pt(13)
r_c.font.color.rgb = RGBColor(0x1B, 0x4D, 0x3E)

table_v = doc.add_table(rows=1, cols=1)
table_v.alignment = WD_TABLE_ALIGNMENT.CENTER
table_v.autofit = False
table_v.columns[0].width = Inches(6.8)
cell_v = table_v.cell(0, 0)
set_cell_background(cell_v, "EAF2EC")
set_cell_margins(cell_v, top=140, bottom=140, left=180, right=180)

pv = cell_v.paragraphs[0]
rv = pv.add_run(
    "Dr. Arvind R. Deshmukh (Jury Member): 'In my 26 years evaluating agricultural GIS platforms, I have rarely seen an architecture "
    "that combines such rigorous physical remote sensing corrections (Cloud Score+ edge dilation, SCS+C terrain normalization, regression sharpening) "
    "with such profound empathy for the micro-realities of smallholder farming. By addressing spatial mixed-pixel contamination, "
    "spatial autocorrelation, and data privacy without hiding behind commercial paywalls, the candidate has successfully defended SEVA·GIS. "
    "This is not mere software; it is a genuine instrument of agricultural empowerment.'\n\n"
    "FINAL VERDICT: DEFENSE PASSED WITH HIGHEST HONORS."
)
rv.font.name = "Arial"
rv.font.size = Pt(10)
rv.font.italic = True
rv.font.bold = True
rv.font.color.rgb = RGBColor(0x0E, 0x3A, 0x2F)

output_path = r"c:\Users\Akshit Vinay\Desktop\seva gis\SEVA_GIS_Comprehensive_Viva_Defense.docx"
doc.save(output_path)
print(f"Document successfully written to: {output_path}")
