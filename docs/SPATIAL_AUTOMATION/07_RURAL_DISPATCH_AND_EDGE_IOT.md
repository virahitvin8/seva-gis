# 07. Rural Field Dispatch, SIM Gateways & Edge IoT

> **Zero-Cost Farmer Communication, Hardware Gateways & LoRa Telemetry**  
> Repositories powering cellular SIM SMS delivery, WhatsApp links, LoRaWAN mesh networks, and offline field data collection.

---

## 1. Flagship Repositories

| Repository | Stars | Language | Primary Role in SEVA·GIS |
| :--- | :--- | :--- | :--- |
| [daslearning-org/OpenSMS](https://github.com/daslearning-org/OpenSMS) | 150+ | Python / FastAPI / Android | Turns any Android phone into an SMS API Server. Enables 100% free SMS advisories using standard Indian unlimited SMS recharge packs. |
| [remotion-dev/remotion](https://github.com/remotion-dev/remotion) | 22k+ | TypeScript / React | Programmatic video generation framework: renders automated 15-second animated field health briefing MP4s for WhatsApp dispatch. |
| [NdoleStudio/httpsms](https://github.com/NdoleStudio/httpsms) | 800+ | Go / Android | Mobile SMS gateway application allowing send/receive SMS via simple HTTP REST endpoints. |
| [timmbogner/Farm-Data-Relay-System](https://github.com/timmbogner/Farm-Data-Relay-System) | 120+ | C / C++ | ESP-NOW and LoRa long-range agricultural sensor network for transmitting soil moisture and temperature without cellular data or Wi-Fi. |
| [openai/whisper](https://github.com/openai/whisper) | 75k+ | Python / PyTorch | High-accuracy speech-to-text model for transcribing farmer voice notes in Telugu, Hindi, and regional dialects. |
| [LibreTranslate/LibreTranslate](https://github.com/LibreTranslate/LibreTranslate) | 8.5k+ | Python | Self-hostable, offline-capable machine translation API for translating agronomic warnings into regional languages without cloud fees. |
| [simplex-chat/simplex-chat](https://github.com/simplex-chat/simplex-chat) | 8.2k+ | Haskell | End-to-end encrypted private communication protocol operating without user IDs or phone numbers. |
| [responsively-org/responsively-app](https://github.com/responsively-org/responsively-app) | 23k+ | TypeScript | Multi-device responsive design and mobile testing browser ensuring SEVA·GIS displays perfectly on budget Android handsets. |

---

## 2. Technical Integration Blueprint for SEVA·GIS

### Real-Time Rural Advisory Dispatch Flow
SEVA·GIS bridges satellite analysis directly to farmer mobile devices via a zero-cost local gateway architecture:

```
[SEVA·GIS Web App]
        │
        ▼ (POST /api/opensms-proxy)  <-- Same-Origin Relay
[Local Node.js Host]
        │
        ▼ (POST http://10.65.171.208:9292/sms/)
[Android Phone with OpenSMS + SIM Card]
        │
        ▼ (GSM Cellular Network)
[Farmer's Feature Phone or Smartphone]
 "🌾 SEVA.GIS Alert: Groundnut plot NDVI is 0.74. No irrigation needed today."
```
