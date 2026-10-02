export interface Translations {
  // Brand & General
  brandName: string;
  brandSub: string;
  since: string;
  searchPlaceholder: string;
  switchLang: string;
  dayNightToggle: string;
  all: string;
  active: string;
  waiting: string;
  inactive: string;
  cancelled: string;
  completed: string;
  onRoad: string;
  loading: string;
  ready: string;
  planning: string;
  arrived: string;
  delivered: string;
  status: string;
  actions: string;
  save: string;
  cancel: string;
  confirm: string;
  close: string;
  delete: string;
  edit: string;
  viewDetails: string;
  reset: string;
  filterByBrand: string;
  filterByPartner: string;
  show: string;

  // Navigation
  dashboard: string;
  tracking: string;
  trips: string;
  trucks: string;
  cargos: string;
  drivers: string;
  partners: string;
  maintenance: string;
  reports: string;
  aiAssistant: string;
  alerts: string;
  chats: string;
  history: string;
  settings: string;
  createNewRequest: string;

  // Roles
  roleAdmin: string;
  roleDriver: string;
  roleShipper: string;
  roleOwner: string;
  currentRole: string;
  switchRole: string;

  // Stats & KPIs
  totalShipments: string;
  activeTrips: string;
  fleetUtilization: string;
  totalDistance: string;
  onTimeRate: string;
  fuelEfficiency: string;
  activeUnitsLive: string;
  waitingUnits: string;
  maintenanceRequired: string;
  monthlyRevenue: string;

  // Tracking & Map
  liveTelemetry: string;
  speed: string;
  eta: string;
  distanceRemaining: string;
  distanceCovered: string;
  totalDistanceTrip: string;
  currentCapacity: string;
  currentLocation: string;
  origin: string;
  destination: string;
  driverName: string;
  driverPhone: string;
  plateNumber: string;
  truckModel: string;
  truckBodyType: string;
  horsePower: string;
  odometer: string;
  engineTemp: string;
  fuelLevel: string;
  boxTemp: string;
  payload: string;
  freeSpace: string;
  maxLoad: string;
  mapLayerVector: string;
  mapLayerGoogle: string;
  mapLayerSatellite: string;
  zoomIn: string;
  zoomOut: string;
  recenter: string;
  openGoogleMaps: string;

  // Trip Lifecycle
  tripDetails: string;
  tripNumber: string;
  lifecycleTimeline: string;
  consignee: string;
  shipperName: string;
  changeStatus: string;
  startTrip: string;
  confirmLoading: string;
  takeRest: string;
  confirmArrival: string;
  confirmDelivery: string;
  proofOfDelivery: string;
  digitalSignature: string;
  signHere: string;
  printWaybill: string;
  shareTrackingLink: string;
  copyLink: string;
  linkCopied: string;
  qrCodeScan: string;

  // AI Assistant
  aiTitle: string;
  aiSub: string;
  aiPlaceholder: string;
  aiRecommendations: string;
  aiUnderutilizedAlert: string;
  aiDelayPrediction: string;
  aiDispatchSuggest: string;
  aiTripSummary: string;
  aiEcoRoute: string;
  aiAnalyzeFleet: string;
  aiAskPrompt: string;

  // Alerts
  alertsCenter: string;
  markAllRead: string;
  clearAlerts: string;
  critical: string;
  warning: string;
  info: string;
  offRouteAlert: string;
  idleAlert: string;
  tempAlert: string;
  docExpiryAlert: string;
  speedAlert: string;

  // Chat & Communication
  chatWithDriver: string;
  callDriver: string;
  typeMessage: string;
  send: string;
  driverTyping: string;

  // Mobile App
  mobileCompanion: string;
  mobileTrackTitle: string;
  mobileRecent: string;
  mobileScanCode: string;
  mobileTurnInstruction: string;
  mobileCurrentSpeed: string;
}

