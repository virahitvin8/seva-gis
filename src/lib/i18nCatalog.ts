// Native localization for SEVA·GIS.
//
// This deliberately replaces the old Google-Translate DOM mutation with explicit
// message catalogues. Nothing outside this file is injected into the page, so
// switching language is instant, persists across reloads, and never depends on an
// external widget.
//
// Rules for this file:
//   * Every key must exist in all three catalogues. `src/lib/__tests__/i18n.test.ts`
//     enforces that, so a half-finished translation cannot ship silently.
//   * The Telugu and Hindi text is written as a native speaker would write it, not
//     transliterated or machine-translated. Where a technical term has no common
//     native word (NDVI, GeoTIFF, Sentinel-2) it stays in Latin script inside the
//     native sentence, which is how these terms are actually used in the field.
//   * Run `npm run i18n:coverage` to see how much of the app is still untranslated.

export type Lang = 'en' | 'hi' | 'te'

export type Catalog = Record<string, string>

const en: Catalog = {
  // ---- shell: header, footer, chrome ----
  'shell.logoAlt': 'SEVA.GIS official logo',
  'shell.logout': 'Log out',
  'shell.openNav': 'Open navigation',
  'shell.popTeamHint': 'Page or satellite data not working? Let SEVA Team Know: Pop the Team',
  'shell.popTeamAlt': 'Page not working? Pop the team',
  'shell.popTeam': 'Pop Team',
  'shell.terminalTitle': 'Financial Analytics & 6-Session Summary Terminal',
  'shell.mitraTour': 'Quick tour with Mitra',
  'shell.planBadge': 'Personal · Free forever*',
  'shell.dataSources': 'Data sources',
  'shell.fieldGuide': 'Field guide',
  'shell.dataManager': 'Data manager',
  'shell.poweredBy': 'Powered by open data',
  'shell.tagline': 'Spatial Evaluation & Vegetation Analytics',
  'shell.credit': 'Built by N. Akshit Vinay. Powered by open data.',
  'shell.wordmark': 'SEVA · LAND INTELLIGENCE',
  'shell.privacy': 'Your coordinates stay on this device.',
  'shell.aboutData': 'About this data',

  // ---- hero ----
  'hero.line1': 'Built for the ground.',
  'hero.line2': 'Earth intelligence, in the spirit of selfless service.',
  'hero.eyebrow': 'OPEN DATA. REAL PURPOSE.',

  // ---- navigation ----
  'nav.overview': 'Overview',
  'nav.farms': 'My areas',
  'nav.terminal': 'Terminal',
  'nav.journal': 'Crop journal',
  'nav.alerts': 'Alerts',
  'nav.reports': 'Reports',

  // ---- actions ----
  'action.add': 'Add an area',
  'action.addAnother': 'Add another area',
  'action.createReport': 'Create report',

  // ---- areas of interest ----
  'farm.add': 'Add farm',
  'farm.thumbTitle': 'Satellite view of your farm boundary',
  'farm.viewLocation': 'View location',
  'farms.title': 'My farms',
  'farms.search': 'Find a farm...',
  'farms.unknownArea': 'Location pin · area unknown',

  // ---- dashboard ----
  'dash.totalFarms': 'Total farms',
  'dash.mappedArea': 'Mapped boundary area',
  'dash.strongCover': 'Farms with strong green cover',
  'dash.strongSignal': 'Strong green-cover signal',
  'dash.reviewFlagged': 'Review flagged areas in the latest pass',

  // ---- empty state ----
  'empty.title': 'Add your first area',
  'empty.body':
    'Add an outline for any area you want to review remotely. SEVA·GIS shows the latest clear Sentinel-2 pass so you can compare dates, layers, and visible changes.',

  // ---- dashboard layout ----
  'layout.title': 'Dashboard Layout Customizer Active',
  'layout.hint':
    'Move modules up or down to personalize your workflow, or select a preset layout below.',
  'layout.reset': 'Reset Default',
  'layout.save': 'Save Layout',
  'layout.presets': 'Quick Presets:',
  'layout.preset.standard': 'Standard Overview',
  'layout.preset.gis': 'GIS & Satellite First',
  'layout.preset.hydro': 'Hydrology Focus',
  'layout.moveDown': 'Move Down',

  // ---- map ----
  'map.layersTitle': 'Layers and symbology controls',

  // ---- insight cards ----
  'insight.openTitle': 'Click to view 3D playing card insight',
  'insight.scientific': 'Scientific Insight:',

  // ---- common ----
  'common.close': 'Close dialog',
  'advice.title': 'What should I do?',

  // ---- loading states ----
  'load.map': 'Loading the field map…',
  'load.panels': 'Loading field panels…',
  'load.mapTools': 'Loading map tools…',
  'load.exportTools': 'Loading GIS export tools…',
  'load.analysisLab': 'Loading analysis lab…',
  'load.measureTools': 'Loading measurement tools…',
  'load.satelliteHistory': 'Loading the satellite history…',
  'load.satHistory': 'Loading satellite history…',
  'load.dataManager': 'Loading data manager…',
  'load.report': 'Preparing report…',
  'load.fieldGuide': 'Loading field guide…',

  // ---- sources and privacy ----
  'src.intro':
    'Each value is labelled as observed, modeled, or estimated where it appears. Satellite results can vary with scene coverage and cloud conditions.',
  'src.note':
    'Satellite values are not pixel cloud-masked and are not field-validated. Confirm on the ground before acting.',
  'src.openMeteo': 'Open-Meteo documentation',
  'privacy.storage':
    'Farms are stored in this browser only, and are not synced across devices. Clearing browser storage removes them.',
  'privacy.payment':
    'This build has no payment flow. External providers have their own terms and availability.',
  'privacy.google': 'About Google sign-in',
  'ground.note':
    'Satellite and model estimates should be checked on the ground before making decisions.',

  // ---- alerts ----
  'alert.none': 'No farms currently need attention based on their latest satellite scene.',
  'alert.note':
    'Alerts reflect the last analysis on this device. Background monitoring and email notifications are not connected.',

  // ---- language control ----
  'lang.label': 'Language',
  'lang.select': 'Select language',

  // ---- field intelligence ----
  'fieldIntel.title': 'Field intelligence',
}

