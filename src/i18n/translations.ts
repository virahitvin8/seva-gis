import { SupportedLanguage } from '../types/seva';

export interface TranslationDictionary {
  brandTitle: string;
  brandFullForm: string;
  brandOneLineMeaning: string;
  signInTagline: string;
  continueWithGoogle: string;
  continueAsGuest: string;
  methodologyHeading: string;
  nodeEngineButton: string;
  zoomToAoi: string;
  zoomToLayer: string;
  lockToAoi: string;
  unlockAoi: string;
  cropHealthChartTitle: string;
  cropHealthHoverHint: string;
  mineralSectionTitle: string;
  mineralDisclaimer: string;
  swatSectionTitle: string;
  swatClickHint: string;
  whatToLookForTitle: string;
  weatherSectionTitle: string;
  rainfallOutlookTitle: string;
  reportSectionTitle: string;
  sendReportEmailBtn: string;
  workspaceTreeTitle: string;
  reportNarrativeIntro: (aoiName: string, ha: number, date: string) => string;
  mineralJustificationPrefix: string;
  swatExplanationPrefix: string;
}

export const TRANSLATIONS: Record<SupportedLanguage, TranslationDictionary> = {
  en: {
    brandTitle: 'SEVA.GIS',
    brandFullForm: 'Spatial Evaluation & Vegetation Analytics — Geographic Information System',
    brandOneLineMeaning:
      'Where Satellites Meet Soil: Open-Source Multi-Sensor Earth Observation & Agronomic Intelligence.',
    signInTagline:
      'Autonomous browser-first spatial analysis. Pick any area of interest, compute 30+ spectral insights, export 19+ cartography and analysis outputs to your Google Drive. Zero subscription fee, zero API keys, complete privacy on your device.',
    continueWithGoogle: 'Continue with Google (Auto Drive Sync)',
    continueAsGuest: 'Enter Local-Privacy Guest Workspace',
    methodologyHeading: 'SEVA.GIS Methodology',
    nodeEngineButton: 'Open Multi-Engine Node Graph (GEE / QGIS / ArcMap / MATLAB)',
    zoomToAoi: 'Zoom to AOI',
    zoomToLayer: 'Zoom to Active Layer',
    lockToAoi: 'Lock View to AOI',
    unlockAoi: 'Unlock AOI View',
    cropHealthChartTitle: 'Crop Health & Canopy Moisture Over Time (10m Sentinel-2 L2A)',
    cropHealthHoverHint: 'Move cursor over curve for exact pass date (YYYY-MM-DD) & calibrated index value',
    mineralSectionTitle: 'Satellite Surface Mineralogy & Soil Alteration (SWIR/VNIR)',
    mineralDisclaimer:
      'All satellite mineral outputs are strictly reported as Indicated (Spectrally Inferred from SWIR/VNIR absorption bands) — never laboratory-confirmed.',
    swatSectionTitle: 'SWAT & FQFA Hydrological Parameter Sensitivity Ranking',
    swatClickHint: 'Click any hydrological parameter row to highlight its spatial zone across 100% of the AOI and inspect its formulation.',
    whatToLookForTitle: 'What to Look For on Your Farm (Click Triangle to Expand Parameter Legends)',
    weatherSectionTitle: 'Agro-Meteorology, Soil Thermal Profile & Evapotranspiration Budget',
    rainfallOutlookTitle: '7-Day Cumulative Rainfall Outlook',
    reportSectionTitle: 'Multi-Format Spatial Report & Direct Automated Email Dispatch',
    sendReportEmailBtn: 'Send Report Directly to Email (PDF / DOCX / ZIP / JSON)',
    workspaceTreeTitle: 'Workspace Operations & Institutional Packs (Tree Menu)',
    reportNarrativeIntro: (aoiName, ha, date) =>
      `Official SEVA.GIS Spatial & Agronomic Assessment for "${aoiName}" covering ${ha.toFixed(2)} hectares (computed on ${date} from Sentinel-2 L2A Surface Reflectance, Sentinel-1 C-Band SAR, and Copernicus 30m DEM).`,
    mineralJustificationPrefix: 'Spectral Justification & Sensor Provenance:',
    swatExplanationPrefix: 'Hydrological Formulation & Spatial Distribution:',
  },
  te: {
    brandTitle: 'సేవా.జిఐఎస్ (SEVA.GIS)',
    brandFullForm: 'స్పేషియల్ ఎవాల్యుయేషన్ & వెజిటేషన్ అనలిటిక్స్ — భౌగోళిక సమాచార వ్యవస్థ (SEVA.GIS)',
    brandOneLineMeaning:
      'ఉపగ్రహాలు మరియు నేల కలిసే వేదిక: భారతీయ వ్యవసాయం కోసం ఉచిత ఓపెన్-సోర్స్ ఉపగ్రహ పంట మరియు భూ విశ్లేషణ వేదిక.',
    signInTagline:
      'స్వయంచాలిత బ్రౌజర్-ఫస్ట్ స్పేషియల్ విశ్లేషణ. ఏదైనా పొలం / ప్రాంతాన్ని ఎంచుకుని, 30+ స్పెక్ట్రల్ అంచనాలు లెక్కించి, 19+ కార్టోగ్రాఫిక్ ఫైళ్ళు మీ Google Drive కు ఎగుమతి చేయండి. సభ్యత్వ రుసుము లేదు, API కీలు లేవు, పూర్తి గోప్యత మీ పరికరంలోనే.',
    continueWithGoogle: 'Google ఖాతాతో కొనసాగండి (ఆటో డ్రైవ్ సింక్)',
    continueAsGuest: 'అతిథి (Guest) ఖాతాగా ప్రవేశించండి — పూర్తి పరికర గోప్యత',
    methodologyHeading: 'SEVA.GIS పనితీరు మరియు సాంకేతిక పద్ధతి (SEVA.GIS Methodology)',
    nodeEngineButton: 'మల్టీ-ఇంజిన్ నోడ్ గ్రాఫ్ తెరవండి (GEE / QGIS / ArcMap / MATLAB)',
    zoomToAoi: 'ఎంచుకున్న పొలం (AOI) పైకి జూమ్ చేయండి',
    zoomToLayer: 'యాక్టివ్ లేయర్ పైకి జూమ్ చేయండి',
    lockToAoi: 'AOI సరిహద్దుకు మ్యాప్ లాక్ చేయండి',
    unlockAoi: 'AOI లాక్ తీసివేయండి',
    cropHealthChartTitle: 'కాలక్రమేణా పంట ఆరోగ్యం మరియు తేమ సూచిక (10మీ సెంటినెల్-2 L2A)',
    cropHealthHoverHint: 'ఖచ్చితమైన తేదీ (YYYY-MM-DD) మరియు విలువ కోసం గ్రాఫ్ రేఖపై కర్సర్ ఉంచండి',
    mineralSectionTitle: 'ఉపగ్రహ ఉపరితల ఖనిజ సూచనలు మరియు నేల స్వభావ విశ్లేషణ (SWIR/VNIR)',
    mineralDisclaimer:
      'గమనిక: ఉపగ్రహ వర్ణపట నిష్పత్తుల ద్వారా గుర్తించబడిన ఖనిజాలు కేవలం "సూచించబడినవి (Indicated)" మాత్రమే — ప్రయోగశాల నిర్ధారణ (Confirmed) కాదు.',
    swatSectionTitle: 'SWAT & FQFA జలవిజ్ఞాన పారామీటర్ సున్నితత్వ ర్యాంకింగ్ (Hydrological Sensitivity)',
    swatClickHint: 'ఏదైనా పారామీటర్పై క్లిక్ చేస్తే అది AOI మొత్తంలో ఎక్కడ ఉందో మరియు దాని అర్థం ఏమిటో వివరిస్తుంది.',
    whatToLookForTitle: 'మీ పొలంలో గమనించవలసిన అంశాలు (వివరాల కోసం త్రిభుజం గుర్తుపై క్లిక్ చేయండి)',
    weatherSectionTitle: 'వాతావరణం, నేల ఉష్ణోగ్రత మరియు నీటి బడ్జెట్ నివేదిక',
    rainfallOutlookTitle: 'రాబోయే 7 రోజుల వర్షపాత అంచనా',
    reportSectionTitle: 'సంపూర్ణ నివేదిక మరియు ఆటోమేటిక్ ఇమెయిల్ పంపిణీ',
    sendReportEmailBtn: 'నివేదికను నేరుగా ఇమెయిల్కు పంపండి (PDF / DOCX / ZIP / JSON)',
    workspaceTreeTitle: 'వర్క్స్పేస్ సాధనాలు మరియు పంట బీమా ప్యాక్లు (Tree Menu)',
    reportNarrativeIntro: (aoiName, ha, date) =>
      `"${aoiName}" ప్రాంతానికి (${ha.toFixed(2)} హెక్టార్లు) తేదీ ${date} నాటి సెంటినెల్-2 L2A, సెంటినెల్-1 రాడార్ మరియు కోపర్నికస్ 30మీ DEM ఉపగ్రహ డేటా ఆధారంగా రూపొందించబడిన పూర్తి తెలుగు సాంకేతిక వ్యవసాయ మరియు భౌగోళిక నివేదిక.`,
    mineralJustificationPrefix: 'వర్ణపట సాంకేతిక వివరణ మరియు ఉపగ్రహ ఆధారం:',
    swatExplanationPrefix: 'జలవిజ్ఞాన సూత్రం మరియు క్షేత్రస్థాయి ప్రభావం:',
  },
  hi: {
    brandTitle: 'सेवा.जीआईएस (SEVA.GIS)',
    brandFullForm: 'स्पेशियल इवेल्यूएशन एंड वेजिटेशन एनालिटिक्स — भौगोलिक सूचना प्रणाली (SEVA.GIS)',
    brandOneLineMeaning:
      'जहाँ उपग्रह मिट्टी से मिलते हैं: भारतीय कृषि के लिए निःशुल्क ओपन-सोर्स उपग्रह फसल एवं मृदा विश्लेषण मंच।',
    signInTagline:
      'स्वचालित ब्राउज़र-फर्स्ट स्थानिक विश्लेषण। कोई भी खेत / क्षेत्र चुनें, 30+ स्पेक्ट्रल जानकारियाँ प्राप्त करें, 19+ कार्टोग्राफी फ़ाइलें अपने Google Drive में निर्यात करें। कोई सदस्यता शुल्क नहीं, कोई API कुंजी नहीं, पूर्ण गोपनीयता आपके डिवाइस पर।',
    continueWithGoogle: 'Google के साथ जारी रखें (ऑटो ड्राइव सिंक)',
    continueAsGuest: 'अतिथि (Guest) मोड में प्रवेश करें — पूर्ण डिवाइस गोपनीयता',
    methodologyHeading: 'SEVA.GIS कार्यप्रणाली (SEVA.GIS Methodology)',
    nodeEngineButton: 'मल्टी-इंजन नोड ग्राफ़ खोलें (GEE / QGIS / ArcMap / MATLAB)',
    zoomToAoi: 'चयनित क्षेत्र (AOI) पर ज़ूम करें',
    zoomToLayer: 'सक्रिय लेयर पर ज़ूम करें',
    lockToAoi: 'दृश्य को AOI सीमा पर लॉक करें',
    unlockAoi: 'AOI लॉक हटाएँ',
    cropHealthChartTitle: 'समय के साथ फसल स्वास्थ्य एवं नमी सूचकांक (10m Sentinel-2 L2A)',
    cropHealthHoverHint: 'सटीक तिथि (YYYY-MM-DD) और सूचकांक मान देखने के लिए ग्राफ़ रेखा पर कर्सर ले जाएँ',
    mineralSectionTitle: 'उपग्रह सतह खनिज संकेत एवं मृदा विश्लेषण (SWIR/VNIR)',
    mineralDisclaimer:
      'महत्वपूर्ण सूचना: उपग्रह बैंड अनुपात से प्राप्त खनिज परिणाम केवल "संकेतित (Indicated)" हैं — प्रयोगशाला द्वारा "पुष्ट (Confirmed)" नहीं।',
    swatSectionTitle: 'SWAT एवं FQFA जल-विज्ञान पैरामीटर संवेदनशीलता रैंकिंग',
    swatClickHint: 'किसी भी पैरामीटर पंक्ति पर क्लिक करें ताकि पूरे AOI में उसका प्रभाव क्षेत्र और वैज्ञानिक आधार देखा जा सके।',
    whatToLookForTitle: 'अपने खेत में क्या देखें (पैरामीटर लेजेंड खोलने के लिए त्रिभुज पर क्लिक करें)',
    weatherSectionTitle: 'कृषि-मौसम विज्ञान, मृदा तापमान एवं जल बजट',
    rainfallOutlookTitle: '7-दिवसीय संचयी वर्षा पूर्वानुमान',
    reportSectionTitle: 'बहु-प्रारूप रिपोर्ट एवं स्वचालित ईमेल वितरण',
    sendReportEmailBtn: 'रिपोर्ट सीधे ईमेल पर भेजें (PDF / DOCX / ZIP / JSON)',
    workspaceTreeTitle: 'वर्कस्पेस उपकरण एवं फसल बीमा पैक (Tree Menu)',
    reportNarrativeIntro: (aoiName, ha, date) =>
      `"${aoiName}" (${ha.toFixed(2)} हेक्टेयर) के लिए दिनांक ${date} को Sentinel-2 L2A, Sentinel-1 SAR तथा Copernicus 30m DEM उपग्रह डेटा से निर्मित संपूर्ण हिंदी कृषि एवं भू-स्थानिक विश्लेषण रिपोर्ट।`,
    mineralJustificationPrefix: 'स्पेक्ट्रल वैज्ञानिक आधार एवं उपग्रह स्रोत:',
    swatExplanationPrefix: 'जल-वैज्ञानिक सूत्र एवं क्षेत्रीय प्रभाव:',
  },
};