export const AR: Translations = {
  brandName: "إيجاز",
  brandSub: "مؤسسة إيجاز للنقليات — إدارة الأسطول والرحلات",
  since: "منذ عام ٢٠٢٢",
  searchPlaceholder: "ابحث برقم الشحنة، السائق، اللوحة، أو اسأل الذكاء الاصطناعي...",
  switchLang: "English",
  dayNightToggle: "الوضع النهاري / الليلي",
  all: "الكل",
  active: "نشط",
  waiting: "في الانتظار",
  inactive: "متوقفة",
  cancelled: "ملغاة",
  completed: "مكتملة",
  onRoad: "على الطريق",
  loading: "قيد التحميل",
  ready: "جاهزة للانطلاق",
  planning: "قيد التجهيز",
  arrived: "وصلت للموقع",
  delivered: "تم التسليم",
  status: "الحالة",
  actions: "الإجراءات",
  save: "حفظ",
  cancel: "إلغاء",
  confirm: "تأكيد",
  close: "إغلاق",
  delete: "حذف",
  edit: "تعديل",
  viewDetails: "عرض التفاصيل",
  reset: "إعادة ضبط",
  filterByBrand: "تصفية حسب الماركة",
  filterByPartner: "تصفية حسب الشريك",
  show: "عرض",

  dashboard: "لوحة التحكم",
  tracking: "التتبع المباشر",
  trips: "إدارة الرحلات",
  trucks: "الشاحنات",
  cargos: "الشحنات والحمولات",
  drivers: "السائقون",
  partners: "الشركاء والعملاء",
  maintenance: "الصيانة والورشة",
  reports: "التقارير والإحصائيات",
  aiAssistant: "مساعد إيجاز الذكي",
  alerts: "التنبيهات الذكية",
  chats: "المحادثات والاتصال",
  history: "سجل العمليات",
  settings: "الإعدادات",
  createNewRequest: "إنشاء طلب شحن جديد",

  roleAdmin: "مدير العمليات (Admin)",
  roleDriver: "بوابة السائق (Driver)",
  roleShipper: "بوابة العميل (Shipper)",
  roleOwner: "مالك الأسطول (Fleet Owner)",
  currentRole: "الدور الحالي",
  switchRole: "تبديل الصلاحية",

  totalShipments: "إجمالي الشحنات",
  activeTrips: "رحلات نشطة الآن",
  fleetUtilization: "نسبة استغلال الأسطول",
  totalDistance: "المسافات المقطوعة",
  onTimeRate: "نسبة الالتزام بالوقت",
  fuelEfficiency: "كفاءة استهلاك الوقود",
  activeUnitsLive: "شاحنات تعمل على الطريق",
  waitingUnits: "شاحنات بانتظار التحميل",
  maintenanceRequired: "شاحنات في الصيانة",
  monthlyRevenue: "العائد التشغيلي التقديري",

  liveTelemetry: "بيانات التتبع المباشر",
  speed: "السرعة الحالية",
  eta: "وقت الوصول المتوقع",
  distanceRemaining: "المسافة المتبقية",
  distanceCovered: "المسافة المقطوعة",
  totalDistanceTrip: "إجمالي المسافة",
  currentCapacity: "سعة الشاحنة والحمولة",
  currentLocation: "الموقع الجغرافي الحقيقي",
  origin: "نقطة الانطلاق",
  destination: "نقطة الوصول والتسليم",
  driverName: "اسم السائق",
  driverPhone: "هاتف السائق",
  plateNumber: "رقم اللوحة",
  truckModel: "موديل الشاحنة",
  truckBodyType: "نوع المقطورة / الهيكل",
  horsePower: "قوة المحرك",
  odometer: "العداد الإجمالي",
  engineTemp: "حرارة المحرك",
  fuelLevel: "مستوى خزان الوقود",
  boxTemp: "حرارة الصندوق المبرّد",
  payload: "الحمولة الفعلية",
  freeSpace: "المساحة المتبقية",
  maxLoad: "الحمولة القصوى",
  mapLayerVector: "خريطة النقل التفاعلية",
  mapLayerGoogle: "عرض خرائط Google",
  mapLayerSatellite: "قمر صناعي (Satellite)",
  zoomIn: "تكبير الخريطة",
  zoomOut: "تصغير الخريطة",
  recenter: "إعادة التمركز على الشاحنة",
  openGoogleMaps: "فتح في خرائط Google مباشرة",

  tripDetails: "تفاصيل الرحلة والشحنة",
  tripNumber: "رقم الرحلة",
  lifecycleTimeline: "المخطط الزمني لمسار الرحلة",
  consignee: "المرسل إليه",
  shipperName: "الجهة الشاحنة",
  changeStatus: "تحديث حالة الرحلة",
  startTrip: "بدء انطلاق الرحلة",
  confirmLoading: "تأكيد اكتمال التحميل",
  takeRest: "تسجيل استراحة سائق",
  confirmArrival: "تأكيد الوصول للموقع",
  confirmDelivery: "تأكيد التسليم النهائي",
  proofOfDelivery: "إثبات التسليم الإلكتروني (POD)",
  digitalSignature: "التوقيع الرقمي للمستلم",
  signHere: "وقّع هنا لإثبات الاستلام",
  printWaybill: "طباعة بوليصة الشحن (Waybill)",
  shareTrackingLink: "مشاركة رابط التتبع مع العميل",
  copyLink: "نسخ الرابط",
  linkCopied: "تم نسخ الرابط بنجاح!",
  qrCodeScan: "رمز الاستجابة السريعة (QR)",

  aiTitle: "مساعد إيجاز الذكي للوجستيات",
  aiSub: "تحليلات تشغيلية مدعومة بالذكاء الاصطناعي لحركة الأسطول والرحلات",
  aiPlaceholder: "اسأل المساعد: أين شاحنات جدة؟ ما الشاحنات المعرضة للتأخير؟",
  aiRecommendations: "التوصيات والفرص التشغيلية الحية",
  aiUnderutilizedAlert: "تنبيه استغلال: ٣ شاحنات في الرياض جاهزة للحمولة دون تكليف",
  aiDelayPrediction: "توقع التأخير: رحلة مكة-الرياض قد تتأخر ٢٢ دقيقة بسبب تباطؤ السرعة",
  aiDispatchSuggest: "توزيع ذكي: الشاحنة MB-4829 هي الأقرب لتحميل شحنة سدافكو القادمة",
  aiTripSummary: "ملخص الذكاء الاصطناعي للرحلة",
  aiEcoRoute: "مسار موفر للوقود: توفير ٨٪ عبر طريق الدائري الثاني",
  aiAnalyzeFleet: "تحليل الأسطول الآن",
  aiAskPrompt: "استعلام فوري",

  alertsCenter: "مركز التنبيهات المباشرة",
  markAllRead: "تحديد الكل كمقروء",
  clearAlerts: "مسح التنبيهات",
  critical: "حرج",
  warning: "تحذير",
  info: "معلومة",
  offRouteAlert: "انحراف عن المسار المعتمد",
  idleAlert: "توقف طويل غير مبرر",
  tempAlert: "تغير في درجة حرارة المبرّد",
  docExpiryAlert: "اقتراب انتهاء ترخيص أو بوليصة",
  speedAlert: "تجاوز السرعة القانونية للشاحنات",

  chatWithDriver: "محادثة العمليات مع السائق",
  callDriver: "اتصال هاتفي مباشر",
  typeMessage: "اكتب رسالة إلى السائق أو غرفة العمليات...",
  send: "إرسال",
  driverTyping: "السائق يكتب الآن...",

  mobileCompanion: "تطبيق الجوال المرافق للعميل والسائق",
  mobileTrackTitle: "تتبّع شحنتك لحظة بلحظة",
  mobileRecent: "آخر الشحنات المنقولة",
  mobileScanCode: "مسح رمز البوليصة بالكاميرا",
  mobileTurnInstruction: "التعليمات الملاحية المباشرة",
  mobileCurrentSpeed: "السرعة اللحظية",
};

