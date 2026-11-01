# SEVA·GIS ⟷ Gemini 4 Argon (`gemini-4-argon`) Deep GeoAI Integration
**Google AI Studio Reference Application**: `3bb45d74-02be-40e3-96b3-0a34b3b5fd16`  
**Execution Paradigm**: Google AI Studio Interactions API (`v1beta/interactions`)  
**Target Model Tier**: `gemini-4-argon` with `thinking_level: "high"`  
**Superceded Models**: Deprecates `gemini-3.8-flash` for multi-spectral agronomic inference and field-boundary reasoning.

---

## 1. Executive Summary & Model Architecture

The Google AI Studio application (`3bb45d74-02be-40e3-96b3-0a34b3b5fd16`) specifies the integration of Google's flagship reasoning foundation model: **Gemini 4 Argon (`gemini-4-argon`)**.

Unlike legacy flash models (such as `gemini-3.8-flash`), which execute shallow heuristic text completion with limited step-by-step physical reasoning, **Gemini 4 Argon** supports an explicit reasoning budget configured via `thinking_level: "high"`. In SEVA·GIS, this capability is harnessed to solve the most difficult problems in remote sensing agronomy:

1. **Spectral Divergence Disentanglement**:
   - Resolving nitrogen chlorosis from drought stress: When broadband NDVI is moderately high ($\ge 0.60$) but Red-Edge NDRE is severely depressed ($\le 0.28$), Argon recognizes early foliar chlorophyll exhaustion *prior* to visual leaf yellowing, recommending variable-rate nano-urea rather than needless irrigation.
   - Conversely, when NDMI drops below $0.12$ while NDRE remains stable, Argon deduces stomatal closure and root-zone water depletion, prescribing immediate twilight irrigation and forbidding urea top-dressing to prevent leaf scorch.

2. **Topographic & Hydrodynamic Fusion**:
   - Multi-factor spatial reasoning combining SRTM 30m elevation and D8 flow direction with Sentinel-2 multi-spectral reflectance.
   - Diagnosing why high-slope parcel sectors suffer accelerated drying and prescribing contour bunding or furrow mulching.

3. **Field Dispatch Trilingual Localization**:
   - Synthesizing concise SMS alerts in English, Hindi (हिन्दी), and Telugu (తెలుగు) formatted for transmission via the field OpenSMS SIM Gateway (`http://10.65.171.208:9292/sms/`).

---

## 2. API Contract & Parameter Configuration

### Endpoint
```http
POST https://generativelanguage.googleapis.com/v1beta/interactions
x-goog-api-key: {YOUR_GOOGLE_AI_STUDIO_API_KEY}
Content-Type: application/json
```

### JSON Request Payload
```json
{
  "model": "gemini-4-argon",
  "input": "...",
  "generation_config": {
    "thinking_level": "high",
    "response_mime_type": "application/json",
    "temperature": 0.2,
    "max_output_tokens": 65536
  }
}
```

### Fallback Endpoint (generateContent)
```http
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-4-argon:generateContent?key={API_KEY}
```
Payload:
```json
{
  "contents": [{ "parts": [{ "text": "..." }] }],
  "generationConfig": {
    "thinkingConfig": { "thinkingLevel": "high" },
    "responseMimeType": "application/json",
    "temperature": 0.2
  }
}
```

---

## 3. SEVA·GIS Integration Architecture

