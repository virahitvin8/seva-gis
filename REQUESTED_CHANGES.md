# Comprehensive List of Requested Changes for SEVA.GIS Rebuild

## SECTION 1: CORE FUNCTIONALITY & USER EXPERIENCE

### 1.1 Map Display & Navigation
- [ ] Fix farm switching lag/unresponsiveness when changing between farms
- [ ] Ensure area of interest (AOI) is always centered in map views
- [ ] Set default zoom level to 13x for main map (prevents pixelation)
- [ ] Set zoom level to 19x for ALL remote field review maps (crop, vegetation, etc.)
- [ ] Ensure AOI boundary never gets overlapped by scale, north arrow, title, legend, or other UI elements
- [ ] Automatic resizing of UI elements when they would overlap AOI
- [ ] Add scroll symbol in focus mode for map navigation
- [ ] Fix map canvas background to show only boundary line highlighted, rest dark (not fully black/white)
- [ ] Implement proper AOI clipping for all raster layers (not just boundary display)
- [ ] Add layer box that is detachable and movable anywhere on screen
- [ ] Add symbology controls with cubic/bilinear/nearest neighbor options
- [ ] Add grid measurement tools
- [ ] Add borewell and pipeline placement tools that don't interfere with measurement tools
- [ ] Add auto-construct feature
- [ ] Remove land passbook section entirely
- [ ] Remove cadastral/land registry section entirely
- [ ] Remove SWATH hydrological cycle and Vayganga basin references entirely
- [ ] Add mineral identification and slope analysis tools in parameters section

### 1.2 Remote Field Review Maps
- [ ] Implement "mirror window" feature for showing/hiding points on maps
- [ ] Window should follow mouse cursor or hand movement
- [ ] Display normally the land cover map beside management zones/vegetation map
- [ ] When window slides over area, show points/data there upon the map
- [ ] Hide points when window is not over area
- [ ] Apply to: crop and vegetation map, Geo AI Studios, pest and disease maps, time lapse, etc.
- [ ] For spectral groups (3,4,5): create window section or area below map to toggle numbers display
- [ ] Allow user to select how many spectral groups to display (1,2,3,4,5)

### 1.3 Reports & Export
- [ ] Fix PDF download to not be 0 KB
- [ ] Add Word (.doc) export option alongside HTML, PDF, JSON
- [ ] Fix report preview hang issue
- [ ] Ensure email attachment sends actual file (not just shows as sent)
- [ ] Fix email name to show actual user name (not "custodian of [farm name]")
- [ ] Remove or improve greeting card quality (make it visually better)
- [ ] Ensure generated report maps follow same rules: AOI centered, no overlap, zoom fixed to 19-20x
- [ ] Ensure report maps have proper legends, scale, north arrow that don't overlap AOI
- [ ] Make report generation fully automated (remove manual steps where possible)
- [ ] Add option to select download format before generation
- [ ] Fix email Octopus integration to actually send emails
- [ ] Ensure report maps are not stagnant/demo images - they should reflect actual analysis

### 1.4 Localization & Language
- [ ] Fix language switching lag/unresponsiveness
- [ ] Ensure language changes persist after refresh (not revert to Telugu)
- [ ] Make sure when user selects English, it stays English until changed
- [ ] Only front page should be in English when language selected - rest should be in selected language
- [ ] When user clicks on language, entire interface should change to that language
- [ ] Remove translated text that doesn't make sense (literal translations)
- [ ] Ensure proper contextual translation, not word-for-word

### 1.5 Mitra (Guide/Tour System)
- [ ] Update Mitra after each change
- [ ] Fix Mitra lag when showing "where is what and where is where"
- [ ] Reduce time to shift between steps (currently 5-10 seconds)
- [ ] Make Mitra transitions smooth and responsive

## SECTION 2: DATA VISUALIZATION & SCIENTIFIC DISPLAY

### 2.1 General Visualization Principles
- [ ] All scientific terms must be properly explained in layman's terms
- [ ] Replace "explain like a friend" with clear, accurate explanations
- [ ] Remove stagnant PNG/demo data - all visuals must reflect actual analysis
- [ ] Make all charts/interactive elements actually interactive (show values on hover/click)
- [ ] Implement playing card-style animations for insight boxes (flip to show details, flip back)
- [ ] Add smooth transitions and animations when clicking on insight boxes
- [ ] Display information in middle of screen like playing cards when boxes are clicked
- [ ] Same for weather/atmosphere, soil properties, terrain sections

### 2.2 Specific Map Types & Visualizations
#### NDVI/Vegetation Health
- [ ] Fix NDVI legend to be understandable
- [ ] Show actual NDVI value with proper color scale
- [ ] Display stress percentage with explanation
- [ ] Add scientific reasoning that users can understand

#### Soil Moisture
- [ ] Fix surface soil moisture module display
- [ ] Show actual moisture percentage with optimal range indicators
- [ ] Explain what happens if moisture is too low or too high
- [ ] Show wilting point, field capacity, saturation limits