export const EN: Translations = {
  brandName: "EJAZ",
  brandSub: "Establishment Ejaz Transport — Fleet & Trip Control",
  since: "Since 2022",
  searchPlaceholder: "Search shipment ID, driver, plate, or ask AI assistant...",
  switchLang: "عربي",
  dayNightToggle: "Day / Night Mode",
  all: "All",
  active: "Active",
  waiting: "Waiting",
  inactive: "Inactive",
  cancelled: "Cancelled",
  completed: "Completed",
  onRoad: "On Route",
  loading: "Loading",
  ready: "Ready for Departure",
  planning: "Planning",
  arrived: "Arrived at Destination",
  delivered: "Delivered",
  status: "Status",
  actions: "Actions",
  save: "Save",
  cancel: "Cancel",
  confirm: "Confirm",
  close: "Close",
  delete: "Delete",
  edit: "Edit",
  viewDetails: "View Details",
  reset: "Reset",
  filterByBrand: "Filter by Brand",
  filterByPartner: "Filter by Partner",
  show: "Show",

  dashboard: "Dashboard",
  tracking: "Live Tracking",
  trips: "Trips Management",
  trucks: "Trucks",
  cargos: "Cargos & Freight",
  drivers: "Drivers",
  partners: "Partners & Shippers",
  maintenance: "Maintenance & Workshop",
  reports: "Analytics & Reports",
  aiAssistant: "AI Logistics Assistant",
  alerts: "Smart Alerts",
  chats: "Dispatch Chat",
  history: "Audit Logs",
  settings: "Settings",
  createNewRequest: "Create New Dispatch Request",

  roleAdmin: "Fleet Ops Manager (Admin)",
  roleDriver: "Truck Driver Portal",
  roleShipper: "Client / Shipper Portal",
  roleOwner: "Fleet Asset Owner",
  currentRole: "Current Persona",
  switchRole: "Switch Role",

  totalShipments: "Total Shipments",
  activeTrips: "Active Trips Right Now",
  fleetUtilization: "Fleet Utilization Rate",
  totalDistance: "Total Distance Logged",
  onTimeRate: "On-Time Delivery Rate",
  fuelEfficiency: "Fuel Efficiency Score",
  activeUnitsLive: "Trucks Live on Highway",
  waitingUnits: "Trucks Awaiting Loading",
  maintenanceRequired: "Units in Maintenance",
  monthlyRevenue: "Est. Operating Revenue",

  liveTelemetry: "Live Telemetry Feed",
  speed: "Current Speed",
  eta: "Estimated Arrival (ETA)",
  distanceRemaining: "Distance Remaining",
  distanceCovered: "Distance Covered",
  totalDistanceTrip: "Total Corridor Distance",
  currentCapacity: "Truck Capacity & Payload",
  currentLocation: "Live GPS Coordinates",
  origin: "Origin Terminal",
  destination: "Delivery Destination",
  driverName: "Driver Name",
  driverPhone: "Driver Phone",
  plateNumber: "Plate Number",
  truckModel: "Truck Model",
  truckBodyType: "Trailer / Body Type",
  horsePower: "Engine Power",
  odometer: "Total Odometer",
  engineTemp: "Engine Temp",
  fuelLevel: "Fuel Level",
  boxTemp: "Reefer Box Temp",
  payload: "Current Payload",
  freeSpace: "Free Space Remaining",
  maxLoad: "Max Authorized Load",
  mapLayerVector: "Interactive Vector Map",
  mapLayerGoogle: "Google Maps Embed",
  mapLayerSatellite: "Satellite Hybrid View",
  zoomIn: "Zoom In",
  zoomOut: "Zoom Out",
  recenter: "Recenter on Truck",
  openGoogleMaps: "Open in Google Maps Directly",

  tripDetails: "Trip & Consignment Details",
  tripNumber: "Trip ID",
  lifecycleTimeline: "Trip Lifecycle Timeline",
  consignee: "Consignee / Recipient",
  shipperName: "Shipper Organization",
  changeStatus: "Update Trip Lifecycle",
  startTrip: "Start Trip Departure",
  confirmLoading: "Confirm Loading Done",
  takeRest: "Log Driver Rest Stop",
  confirmArrival: "Confirm Destination Arrival",
  confirmDelivery: "Confirm Final Delivery",
  proofOfDelivery: "Proof of Delivery (POD)",
  digitalSignature: "Consignee Digital Signature",
  signHere: "Sign here to confirm receipt",
  printWaybill: "Print Electronic Consignment Waybill",
  shareTrackingLink: "Share Tracking Link with Client",
  copyLink: "Copy Public Link",
  linkCopied: "Link copied to clipboard!",
  qrCodeScan: "Waybill QR Code",

  aiTitle: "EJAZ AI Logistics Assistant",
  aiSub: "Predictive operational intelligence for heavy fleet dispatch",
  aiPlaceholder: "Ask AI: Where are Jeddah trucks? Which trips are delayed?",
  aiRecommendations: "Live Operational Recommendations",
  aiUnderutilizedAlert: "Utilization Alert: 3 trucks in Riyadh idle without assigned trip",
  aiDelayPrediction: "Delay Risk: Trip Makkah-Riyadh may slip 22 min due to speed drop",
  aiDispatchSuggest: "Smart Dispatch: Actros MB-4829 is closest for upcoming SADAFCO load",
  aiTripSummary: "AI Trip Performance Summary",
  aiEcoRoute: "Eco Route Suggestion: 8% fuel savings via Ring Highway Bypass",
  aiAnalyzeFleet: "Analyze Fleet Now",
  aiAskPrompt: "Query AI",

  alertsCenter: "Live Smart Alerts Center",
  markAllRead: "Mark All as Read",
  clearAlerts: "Clear All",
  critical: "Critical",
  warning: "Warning",
  info: "Information",
  offRouteAlert: "Route deviation detected",
  idleAlert: "Extended unauthorized stoppage",
  tempAlert: "Reefer temperature drift alert",
  docExpiryAlert: "Permit or ADR document expiring soon",
  speedAlert: "Highway speed limit exceeded",

  chatWithDriver: "Operations Dispatch Chat",
  callDriver: "Direct Cellular Call",
  typeMessage: "Type dispatch instruction or update...",
  send: "Send",
  driverTyping: "Driver is typing...",

  mobileCompanion: "Mobile Companion App for Shipper & Driver",
  mobileTrackTitle: "Track Your Freight Live",
  mobileRecent: "Recent Consignments",
  mobileScanCode: "Scan Waybill Barcode / QR",
  mobileTurnInstruction: "Turn-by-turn Navigation Instruction",
  mobileCurrentSpeed: "Live Ground Speed",
};