export function translateReportDynamicText(
  lang: SupportedLanguage,
  englishText: string,
  _category: 'status' | 'mineral' | 'swat' | 'advisory'
): string {
  if (lang === 'en') return englishText;

  const dictionaryTe: Record<string, string> = {
    Optimal: 'ఉత్తమ స్థితి (Optimal)',
    Moderate: 'మధ్యస్థ స్థితి (Moderate)',
    Watch: 'నిఘా అవసరం (Watch)',
    Critical: 'తక్షణ చర్య అవసరం (Critical)',
    'Indicated (Spectrally Inferred)': 'సూచించబడినది (వర్ణపట అంచనా / Indicated)',
    'Iron Oxide / Hematite-Goethite (Ferric Fe3+)': 'ఐరన్ ఆక్సైడ్ / హెమటైట్-గోథైట్ (ఫెర్రిక్ ఇనుము Fe3+)',
    'Clay Minerals / Kaolinite-Smectite-Illite (Al-OH)': 'బంకమట్టి ఖనిజాలు / కయోలినైట్-స్మెక్టైట్ (Al-OH సమూహం)',
    'Ferrous Silicates / Olivine-Pyroxene (Fe2+)': 'ఫెర్రస్ సిలికేట్లు / ఇనుము-మెగ్నీషియం ఖనిజాలు (Fe2+)',
    'Carbonate / Calcite-Dolomite-Gypsum (CO3)': 'కార్బోనేట్ / కాల్సైట్-డోలమైట్ సున్నపు నిక్షేపాలు (CO3)',
    'Hydrous Quartz / Silicate Surface Crust Index': 'సిలికేట్ మరియు క్వార్ట్జ్ ఉపరితల తేమ సూచిక',
  };

  const dictionaryHi: Record<string, string> = {
    Optimal: 'उत्तम स्थिति (Optimal)',
    Moderate: 'मध्यम स्थिति (Moderate)',
    Watch: 'निगरानी आवश्यक (Watch)',
    Critical: 'तत्काल ध्यान आवश्यक (Critical)',
    'Indicated (Spectrally Inferred)': 'संकेतित (स्पेक्ट्रल अनुमानित / Indicated)',
    'Iron Oxide / Hematite-Goethite (Ferric Fe3+)': 'आयरन ऑक्साइड / हेमेटाइट-गोएथाइट (फेरिक लौह Fe3+)',
    'Clay Minerals / Kaolinite-Smectite-Illite (Al-OH)': 'मृत्तिका खनिज / काओलिनाइट-स्मेक्टाइट (Al-OH समूह)',
    'Ferrous Silicates / Olivine-Pyroxene (Fe2+)': 'फेरस सिलिकेट / लौह-मैग्नीशियम खनिज (Fe2+)',
    'Carbonate / Calcite-Dolomite-Gypsum (CO3)': 'कार्बोनेट / कैल्साइट-डोलोमाइट चूना खनिज (CO3)',
    'Hydrous Quartz / Silicate Surface Crust Index': 'हाइड्रस क्वार्ट्ज एवं सिलिकेट सतह सूचकांक',
  };

  const map = lang === 'te' ? dictionaryTe : dictionaryHi;
  return map[englishText] || englishText;
}