#### Rainfall Outlook
- [ ] Fix 7-day rainfall display
- [ ] Show if rainfall is sufficient or deficit for crop
- [ ] Provide actionable advice (when to irrigate, etc.)
- [ ] Show weekly crop demand comparison

#### Terrain & Elevation
- [ ] Fix elevation/slope display
- [ ] Show actual elevation in meters
- [ ] Display slope percentage with grade classification
- [ ] Explain what different slope grades mean for farming

#### LULC (Land Use Land Cover)
- [ ] Fix LULC classification to actually show classification (not just true color)
- [ ] Add proper LSWAT/SWAT legend
- [ ] Show class areas in hectares and percentages
- [ ] Generate proper LULC matrix and visualizations

#### Weather & Atmosphere
- [ ] Make 3D visualization with motion gitripoglu
- [ ] Use the gitripoglu provided for weather visualization
- [ ] Make it interactive and responsive

#### Water Budget & Hydrology
- [ ] Remove SWATH hydrological cycle and Vayganga references entirely
- [ ] Make water budget automatic (not manual)
- [ ] Add animations/transitions when clicking water budget boxes
- [ ] Consider adding GIFs for each water budget component
- [ ] Ensure all water-related calculations are based on selected AOI
- [ ] Remove agronomy season calendar section

#### Field Intelligence
- [ ] Fix all scientific terms with proper explanations
- [ ] Show minimum/maximum values for each metric
- [ ] Explain what happens when values are outside optimal ranges
- [ ] Add proper context for readings (e.g., "32% moisture is optimal because...")

#### Crop General & Spectral Insights
- [ ] Implement animated transitions when clicking on insight boxes
- [ ] Make boxes flip like playing cards to show detailed information
- [ ] Flip back when clicking again or clicking outside
- [ ] Same treatment for all insight boxes (crop greenness, moisture, canopy, etc.)

### 2.3 Charts & Graphs
- [ ] Make all charts interactive (show exact values on hover/click)
- [ ] Implement MATLAB-generated graphs for monitoring/change sections
- [ ] Ensure time lapse charts are interactive
- [ ] Make pest and disease charts show actual risk levels
- [ ] Ensure all graphs reflect actual data from selected AOI
- [ ] Remove stagnant/demo chart data

## SECTION 3: PERFORMANCE & TECHNICAL

### 3.1 Loading & Responsiveness
- [ ] Fix page unresponsiveness/lag when switching farms
- [ ] Fix language switching lag
- [ ] Fix Mitra lag
- [ ] Implement proper loading states (not just frozen UI)
- [ ] Add loading spinner/skeleton UI during data processing
- [ ] Add accessible status messages for screen readers
- [ ] Implement proper error boundaries
- [ ] Optimize re-renders to prevent unnecessary updates

### 3.2 Map Processing & Animation
- [ ] Implement boundary processing animation (soft green rail, luminous tail, comet orbit)
- [ ] Use useBoundaryProcessing.ts and seva-boundary-processing.css
- [ ] Show animated traveling pulse/train signal along AOI boundary during processing
- [ ] Ensure animation scales to different farm sizes (normalized pathLength)
- [ ] Clean up all layers when processing ends, farms change, or component unmounts
- [ ] Support reduced motion preference (static perimeter when requested)
- [ ] Add accessible status near map: "Processing map layers…" during busy/loading

### 3.3 Data Processing & Caching
- [ ] Implement proper caching for expensive operations
- [ ] Add background processing where appropriate
- [ ] Implement web workers for heavy computations (using thoughtdag approach)
- [ ] Add proper error handling for EE/GEE failures
- [ ] Implement retry mechanisms with exponential backoff
- [ ] Add rate limiting to prevent EE quota exhaustion

## SECTION 4: CONTENT & INFORMATION ARCHITECTURE

### 4.1 Information Hierarchy
- [ ] Ensure most important information is prominent
- [ ] Remove redundant information displays
- [ ] Group related information logically
- [ ] Use progressive disclosure for advanced/scientific details
- [ ] Keep simple view for non-technical users, advanced view accessible

### 4.2 Help & Documentation
- [ ] Update all tooltips and help text to be accurate
- [ ] Fix broken or outdated help links
- [ ] Ensure all icons have meaningful tooltips
- [ ] Add contextual help for complex features
- [ ] Update Mitra scripts to reflect current functionality

### 4.3 Privacy & Data Handling
- [ ] Ensure all data remains local unless user explicitly requests remote operations
- [ ] Make privacy controls clear and accessible
- [ ] Add clear explanations of what data is sent where
- [ ] Implement proper consent mechanisms for data sharing
- [ ] Add data export controls (what gets exported, in what format)

## SECTION 5: REVERSE ENGINEERING INTEGRATION TARGETS

