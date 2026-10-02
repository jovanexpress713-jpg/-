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

export function getDictionary(lang: "ar" | "en"): Translations {
  return lang === "ar" ? AR : EN;
}