const hi: Catalog = {
  'shell.logoAlt': 'SEVA.GIS आधिकारिक लोगो',
  'shell.logout': 'लॉग आउट',
  'shell.openNav': 'नेविगेशन खोलें',
  'shell.popTeamHint': 'पेज या उपग्रह डेटा काम नहीं कर रहा? सेवा टीम को बताएं: पॉप द टीम',
  'shell.popTeamAlt': 'पेज काम नहीं कर रहा? टीम को बताएं',
  'shell.popTeam': 'पॉप टीम',
  'shell.terminalTitle': 'वित्तीय विश्लेषण एवं छह-सत्र सारांश टर्मिनल',
  'shell.mitraTour': 'मित्रा के साथ संक्षिप्त भ्रमण',
  'shell.planBadge': 'व्यक्तिगत · सदा निःशुल्क*',
  'shell.dataSources': 'डेटा स्रोत',
  'shell.fieldGuide': 'क्षेत्र मार्गदर्शिका',
  'shell.dataManager': 'डेटा प्रबंधक',
  'shell.poweredBy': 'खुले डेटा से संचालित',
  'shell.tagline': 'स्थानिक मूल्यांकन एवं वनस्पति विश्लेषण',
  'shell.credit': 'निर्माता: एन. अक्षित विनय। खुले डेटा से संचालित।',
  'shell.wordmark': 'सेवा · भूमि बुद्धिमत्ता',
  'shell.privacy': 'आपके निर्देशांक इसी डिवाइस पर रहते हैं।',
  'shell.aboutData': 'इस डेटा के बारे में',

  'hero.line1': 'ज़मीन के लिए बनाया गया।',
  'hero.line2': 'निःस्वार्थ सेवा की भावना से पृथ्वी की समझ।',
  'hero.eyebrow': 'खुला डेटा। सच्चा उद्देश्य।',

  'nav.overview': 'अवलोकन',
  'nav.farms': 'मेरे क्षेत्र',
  'nav.terminal': 'टर्मिनल',
  'nav.journal': 'फ़सल डायरी',
  'nav.alerts': 'चेतावनियाँ',
  'nav.reports': 'रिपोर्ट',

  'action.add': 'क्षेत्र जोड़ें',
  'action.addAnother': 'एक और क्षेत्र जोड़ें',
  'action.createReport': 'रिपोर्ट बनाएं',

  'farm.add': 'खेत जोड़ें',
  'farm.thumbTitle': 'आपकी खेत सीमा का उपग्रह दृश्य',
  'farm.viewLocation': 'स्थान देखें',
  'farms.title': 'मेरे खेत',
  'farms.search': 'खेत खोजें...',
  'farms.unknownArea': 'स्थान बिंदु · क्षेत्रफल अज्ञात',

  'dash.totalFarms': 'कुल खेत',
  'dash.mappedArea': 'मापी गई सीमा का क्षेत्रफल',
  'dash.strongCover': 'घनी हरियाली वाले खेत',
  'dash.strongSignal': 'मज़बूत हरियाली संकेत',
  'dash.reviewFlagged': 'नवीनतम पास में चिह्नित क्षेत्रों की समीक्षा करें',

  'empty.title': 'अपना पहला क्षेत्र जोड़ें',
  'empty.body':
    'जिस क्षेत्र की दूर से समीक्षा करनी हो, उसकी सीमा जोड़ें। SEVA·GIS ताज़ा साफ़ Sentinel-2 उपग्रह दृश्य दिखाता है, जिससे आप तारीख़, परतें और दिखने वाले बदलाव तुलना कर सकें।',

  'layout.title': 'डैशबोर्ड लेआउट अनुकूलक सक्रिय',
  'layout.hint':
    'अपने काम के अनुसार मॉड्यूल ऊपर-नीचे करें, या नीचे से कोई प्रीसेट लेआउट चुनें।',
  'layout.reset': 'डिफ़ॉल्ट पर लौटाएं',
  'layout.save': 'लेआउट सहेजें',
  'layout.presets': 'त्वरित प्रीसेट:',
  'layout.preset.standard': 'मानक अवलोकन',
  'layout.preset.gis': 'GIS एवं उपग्रह पहले',
  'layout.preset.hydro': 'जलविज्ञान केंद्रित',
  'layout.moveDown': 'नीचे ले जाएं',

  'map.layersTitle': 'लेयर एवं प्रतीक नियंत्रण',

  'insight.openTitle': '3D कार्ड अंतर्दृष्टि देखने के लिए क्लिक करें',
  'insight.scientific': 'वैज्ञानिक अंतर्दृष्टि:',

  'common.close': 'संवाद बंद करें',
  'advice.title': 'मुझे क्या करना चाहिए?',

  'load.map': 'खेत का नक्शा लोड हो रहा है…',
  'load.panels': 'क्षेत्र पैनल लोड हो रहे हैं…',
  'load.mapTools': 'नक्शा उपकरण लोड हो रहे हैं…',
  'load.exportTools': 'GIS निर्यात उपकरण लोड हो रहे हैं…',
  'load.analysisLab': 'विश्लेषण प्रयोगशाला लोड हो रही है…',
  'load.measureTools': 'मापन उपकरण लोड हो रहे हैं…',
  'load.satelliteHistory': 'उपग्रह इतिहास लोड हो रहा है…',
  'load.satHistory': 'उपग्रह इतिहास लोड हो रहा है…',
  'load.dataManager': 'डेटा प्रबंधक लोड हो रहा है…',
  'load.report': 'रिपोर्ट तैयार हो रही है…',
  'load.fieldGuide': 'क्षेत्र मार्गदर्शिका लोड हो रही है…',

  'src.intro':
    'हर मान को वहीं पर अवलोकित, प्रतिरूपित या अनुमानित बताया गया है। दृश्य कवरेज और बादलों के कारण उपग्रह परिणाम बदल सकते हैं।',
  'src.note':
    'उपग्रह मान पिक्सेल-स्तर पर बादल-रहित नहीं किए गए हैं और खेत पर सत्यापित नहीं हैं। कार्रवाई से पहले ज़मीन पर पुष्टि करें।',
  'src.openMeteo': 'Open-Meteo दस्तावेज़',
  'privacy.storage':
    'खेत केवल इसी ब्राउज़र में सहेजे जाते हैं और डिवाइसों के बीच सिंक नहीं होते। ब्राउज़र स्टोरेज हटाने पर वे मिट जाते हैं।',
  'privacy.payment':
    'इस संस्करण में भुगतान प्रक्रिया नहीं है। बाहरी सेवाओं की अपनी शर्तें और उपलब्धता है।',
  'privacy.google': 'Google साइन-इन के बारे में',
  'ground.note': 'निर्णय लेने से पहले उपग्रह एवं मॉडल अनुमान ज़मीन पर जाँचें।',

  'alert.none':
    'नवीनतम उपग्रह दृश्य के अनुसार फिलहाल किसी खेत पर ध्यान देने की ज़रूरत नहीं है।',
  'alert.note':
    'चेतावनियाँ इस डिवाइस के पिछले विश्लेषण पर आधारित हैं। पृष्ठभूमि निगरानी और ईमेल सूचनाएँ जुड़ी नहीं हैं।',

  'lang.label': 'भाषा',
  'lang.select': 'भाषा चुनें',

  'fieldIntel.title': 'क्षेत्र बुद्धिमत्ता',
}

