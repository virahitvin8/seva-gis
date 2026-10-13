# GitHub Repositories Analysis for SEVA.GIS Rebuild

## Core Target Repository
| Repo | Purpose | Status |
|------|---------|--------|
| **virahitvin8/seva-gis** | Main target - SEVA.GIS: Spatial Evaluation & Vegetation Analytics | Primary rebuild target |

---

## Reverse Engineering Targets (The "Big 4")

| # | Repository | Target For | Key Features to Extract |
|---|------------|------------|------------------------|
| 1 | **qgis/qgis** | QGIS Core | Vector/raster processing algorithms, PyQGIS API, processing framework, symbology engine, print composer, plugin architecture |
| 2 | **Esri (ArcGIS)** | ArcGIS Pro/ArcMap | ArcPy, geoprocessing tools, spatial analyst, 3D analyst, network analyst, cartographic representation |
| 3 | **mathworks** (MATLAB) | MATLAB | Image Processing Toolbox, Mapping Toolbox, Statistics Toolbox, optimization, signal processing for agriculture |
| 4 | **gee-community / Google Earth Engine** | GEE | EE JavaScript/Python API, ImageCollection filtering, reducers, visualization, export, Cloud Run deployment |

**Reverse Engineering Tool:**
- **morluto/rea** - Reverse engineer app behavior down to native binaries for all 4 targets

---

## Design & Motion Systems

| Repository | Purpose | Features to Integrate |
|------------|---------|----------------------|
| **feitangyuan/motion-web** | Motion-first creative websites | Three.js/Canvas 2D/WebGL/CSS animations, real physics, automated verification - **for sign-in page design** |
| **nateherkai/scroll-craft** | Scroll-driven animations | **CHANGE WHOLE SEVA GIS** - scroll-triggered transitions, parallax, reveal animations |
| **cathrynlavery/diagram-design** | Diagram design principles | Technical diagram layouts, flow charts, architecture diagrams |
| **heygen-com/hyperframes** | Video/frame generation | **BUILD FOR GIT README** - automated video generation for documentation |
| **storytold/pdfcraft** | PDF generation | Professional PDF reports with cartographic layouts |
| **storytold/gridcraft** | Grid layouts | Dashboard grid systems, responsive layouts |
| **storytold/vectorcraft** | Vector graphics | SVG manipulation, cartographic symbols |
| **storytold/designcraft** | Design system | Component library, theming |
| **storytold/effectcraft** | Visual effects | Shaders, post-processing, transitions |

---

## AI/Agent Frameworks (For Architecture)

| Repository | Purpose |
|------------|---------|
| **langchain-ai/langchain** | LLM orchestration, chains, agents |
| **browser-use/browser-use** | Browser automation for testing/scraping |
| **crewaiinc/crewai** | Multi-agent crews for complex workflows |
| **code-yeongyu/oh-my-openagent** | Open agent framework |
| **addyosmani/agent-skills** | Agent skill patterns |
| **supabase/agent-skills** | Supabase-integrated agents |
| **anthropics/knowledge-work-plugins** | Plugin architecture for knowledge work |
| **apify/apify-mcp-server** | MCP server for web scraping |
| **sickn33/agentic-awesome-skills** | Curated agent skills |
| **mukul975/anthropic-cybersecurity-skills** | Security-focused skills |

---

## GIS & Remote Sensing References

| Repository | Purpose |
|------------|---------|
| **opengeos/Awesome-GEE** | Curated GEE scripts, datasets, tutorials |
| **chenxiachan/thoughtdag** | Native localization & Web Worker raster processing |
| **thedotmack/claude-mem** | Memory/persistence for agents |
| **dair-ai/prompt-engineering-guide** | Prompt engineering best practices |
| **thedaviddias/front-end-checklist** | Frontend quality checklist |
| **blader/humanizer** | Human-like text generation |
| **expo/skills** | Expo/React Native skills |
| **p bakaus/impeccable** | Code quality/perfection |

---

## Verification & Quality

| Repository | Purpose |
|------------|---------|
| **mattpocock/skills** | Skills for Real Engineers - **FINAL VERIFICATION** |
| **alibaba/open-code-review** | Automated code review |
| **feitangyuan/motion-web** | Automated verification for motion |

---

## Feature Extraction Priority Matrix

| Priority | Repo | Features for SEVA.GIS |
|----------|------|----------------------|
| **P0 - Critical** | qgis/qgis | All processing algorithms, symbology, print composer |
| **P0 - Critical** | gee-community | All EE collections, reducers, visualization, export |
| **P0 - Critical** | mathworks | Image processing, mapping, stats for agriculture |
| **P0 - Critical** | Esri | Geoprocessing, spatial analyst, 3D, cartography |
| **P1 - High** | featangyuan/motion-web | Sign-in page motion design, physics-based animations |
| **P1 - High** | nateherkai/scroll-craft | Full app scroll-driven UX overhaul |
| **P1 - High** | storytold/* (5 repos) | Professional reporting, PDF, grids, vectors, effects |
| **P2 - Medium** | langchain/crewai/browser-use | Agentic workflows for automated analysis |
| **P2 - Medium** | chenxiachan/thoughtdag | Web Worker raster processing, localization |
| **P3 - Enhancement** | Others | Code quality, plugins, memory, prompts |

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SEVA.GIS REBUILD                          │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React 19 + Vite + Tailwind v4 + Motion)          │
│  ├── motion-web (sign-in, transitions, physics)             │
│  ├── scroll-craft (entire app scroll UX)                    │
│  ├── storytold/* (PDF, reports, grids, vectors, effects)    │
│  └── thoughtdag (Web Workers, localization)                 │
├─────────────────────────────────────────────────────────────┤
│  Backend (Python FastAPI + GEE Proxy)                       │
│  ├── qgis algorithms (ported to Python/NumPy)               │
│  ├── GEE Python API (server-side processing)                │
│  ├── MATLAB algorithms (translated to Python/NumPy)         │
│  └── ArcGIS tools (reimplemented via GDAL/rasterio)         │
├─────────────────────────────────────────────────────────────┤
│  Agent Layer (Optional - for automated workflows)           │
│  ├── langchain/crewai for multi-step analysis               │
│  └── browser-use for validation/testing                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Technical Decisions Needed

1. **QGIS Algorithms**: Port to Python (NumPy/SciPy) vs. PyQGIS server-side vs. WASM
2. **MATLAB Tools**: Translate to Python vs. compile to standalone vs. MATLAB Web App Server
3. **ArcGIS Tools**: Reimplement via GDAL/rasterio/rioxarray vs. ArcPy server
4. **GEE**: Keep proxy pattern vs. direct client-side with service account
5. **Motion**: CSS-first with motion-web enhancements vs. full Three.js
6. **PDF Reports**: storytold/pdfcraft vs. reportlab vs. weasyprint vs. puppeteer
7. **Localization**: thoughtdag approach vs. react-i18next vs. custom
8. **State Management**: Current React state vs. Zustand vs. Redux Toolkit