### 5.1 QGIS Integration
- [ ] Port key processing algorithms to Python/NumPy:
  - Priority-flood depression fill
  - D8 flow directions
  - D8 flow accumulation
  - Stream network extraction
  - Zonal statistics
  - Raster calculator operations
  - Symbology and classification engines
  - Print composer/layout tools
  - Geoprocessing framework
  - Plugin architecture patterns

### 5.2 MATLAB Integration
- [ ] Translate key toolboxes to Python:
  - Image Processing Toolbox (for NDVI, indices, classification)
  - Mapping Toolbox (for geoprocessing, map creation)
  - Statistics Toolbox (for analysis, modeling)
  - Optimization Toolbox (for model fitting)
  - Signal Processing Toolbox (for time series)
  - Control System Toolbox (for irrigation modeling)

### 5.3 ArcGIS/ArcMap Integration
- [ ] Implement key geoprocessing tools:
  - Spatial Analyst (slope, aspect, hydrology)
  - 3D Analyst (terrain visualization)
  - Network Analyst (for irrigation channels)
  - Cartographic tools (symbology, layout)
  - Geostatistical Analyst (for interpolation)
  - ModelBuilder equivalent (for workflow chaining)

### 5.4 Google Earth Engine Integration
- [ ] Enhance existing EE proxy with:
  - All available ImageCollections (Landsat, MODIS, etc.)
  - Advanced reducers and statistics
  - Machine learning capabilities
  - Export optimizations
  - Cloud Run deployment patterns
  - Asset management and sharing

### 5.5 Motion & Animation Systems
- [ ] Implement motion-web for:
  - Sign-in page with real physics
  - High-touch creative interactions
  - Automated verification of animations
  - Three.js/Canvas 2D/WebGL/CSS options
- [ ] Implement scroll-craft for:
  - Scroll-triggered animations throughout app
  - Parallax effects
  - Reveal animations on scroll
  - Sticky elements with scroll-based behavior

### 5.6 Reporting & Design Systems
- [ ] Implement storytold/* for:
  - Professional PDF report generation (pdfcraft)
  - Responsive dashboard layouts (gridcraft)
  - SVG manipulation and cartographic symbols (vectorcraft)
  - Design system and component library (designcraft)
  - Visual effects and transitions (effectcraft)
  - Diagram design principles (diagram-design)

## SECTION 6: VERIFICATION & QUALITY ASSURANCE

### 6.1 Testing Framework
- [ ] Implement automated unit tests for all ported algorithms
- [ ] Add integration tests for EE/GEE interactions
- [ ] Create end-to-end tests for critical user workflows
- [ ] Implement visual regression testing for UI changes
- [ ] Add performance benchmarks and monitoring

### 6.2 Verification Tools
- [ ] Use mattpocock/skills for final engineering verification
- [ ] Implement alibaba/open-code-review for automated code review
- [ ] Use feitangyuan/motion-web for motion verification
- [ ] Add code quality checks (eslint, prettier, typescript strictness)

### 6.3 Documentation
- [ ] Update README with clear installation and usage instructions
- [ ] Add API documentation for backend services
- [ ] Create contributor guidelines
- [ ] Add changelog and release notes
- [ ] Create architecture decision records (ADRs)

---

## IMPLEMENTATION APPROACH

### Phase 1: Foundation & Critical Fixes
1. Fix farm switching lag and responsiveness issues
2. Fix language switching persistence
3. Implement proper AOI centering and zoom rules (13x main, 19x review)
4. Fix boundary processing animation
5. Fix PDF/download functionality

### Phase 2: Core Visualization & Interaction
1. Implement all scientific explanation improvements
2. Add playing card animations for insight boxes
3. Implement mirror window feature for maps
4. Fix all chart/interactivity issues
5. Implement proper localization system

### Phase 3: Advanced Features & Integrations
1. Begin reverse engineering integration (QGIS algorithms first)
2. Implement motion systems (motion-web, scroll-craft)
3. Enhance reporting capabilities (storytold/*)
4. Add advanced mapping and analysis tools

### Phase 4: Polish & Verification
1. Complete all remaining integrations
2. Implement comprehensive testing
3. Performance optimization and tuning
4. Final verification with mattpocock/skills
5. Documentation and release preparation

---

## SUCCESS CRITERIA

- [ ] No more unresponsive/frozen UI during normal operations
- [ ] Language changes persist correctly
- [ ] AOI always centered, never overlapped by UI elements
- [ ] All maps show actual analysis data (no stagnant/demo data)
- [ ] All scientific information is properly explained and understandable
- [ ] Interactive elements actually work and provide meaningful feedback
- [ ] PDF/export functionality works correctly with proper formatting
- [ ] Email integration actually sends files with correct information
- [ ] All animations are smooth and respect reduced motion preferences
- [ ] System performs well on target devices (phones, tablets, low-end laptops)
- [ ] Privacy controls work as expected
- [ ] All requested features from the analysis are implemented