const te: Catalog = {
  'shell.logoAlt': 'SEVA.GIS అధికారిక లోగో',
  'shell.logout': 'లాగ్ అవుట్',
  'shell.openNav': 'నావిగేషన్ తెరవండి',
  'shell.popTeamHint': 'పేజీ లేదా ఉపగ్రహ డేటా పని చేయడం లేదా? సేవా టీమ్‌కు తెలియజేయండి: పాప్ ద టీమ్',
  'shell.popTeamAlt': 'పేజీ పని చేయడం లేదా? టీమ్‌కు చెప్పండి',
  'shell.popTeam': 'పాప్ టీమ్',
  'shell.terminalTitle': 'ఆర్థిక విశ్లేషణ & ఆరు-సెషన్ల సారాంశ టెర్మినల్',
  'shell.mitraTour': 'మిత్రతో చిన్న పర్యటన',
  'shell.planBadge': 'వ్యక్తిగతం · ఎప్పటికీ ఉచితం*',
  'shell.dataSources': 'డేటా మూలాలు',
  'shell.fieldGuide': 'క్షేత్ర మార్గదర్శిని',
  'shell.dataManager': 'డేటా నిర్వాహకం',
  'shell.poweredBy': 'ఓపెన్ డేటాతో నడుస్తుంది',
  'shell.tagline': 'ప్రాదేశిక మూల్యాంకనం & వృక్ష విశ్లేషణ',
  'shell.credit': 'నిర్మాత: ఎన్. అక్షిత్ వినయ్. ఓపెన్ డేటాతో నడుస్తుంది.',
  'shell.wordmark': 'సేవ · భూమి మేధస్సు',
  'shell.privacy': 'మీ కోఆర్డినేట్లు ఈ పరికరంలోనే ఉంటాయి.',
  'shell.aboutData': 'ఈ డేటా గురించి',

  'hero.line1': 'నేల కోసమే నిర్మించినది.',
  'hero.line2': 'నిస్వార్థ సేవా భావంతో భూమి పరిజ్ఞానం.',
  'hero.eyebrow': 'ఓపెన్ డేటా. నిజమైన లక్ష్యం.',

  'nav.overview': 'అవలోకనం',
  'nav.farms': 'నా ప్రాంతాలు',
  'nav.terminal': 'టెర్మినల్',
  'nav.journal': 'పంట డైరీ',
  'nav.alerts': 'హెచ్చరికలు',
  'nav.reports': 'నివేదికలు',

  'action.add': 'ప్రాంతాన్ని జోడించండి',
  'action.addAnother': 'మరో ప్రాంతాన్ని జోడించండి',
  'action.createReport': 'నివేదిక రూపొందించండి',

  'farm.add': 'పొలం జోడించండి',
  'farm.thumbTitle': 'మీ పొలం సరిహద్దు ఉపగ్రహ దృశ్యం',
  'farm.viewLocation': 'స్థానం చూడండి',
  'farms.title': 'నా పొలాలు',
  'farms.search': 'పొలం వెతకండి...',
  'farms.unknownArea': 'స్థాన చుక్క · విస్తీర్ణం తెలియదు',

  'dash.totalFarms': 'మొత్తం పొలాలు',
  'dash.mappedArea': 'మ్యాప్ చేసిన సరిహద్దు విస్తీర్ణం',
  'dash.strongCover': 'దట్టమైన పచ్చదనం ఉన్న పొలాలు',
  'dash.strongSignal': 'బలమైన పచ్చదన సంకేతం',
  'dash.reviewFlagged': 'తాజా పాస్‌లో గుర్తించిన ప్రాంతాలను సమీక్షించండి',

  'empty.title': 'మీ మొదటి ప్రాంతాన్ని జోడించండి',
  'empty.body':
    'దూరం నుంచి సమీక్షించాలనుకునే ఏ ప్రాంతానికైనా సరిహద్దును జోడించండి. SEVA·GIS తాజా స్పష్టమైన Sentinel-2 ఉపగ్రహ దృశ్యాన్ని చూపుతుంది, దీనితో తేదీలు, పొరలు, కనిపించే మార్పులను పోల్చుకోవచ్చు.',

  'layout.title': 'డాష్‌బోర్డ్ లేఅవుట్ అనుకూలీకరణ యాక్టివ్',
  'layout.hint':
    'మీ పనికి తగ్గట్టు మాడ్యూళ్లను పైకి కిందకి జరపండి, లేదా కింద ఉన్న ప్రీసెట్ లేఅవుట్ ఎంచుకోండి.',
  'layout.reset': 'డిఫాల్ట్‌కు రీసెట్ చేయండి',
  'layout.save': 'లేఅవుట్ సేవ్ చేయండి',
  'layout.presets': 'త్వరిత ప్రీసెట్‌లు:',
  'layout.preset.standard': 'ప్రామాణిక అవలోకనం',
  'layout.preset.gis': 'GIS & ఉపగ్రహం ముందు',
  'layout.preset.hydro': 'జలవిజ్ఞానం ప్రధానం',
  'layout.moveDown': 'కిందకి జరపండి',

  'map.layersTitle': 'లేయర్లు మరియు సంకేత నియంత్రణలు',

  'insight.openTitle': '3D కార్డ్ అంతర్దృష్టి చూడటానికి క్లిక్ చేయండి',
  'insight.scientific': 'శాస్త్రీయ అంతర్దృష్టి:',

  'common.close': 'డైలాగ్ మూసివేయండి',
  'advice.title': 'నేను ఏమి చేయాలి?',

  'load.map': 'పొలం మ్యాప్ లోడ్ అవుతోంది…',
  'load.panels': 'క్షేత్ర ప్యానెల్‌లు లోడ్ అవుతున్నాయి…',
  'load.mapTools': 'మ్యాప్ సాధనాలు లోడ్ అవుతున్నాయి…',
  'load.exportTools': 'GIS ఎగుమతి సాధనాలు లోడ్ అవుతున్నాయి…',
  'load.analysisLab': 'విశ్లేషణ ప్రయోగశాల లోడ్ అవుతోంది…',
  'load.measureTools': 'కొలత సాధనాలు లోడ్ అవుతున్నాయి…',
  'load.satelliteHistory': 'ఉపగ్రహ చరిత్ర లోడ్ అవుతోంది…',
  'load.satHistory': 'ఉపగ్రహ చరిత్ర లోడ్ అవుతోంది…',
  'load.dataManager': 'డేటా నిర్వాహకం లోడ్ అవుతోంది…',
  'load.report': 'నివేదిక సిద్ధమవుతోంది…',
  'load.fieldGuide': 'క్షేత్ర మార్గదర్శిని లోడ్ అవుతోంది…',

  'src.intro':
    'ప్రతి విలువ పరిశీలించినదా, నమూనా ఆధారితమా, లేదా అంచనానా అని అక్కడే తెలియజేయబడింది. దృశ్య కవరేజ్, మేఘ పరిస్థితులను బట్టి ఉపగ్రహ ఫలితాలు మారవచ్చు.',
  'src.note':
    'ఉపగ్రహ విలువలు పిక్సెల్ స్థాయిలో మేఘ-తొలగింపు చేయలేదు, క్షేత్రంలో నిర్ధారణ కూడా కాదు. నిర్ణయం తీసుకునే ముందు నేలపై నిర్ధారించుకోండి.',
  'src.openMeteo': 'Open-Meteo పత్రాలు',
  'privacy.storage':
    'పొలాలు ఈ బ్రౌజర్‌లోనే నిల్వ ఉంటాయి, పరికరాల మధ్య సింక్ అవ్వవు. బ్రౌజర్ నిల్వ తొలగిస్తే అవి పోతాయి.',
  'privacy.payment':
    'ఈ వెర్షన్‌లో చెల్లింపు విధానం లేదు. బాహ్య సేవలకు వాటి స్వంత నిబంధనలు, అందుబాటు ఉంటాయి.',
  'privacy.google': 'Google సైన్-ఇన్ గురించి',
  'ground.note': 'నిర్ణయాలు తీసుకునే ముందు ఉపగ్రహ, నమూనా అంచనాలను నేలపై పరిశీలించండి.',

  'alert.none': 'తాజా ఉపగ్రహ దృశ్యం ప్రకారం ప్రస్తుతం ఏ పొలానికీ శ్రద్ధ అవసరం లేదు.',
  'alert.note':
    'హెచ్చరికలు ఈ పరికరంలోని చివరి విశ్లేషణ ఆధారంగా ఉంటాయి. నేపథ్య పర్యవేక్షణ, ఈమెయిల్ నోటిఫికేషన్‌లు అనుసంధానించబడలేదు.',

  'lang.label': 'భాష',
  'lang.select': 'భాషను ఎంచుకోండి',

  'fieldIntel.title': 'క్షేత్ర మేధస్సు',
}

export const CATALOGS: Record<Lang, Catalog> = { en, hi, te }
export const STORE_KEY = 'seva-lang'

export const LANGUAGE_OPTIONS: { code: Lang; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'हिन्दी', native: 'Hindi' },
  { code: 'te', label: 'తెలుగు', native: 'Telugu' },
]

export const isLang = (value: string | null): value is Lang => value === 'en' || value === 'hi' || value === 'te'