export const UR: Translations = {
  brandName: "اعجاز",
  brandSub: "اعجاز ٹرانسپورٹ — ہیوی فلیٹ اور لاجسٹکس مینجمنٹ",
  since: "قیام ۲۰۲۲",
  searchPlaceholder: "کھیپ کا نمبر، ڈرائیور، نمبر پلیٹ تلاش کریں...",
  switchLang: "زبان منتخب کریں",
  dayNightToggle: "دن / رات موڈ",
  all: "تمام",
  active: "فعال",
  waiting: "انتظار میں",
  inactive: "غیر فعال",
  cancelled: "منسوخ",
  completed: "مکمل",
  onRoad: "راستے میں",
  loading: "لوڈنگ جاری",
  ready: "روانگی کے لیے تیار",
  planning: "منصوبہ بندی",
  arrived: "منزل پر پہنچ گیا",
  delivered: "ڈیلیور ہو گیا",
  status: "حالت",
  actions: "اقدامات",
  save: "محفوظ کریں",
  cancel: "منسوخ کریں",
  confirm: "تصدیق کریں",
  close: "بند کریں",
  delete: "حذف کریں",
  edit: "ترمیم کریں",
  viewDetails: "تفصیلات دیکھیں",
  reset: "دوبارہ ترتیب دیں",
  filterByBrand: "برانڈ کے لحاظ سے فلٹر",
  filterByPartner: "پارٹنر کے لحاظ سے فلٹر",
  show: "دکھائیں",

  dashboard: "ڈیش بورڈ",
  tracking: "لائیو ٹریکنگ",
  trips: "ٹرپس مینجمنٹ",
  trucks: "ٹرکس",
  cargos: "کھیپ اور کارگو",
  drivers: "ڈرائیورز",
  partners: "شراکت دار اور کلائنٹس",
  maintenance: "مرمت اور دیکھ بھال",
  reports: "رپورٹس اور تجزیات",
  aiAssistant: "اعجاز اسسٹنٹ",
  alerts: "سمارٹ الرٹس",
  chats: "پیغامات اور مواصلات",
  history: "آپریشنل تاریخ",
  settings: "سیٹنگز",
  createNewRequest: "نئی شپمنٹ بنائیں",

  roleAdmin: "آپریشنز مینیجر (Admin)",
  roleDriver: "ڈرائیور پورٹل (Driver)",
  roleShipper: "کلائنٹ پورٹل (Client)",
  roleOwner: "فلیٹ کا مالک (Owner)",
  currentRole: "موجودہ کردار",
  switchRole: "کردار تبدیل کریں",

  totalShipments: "کل ترسیلات",
  activeTrips: "فعال ٹرپس",
  fleetUtilization: "فلیٹ کا استعمال",
  totalDistance: "طے شدہ فاصلہ",
  onTimeRate: "بروقت ترسیل کی شرح",
  fuelEfficiency: "ایندھن کی کارکردگی",
  activeUnitsLive: "روڈ پر فعال ٹرکس",
  waitingUnits: "لوڈنگ کے منتظر",
  maintenanceRequired: "مرمت کے طلب گار",
  monthlyRevenue: "متوقع آمدنی",

  liveTelemetry: "براہ راست ٹیلی میٹری ڈیٹا",
  speed: "موجودہ رفتار",
  eta: "آمد کا متوقع وقت",
  distanceRemaining: "باقی فاصلہ",
  distanceCovered: "طے شدہ فاصلہ",
  totalDistanceTrip: "کل فاصلہ",
  currentCapacity: "لوڈ کی صلاحیت",
  currentLocation: "موجودہ مقام",
  origin: "نقطہ آغاز",
  destination: "منزل",
  driverName: "ڈرائیور کا نام",
  driverPhone: "ڈرائیور کا فون",
  plateNumber: "پلیٹ نمبر",
  truckModel: "ماڈل",
  truckBodyType: "گاڑی کی قسم",
  horsePower: "انجن پاور",
  odometer: "اوڈومیٹر",
  engineTemp: "انجن کا درجہ حرارت",
  fuelLevel: "ایندھن کی سطح",
  boxTemp: "کنٹینر درجہ حرارت",
  payload: "موجودہ وزن",
  freeSpace: "باقی گنجائش",
  maxLoad: "زیادہ سے زیادہ وزن",
  mapLayerVector: "ویکٹر میپ",
  mapLayerGoogle: "گوگل میپ",
  mapLayerSatellite: "سیٹلائٹ میپ",
  zoomIn: "زوم ان",
  zoomOut: "زوم آؤٹ",
  recenter: "ٹرک پر فوکس کریں",
  openGoogleMaps: "گوگل میپ میں کھولیں",

  tripDetails: "ٹرپ اور کھیپ کی تفصیلات",
  tripNumber: "ٹرپ نمبر",
  lifecycleTimeline: "ٹرپ کی مراحل وار تاریخ",
  consignee: "وصول کنندہ",
  shipperName: "ارسال کنندہ کمپنی",
  changeStatus: "ٹرپ کی حالت تبدیل کریں",
  startTrip: "ٹرپ شروع کریں",
  confirmLoading: "لوڈنگ کی تصدیق کریں",
  takeRest: "ڈرائیور کا آرام",
  confirmArrival: "آمد کی تصدیق کریں",
  confirmDelivery: "ترسیل کی حتمی تصدیق",
  proofOfDelivery: "ثبوت ترسیل (POD)",
  digitalSignature: "ڈیجیٹل دستخط",
  signHere: "وصولی کی تصدیق کے لیے یہاں دستخط کریں",
  printWaybill: "بارنامہ پرنٹ کریں",
  shareTrackingLink: "ٹریکنگ لنک شیئر کریں",
  copyLink: "لنک کاپی کریں",
  linkCopied: "لنک کاپی ہو گیا!",
  qrCodeScan: "کیو آر کوڈ اسکین کریں",

  aiTitle: "اعجاز اسسٹنٹ برائے لاجسٹکس",
  aiSub: "ہیوی فلیٹ آپریشنز کے لیے جدید معاون",
  aiPlaceholder: "پوچھیں: کون سے ٹرپس تاخیر کا شکار ہیں؟",
  aiRecommendations: "براہ راست آپریشنل سفارشات",
  aiUnderutilizedAlert: "انتباہ: ۳ ٹرکس بغیر ٹرپ کے کھڑے ہیں",
  aiDelayPrediction: "تاخیر کا خطرہ: مکہ تا ریاض ٹرپ میں تاخیر ہو سکتی ہے",
  aiDispatchSuggest: "تجویز: ٹرک MB-4829 اگلی لوڈنگ کے لیے قریب ترین ہے",
  aiTripSummary: "ٹرپ کی کارکردگی کا خلاصہ",
  aiEcoRoute: "کم ایندھن والا راستہ: ۸٪ بچت ممکن ہے",
  aiAnalyzeFleet: "فلیٹ کا تجزیہ کریں",
  aiAskPrompt: "استفسار بھیجیں",

  alertsCenter: "سمارٹ الرٹس سینٹر",
  markAllRead: "سب کو پڑھا ہوا نشان زد کریں",
  clearAlerts: "سب صاف کریں",
  critical: "انتہائی اہم",
  warning: "انتباہ",
  info: "معلومات",
  offRouteAlert: "راستے سے انحراف کا پتہ چلا",
  idleAlert: "غیر مجاز طویل قیام",
  tempAlert: "کنٹینر کے درجہ حرارت میں تبدیلی",
  docExpiryAlert: "دستاویزات کی میعاد ختم ہونے والی ہے",
  speedAlert: "رفتار کی حد سے تجاوز",

  chatWithDriver: "ڈسپیچ چیٹ",
  callDriver: "فون کال کریں",
  typeMessage: "پیغام لکھیں...",
  send: "بھیجیں",
  driverTyping: "ڈرائیور ٹائپ کر رہا ہے...",

  mobileCompanion: "کلائنٹ اور ڈرائیور کے لیے موبائل ایپ",
  mobileTrackTitle: "اپنی کھیپ کو لائیو ٹریک کریں",
  mobileRecent: "حالیہ ترسیلات",
  mobileScanCode: "بارکوڈ یا کیو آر اسکین کریں",
  mobileTurnInstruction: "نیویگیشن ہدایات",
  mobileCurrentSpeed: "لائیو رفتار",
};

export function getDictionary(lang: "ar" | "en" | "ur"): Translations {
  if (lang === "ur") return UR;
  return lang === "ar" ? AR : EN;
}