```
                  ┌────────────────────────────────────────┐
                  │          SEVA·GIS Client UI            │
                  │  (TopBar, Intelligence, Node Studio)  │
                  └──────────────────┬─────────────────────┘
                                     │
                     Farm Telemetry  │  (NDVI, NDRE, NDMI, Slope)
                                     ▼
                  ┌────────────────────────────────────────┐
                  │      src/services/geminiArgonService   │
                  │  • Checks for Stored Google AI Studio   │
                  │    API Key (localStorage / env)        │
                  └─────────┬────────────────────┬─────────┘
                            │                    │
              API Key Found │                    │ Offline / No Key
                            ▼                    ▼
        ┌─────────────────────────┐  ┌─────────────────────────┐
        │ Google AI Studio Cloud  │  │  Deterministic Fallback │
        │ Model: gemini-4-argon   │  │  FAO-56 Bio-Physical    │
        │ Thinking Level: "high"  │  │  Soil Hydraulics Engine │
        └───────────┬─────────────┘  └───────────┬─────────────┘
                    │                            │
                    └────────────┬───────────────┘
                                 │
                                 ▼
                  ┌────────────────────────────────────────┐
                  │       ArgonAnalysisResult Schema       │
                  │  • Headline & Multi-band Status        │
                  │  • Deep Reasoning Markdown             │
                  │  • Actionable Recommendations          │
                  │  • Variable Rate Urea & Water Depth    │
                  │  • Trilingual SMS (En / Hi / Te)       │
                  └──────────────┬─────────────────────────┘
                                 │
           ┌─────────────────────┴─────────────────────┐
           ▼                                           ▼
┌───────────────────────────┐             ┌───────────────────────────┐
│ GeminiArgonAdvisorModal   │             │ OpenSMS SIM Gateway       │
│ Interactive Deep Reasoning│             │ Direct Mobile Dispatch    │
│ & Visual Confidence Gauge │             │ +91 Indian Farmer Mobile  │
└───────────────────────────┘             └───────────────────────────┘
```

---

## 4. Standalone Python Script Generation

SEVA·GIS generates reproducible Python code using the official `google-genai` SDK:

```python
"""
SEVA·GIS ⟷ Gemini 4 Argon (High Reasoning) Autonomous Crop Advisor
Model: gemini-4-argon | thinking_level: high
Google AI Studio Reference App: 3bb45d74-02be-40e3-96b3-0a34b3b5fd16
"""

from google import genai
import json

def analyze_farm_with_argon():
    # Initialize client (picks up GEMINI_API_KEY from environment)
    client = genai.Client()

    prompt = """
You are Gemini 4 Argon (thinking_level: high), senior agronomist for SEVA·GIS.
Farm: Kaveri Basin Rice Paddock (16.5062°N, 80.6480°E)
Area: 2.85 ha | Crop: Paddy Rice
NDVI: 0.620 | NDRE: 0.380 | NDMI: 0.180
Slope: 1.2° | Soil: Clay Loam

Provide multi-spectral crop diagnosis with variable-rate fertilizer & irrigation advice.
Return JSON with {headline, status, immediateActions, nitrogenUreaKgHa, advisoryEn, advisoryHi, advisoryTe}.
"""

    # Execute with Gemini 4 Argon using the Interactions API
    interaction = client.interactions.create(
        model="gemini-4-argon",
        input=prompt,
        generation_config={
            "thinking_level": "high",  # Maximum reasoning effort
            "response_mime_type": "application/json"
        }
    )

    result = json.loads(interaction.output_text)
    print("=== GEMINI 4 ARGON HIGH REASONING DIAGNOSIS ===")
    print(f"Status: {result.get('status', 'optimal').upper()}")
    print(f"Headline: {result.get('headline')}")
    print(f"English: {result.get('advisoryEn')}")
    print(f"Hindi: {result.get('advisoryHi')}")
    print(f"Telugu: {result.get('advisoryTe')}")

if __name__ == "__main__":
    analyze_farm_with_argon()
```

---

## 5. Verification & Quality Gates Passed

- **Unit Test Suite**: `src/lib/__tests__/geminiArgonService.test.ts` (5 dedicated tests covering default model configuration, script generation, drought edge cases, nitrogen divergence, and FAO-56 offline execution).
- **Global Vitest / Node:Test Suite**: **107 / 107 tests passing (0 failures)**.
- **TypeScript Static Verification**: `npm run typecheck` passing cleanly with 0 type errors.
- **Production Bundle**: `npm run build` succeeds cleanly with Rollup code-splitting.
