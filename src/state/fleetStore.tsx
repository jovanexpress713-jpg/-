import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BodyType, Driver, Vehicle } from "../data/types";
import { FLEET } from "../data/fleet";
import { interpolateRoute } from "../services/gpsSimulation";
import { apiClient } from "../services/apiClient";

export type Role = "admin" | "driver" | "shipper" | "owner";

export type TripStatus =
  | "new"
  | "planning"
  | "loading"
  | "ready"
  | "on_road"
  | "stopped"
  | "arrived"
  | "delivered"
  | "completed"
  | "cancelled";

export interface TimelineEvent {
  id: string;
  timestamp: string;
  titleAr: string;
  titleEn: string;
  status: TripStatus;
  actor: string;
  notes?: string;
}

export interface Trip {
  id: string;
  tripNumber: string;
  truckId: string;
  driverId: string;
  shipper: string;
  consignee: string;
  originCity: string;
  originTerminal: string;
  destinationCity: string;
  destinationTerminal: string;
  corridorKey: string;
  cargoType: BodyType;
  cargoWeightTons: number;
  maxCapacityTons: number;
  status: TripStatus;
  progressPct: number;
  speedKmH: number;
  headingDeg: number;
  currentLat: number;
  currentLng: number;
  distanceTotalKm: number;
  distanceCoveredKm: number;
  distanceRemainingKm: number;
  etaMinutes: number;
  nextWaypointAr: string;
  nextWaypointEn: string;
  createdAt: string;
  departureTime?: string;
  deliveryTime?: string;
  isDelayed?: boolean;
  reeferTempC?: number;
  targetTempC?: number;
  timeline: TimelineEvent[];
  qrCodeToken: string;
  recipientSignature?: string;
  notes?: string;
}

export interface SmartAlert {
  id: string;
  type: "delay" | "off_route" | "idle" | "temp" | "doc_expiry" | "speed" | "utilization";
  severity: "critical" | "warning" | "info";
  tripId?: string;
  truckId?: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  timestamp: string;
  resolved: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  actionAr: string;
  actionEn: string;
  tripNumber?: string;
  details: string;
}

export interface ChatMessage {
  id: string;
  tripId: string;
  from: "dispatch" | "driver" | "shipper" | "system";
  senderName: string;
  textAr: string;
  textEn: string;
  timestamp: string;
  read: boolean;
}

interface FleetStoreContextType {
  // Data
  trucks: Vehicle[];
  trips: Trip[];
  drivers: Driver[];
  alerts: SmartAlert[];
  auditLogs: AuditLog[];
  chatMessages: ChatMessage[];
  selectedTripId: string;
  selectedTruckId: string;
  currentRole: Role;
  isSimulating: boolean;
  searchQuery: string;

  // Selected Entities
  selectedTrip: Trip;
  selectedTruck: Vehicle;

  // Actions
  selectTrip: (id: string) => void;
  selectTruck: (id: string) => void;
  setRole: (role: Role) => void;
  setSearchQuery: (q: string) => void;
  toggleSimulation: () => void;
  updateTripStatus: (
    tripId: string,
    newStatus: TripStatus,
    noteAr?: string,
    noteEn?: string,
    signature?: string
  ) => void;
  updateCargoWeight: (tripId: string, tons: number) => void;
  assignDriverAndTruck: (tripId: string, driverId: string, truckId: string) => void;
  createNewTrip: (tripData: Partial<Trip>) => Trip;
  resolveAlert: (alertId: string) => void;
  sendChatMessage: (tripId: string, text: string) => void;
  recordAuditLog: (actionAr: string, actionEn: string, tripNumber?: string, details?: string) => void;
  resetAllDemoData: () => void;
}

const FleetStoreContext = createContext<FleetStoreContextType>(null!);

// Initial Drivers
const INITIAL_DRIVERS: Driver[] = [
  { name: "فهد القحطاني", phone: "+966 55 214 8890", initials: "FQ", rating: 4.9, trips: 412 },
  { name: "محمد رفيق الإسلام", phone: "+966 56 908 4412", initials: "RI", rating: 4.7, trips: 268 },
  { name: "يوسف الغامدي", phone: "+966 53 771 2056", initials: "YG", rating: 4.5, trips: 190 },
  { name: "نجيب الله خان", phone: "+966 59 330 7715", initials: "NU", rating: 4.8, trips: 355 },
  { name: "فيجاي بيريرا", phone: "+966 54 112 6603", initials: "VP", rating: 4.6, trips: 141 },
  { name: "سالم الدوسري", phone: "+966 50 448 9921", initials: "SD", rating: 4.3, trips: 508 },
  { name: "عارف هدايت", phone: "+966 57 205 1188", initials: "AH", rating: 4.7, trips: 233 },
  { name: "بندر المطيري", phone: "+966 56 447 2019", initials: "BM", rating: 4.8, trips: 377 },
  { name: "خالد الأنصاري", phone: "+966 53 660 7734", initials: "KA", rating: 4.2, trips: 611 },
  { name: "عمر فاروق", phone: "+966 58 224 9930", initials: "OF", rating: 4.6, trips: 164 },
  { name: "حسان العلي", phone: "+966 59 117 3328", initials: "HA", rating: 4.9, trips: 296 },
  { name: "سعود الحربي", phone: "+966 56 330 4471", initials: "SH", rating: 4.5, trips: 62 },
];

// Initial Trips across real Saudi corridors
const INITIAL_TRIPS: Trip[] = [
  {
    id: "trip-1",
    tripNumber: "EZ-10482",
    truckId: "v1",
    driverId: "d1",
    shipper: "الراجحي للخدمات اللوجستية",
    consignee: "سوق الخضار المركزي - جدة",
    originCity: "الرياض",
    originTerminal: "مستودع الرياض المركزي - بوابة ٣",
    destinationCity: "جدة",
    destinationTerminal: "ميناء جدة الإسلامي - رصيف ٧",
    corridorKey: "riyadh-jeddah",
    cargoType: "curtain",
    cargoWeightTons: 21.4,
    maxCapacityTons: 25.0,
    status: "on_road",
    progressPct: 44,
    speedKmH: 87,
    headingDeg: 258,
    currentLat: 23.3102,
    currentLng: 42.8105,
    distanceTotalKm: 948,
    distanceCoveredKm: 417,
    distanceRemainingKm: 531,
    etaMinutes: 214,
    nextWaypointAr: "استراحة واستراحة ظلم",
    nextWaypointEn: "Zalim Rest Stop",
    createdAt: "اليوم ٠٦:٣٠ ص",
    departureTime: "اليوم ٠٧:١٥ ص",
    isDelayed: false,
    qrCodeToken: "EJAZ-WB-948210331",
    timeline: [
      { id: "e1", timestamp: "٠٦:٣٠ ص", titleAr: "إنشاء أمر الشحن وتخصيص الشاحنة", titleEn: "Consignment created & truck assigned", status: "planning", actor: "غرفة العمليات" },
      { id: "e2", timestamp: "٠٧:٠٠ ص", titleAr: "اكتمال التحميل ووزن الشاحنة (٢١.٤ طن)", titleEn: "Loading completed & weighed (21.4t)", status: "loading", actor: "مشرف المستودع" },
      { id: "e3", timestamp: "٠٧:١٥ ص", titleAr: "مغادرة الرياض وبدء الرحلة عبر طريق ٤٠", titleEn: "Departed Riyadh via Highway 40", status: "on_road", actor: "السائق فهد القحطاني" },
      { id: "e4", timestamp: "٠٩:٤٥ ص", titleAr: "اجتياز ميزان القويعية بنجاح", titleEn: "Passed Al Quwayiyah weighbridge", status: "on_road", actor: "نظام التتبع الآلي" },
    ],
  },
  {
    id: "trip-2",
    tripNumber: "EZ-10483",
    truckId: "v2",
    driverId: "d2",
    shipper: "شركة سدافكو للمنتجات المبردة",
    consignee: "المستودع الإقليمي بالرياض",
    originCity: "الدمام",
    originTerminal: "مصنع ألبان الدمام",
    destinationCity: "الرياض",
    destinationTerminal: "مستودع التبريد المركزي - رصيف ٢",
    corridorKey: "dammam-riyadh",
    cargoType: "reefer",
    cargoWeightTons: 18.2,
    maxCapacityTons: 22.0,
    status: "on_road",
    progressPct: 68,
    speedKmH: 82,
    headingDeg: 242,
    currentLat: 25.1205,
    currentLng: 48.7214,
    distanceTotalKm: 395,
    distanceCoveredKm: 268,
    distanceRemainingKm: 127,
    etaMinutes: 92,
    nextWaypointAr: "ميزان شاحنات سعد",
    nextWaypointEn: "Saad Truck Weighbridge",
    createdAt: "اليوم ٠٥:٤٥ ص",
    departureTime: "اليوم ٠٦:٣٠ ص",
    reeferTempC: -18.5,
    targetTempC: -18.0,
    qrCodeToken: "EJAZ-WB-482911204",
    timeline: [
      { id: "e1", timestamp: "٠٥:٤٥ ص", titleAr: "طلب نقل بضائع مجمدة - حرارة -18°C", titleEn: "Frozen cargo request -18°C", status: "planning", actor: "سدافكو" },
      { id: "e2", timestamp: "٠٦:١٥ ص", titleAr: "التبريد المسبق وتأكيد سلامة العوازل", titleEn: "Pre-cooling check confirmed", status: "ready", actor: "فني الجودة" },
      { id: "e3", timestamp: "٠٦:٣٠ ص", titleAr: "انطلاق الرحلة من الدمام", titleEn: "Departed Dammam plant", status: "on_road", actor: "السائق محمد رفيق" },
      { id: "e4", timestamp: "٠٨:١٠ ص", titleAr: "فحص حراري في مركز تبريد الهفوف (-18.5°C)", titleEn: "Thermal audit at Hofuf (-18.5°C)", status: "on_road", actor: "مستشعر IoT" },
    ],
  },
  {
    id: "trip-3",
    tripNumber: "EZ-10484",
    truckId: "v4",
    driverId: "d4",
    shipper: "أرامكو السعودية للوقود",
    consignee: "محطة توزيع الوقود المركزية",
    originCity: "الجبيل",
    originTerminal: "مصفاة الجبيل للبتروكيماويات",
    destinationCity: "الرياض",
    destinationTerminal: "مستودع الكيماويات - جنوب الرياض",
    corridorKey: "jubail-riyadh",
    cargoType: "tanker",
    cargoWeightTons: 28.6,
    maxCapacityTons: 32.0,
    status: "on_road",
    progressPct: 55,
    speedKmH: 90,
    headingDeg: 235,
    currentLat: 25.8211,
    currentLng: 48.4211,
    distanceTotalKm: 470,
    distanceCoveredKm: 258,
    distanceRemainingKm: 212,
    etaMinutes: 142,
    nextWaypointAr: "استراحة رماح للشاحنات",
    nextWaypointEn: "Rumah Heavy Fleet Stop",
    createdAt: "اليوم ٠٧:٠٠ ص",
    departureTime: "اليوم ٠٧:٤٠ ص",
    qrCodeToken: "EJAZ-WB-203918442",
    timeline: [
      { id: "e1", timestamp: "٠٧:٠٠ ص", titleAr: "فحص شهادة ADR لنقل المواد الخطرة", titleEn: "ADR Hazmat verification approved", status: "planning", actor: "أمن السلامة" },
      { id: "e2", timestamp: "٠٧:٣٠ ص", titleAr: "تعبئة الصهريج وإغلاق الأختام الإلكترونية", titleEn: "Tank filling & e-seal locked", status: "ready", actor: "مشغل المصفاة" },
      { id: "e3", timestamp: "٠٧:٤٠ ص", titleAr: "الانطلاق على طريق الجبيل السريع", titleEn: "Departure via Jubail Hwy", status: "on_road", actor: "السائق نجيب الله" },
    ],
  },
  {
    id: "trip-4",
    tripNumber: "EZ-10485",
    truckId: "v5",
    driverId: "d5",
    shipper: "محطة بوابة البحر الأحمر (RSGT)",
    consignee: "الميناء الجاف بالمدينة المنورة",
    originCity: "جدة",
    originTerminal: "ميناء جدة الإسلامي - رصيف ٧",
    destinationCity: "المدينة المنورة",
    destinationTerminal: "مركز المدينة اللوجستي - مستودع ب",
    corridorKey: "jeddah-madinah",
    cargoType: "container",
    cargoWeightTons: 24.1,
    maxCapacityTons: 28.0,
    status: "on_road",
    progressPct: 28,
    speedKmH: 86,
    headingDeg: 345,
    currentLat: 22.3811,
    currentLng: 39.0912,
    distanceTotalKm: 420,
    distanceCoveredKm: 118,
    distanceRemainingKm: 302,
    etaMinutes: 210,
    nextWaypointAr: "مجمع بترو رابغ",
    nextWaypointEn: "Rabigh Industrial Park",
    createdAt: "اليوم ٠٨:١٠ ص",
    departureTime: "اليوم ٠٩:٠٠ ص",
    qrCodeToken: "EJAZ-WB-203919015",
    timeline: [
      { id: "e1", timestamp: "٠٨:١٠ ص", titleAr: "تنزيل حاوية 40ft من السفينة وتحميلها", titleEn: "40ft container lifted onto chassis", status: "loading", actor: "رافعة الميناء" },
      { id: "e2", timestamp: "٠٨:٥٠ ص", titleAr: "إنهاء الفحص الجمركي والبيان", titleEn: "Customs declaration cleared", status: "ready", actor: "المخلص الجمركي" },
      { id: "e3", timestamp: "٠٩:٠٠ ص", titleAr: "الانطلاق باتجاه طريق الهجرة", titleEn: "Departed via Hijra Highway", status: "on_road", actor: "السائق فيجاي" },
    ],
  },
  {
    id: "trip-5",
    tripNumber: "EZ-10486",
    truckId: "v9",
    driverId: "d8",
    shipper: "مجموعة بن لادن السعودية",
    consignee: "مشروع نيوم - البوابة ٩",
    originCity: "الرياض",
    originTerminal: "ساحة تحميل الرياض - مخرج ١٨",
    destinationCity: "نيوم",
    destinationTerminal: "محطة تفريغ نيوم - البوابة ٩",
    corridorKey: "riyadh-neom",
    cargoType: "flatbed",
    cargoWeightTons: 23.9,
    maxCapacityTons: 27.0,
    status: "on_road",
    progressPct: 36,
    speedKmH: 80,
    headingDeg: 310,
    currentLat: 26.3283,
    currentLng: 43.9667,
    distanceTotalKm: 1380,
    distanceCoveredKm: 496,
    distanceRemainingKm: 884,
    etaMinutes: 660,
    nextWaypointAr: "مركز صيانة حائل",
    nextWaypointEn: "Hail Fleet Workshop",
    createdAt: "أمس ١٠:٠٠ م",
    departureTime: "أمس ١١:٣٠ م",
    qrCodeToken: "EJAZ-WB-512348120",
    timeline: [
      { id: "e1", timestamp: "أمس ١٠:٠٠ م", titleAr: "تحميل هياكل حديدية ومعدات ثقيلة", titleEn: "Structural steel loading", status: "loading", actor: "فريق الشحن" },
      { id: "e2", timestamp: "أمس ١١:١٥ م", titleAr: "تأمين وتثبيت السلاسل ومراجعة الأبعاد", titleEn: "Chain tie-down & oversized permits", status: "ready", actor: "فاحص السلامة" },
      { id: "e3", timestamp: "أمس ١١:٣٠ م", titleAr: "انطلاق القافلة عبر الممر الشمالي", titleEn: "Convoy departed North Corridor", status: "on_road", actor: "السائق بندر المطيري" },
    ],
  },
  {
    id: "trip-6",
    tripNumber: "EZ-10487",
    truckId: "v3",
    driverId: "d3",
    shipper: "أسمنت اليمامة",
    consignee: "موقع إنشاءات مكة المكرمة",
    originCity: "جدة",
    originTerminal: "صوامع الأسمنت - الميناء",
    destinationCity: "مكة",
    destinationTerminal: "موقع الصب الخرساني أ",
    corridorKey: "riyadh-jeddah",
    cargoType: "tipper",
    cargoWeightTons: 26.8,
    maxCapacityTons: 30.0,
    status: "loading",
    progressPct: 10,
    speedKmH: 0,
    headingDeg: 120,
    currentLat: 21.4858,
    currentLng: 39.1925,
    distanceTotalKm: 85,
    distanceCoveredKm: 8,
    distanceRemainingKm: 77,
    etaMinutes: 75,
    nextWaypointAr: "محطة ميزان بحرة",
    nextWaypointEn: "Bahrah Weighbridge",
    createdAt: "اليوم ٠٩:٣٠ ص",
    qrCodeToken: "EJAZ-WB-482912778",
    timeline: [
      { id: "e1", timestamp: "٠٩:٣٠ ص", titleAr: "وصول القلاب للساحة وجاري التحميل", titleEn: "Tipper arrived, bulk loading in progress", status: "loading", actor: "غرفة التحميل" },
    ],
  },
  {
    id: "trip-7",
    tripNumber: "EZ-10488",
    truckId: "v11",
    driverId: "d10",
    shipper: "أسمنت اليمامة",
    consignee: "مشروع أبراج الطائف",
    originCity: "جدة",
    originTerminal: "صوامع الأسمنت",
    destinationCity: "الطائف",
    destinationTerminal: "ساحة التفريغ أ - الهدا",
    corridorKey: "riyadh-jeddah",
    cargoType: "tipper",
    cargoWeightTons: 27.4,
    maxCapacityTons: 30.0,
    status: "arrived",
    progressPct: 96,
    speedKmH: 15,
    headingDeg: 85,
    currentLat: 21.2667,
    currentLng: 40.4167,
    distanceTotalKm: 170,
    distanceCoveredKm: 163,
    distanceRemainingKm: 7,
    etaMinutes: 10,
    nextWaypointAr: "موقع التفريغ - الطائف",
    nextWaypointEn: "Taif Discharge Site",
    createdAt: "اليوم ٠٤:٠٠ ص",
    departureTime: "اليوم ٠٥:٠٠ ص",
    qrCodeToken: "EJAZ-WB-660927431",
    timeline: [
      { id: "e1", timestamp: "٠٥:٠٠ ص", titleAr: "الانطلاق من جدة لصعود عقبة الهدا", titleEn: "Departed Jeddah climbing Al Hada", status: "on_road", actor: "السائق عمر فاروق" },
      { id: "e2", timestamp: "٠٩:٥٠ ص", titleAr: "الوصول لبوابة الموقع والاستعداد للصب", titleEn: "Arrived at site gate, ready for tipping", status: "arrived", actor: "السائق عمر فاروق" },
    ],
  },
];

// Initial Smart Alerts
const INITIAL_ALERTS: SmartAlert[] = [
  {
    id: "alt-1",
    type: "delay",
    severity: "warning",
    tripId: "trip-1",
    truckId: "v1",
    titleAr: "احتمال تأخير طفيف (١٨ دقيقة)",
    titleEn: "Potential slight delay (18 min)",
    descAr: "انخفاض سرعة الشاحنة إلى ٦٥ كم/س عند مدخل الدائري بسبب كثافة مرورية",
    descEn: "Speed reduced to 65 km/h at ring road due to heavy highway congestion",
    timestamp: "منذ ٨ دقائق",
    resolved: false,
  },
  {
    id: "alt-2",
    type: "utilization",
    severity: "info",
    truckId: "v6",
    titleAr: "شاحنة شاغرة في ساحة الرياض",
    titleEn: "Idle Volvo FM 460 in Riyadh yard",
    descAr: "شاحنة فولفو جاهزة بدون شحنة، يوصي الذكاء الاصطناعي بتكليفها برحلة بريدة",
    descEn: "Volvo unit available for dispatch; AI recommends Buraydah assignment",
    timestamp: "منذ ٢٥ دقيقة",
    resolved: false,
  },
  {
    id: "alt-3",
    type: "doc_expiry",
    severity: "warning",
    truckId: "v4",
    titleAr: "اقتراب انتهاء شهادة الفحص الدوري",
    titleEn: "Periodic inspection permit expiring",
    descAr: "تنتهي شهادة الصهريج خلال ٦ أيام، يرجى التنسيق مع الورشة للتجديد",
    descEn: "ADR Tanker inspection expires in 6 days; schedule renewal with workshop",
    timestamp: "اليوم ٠٨:٠٠ ص",
    resolved: false,
  },
];

// Initial Audit Logs
const INITIAL_LOGS: AuditLog[] = [
  {
    id: "log-1",
    timestamp: "اليوم ١٠:١٥ ص",
    actor: "مدير العمليات",
    actionAr: "تحديث حالة الرحلة EZ-10488 إلى 'وصلت للموقع'",
    actionEn: "Updated trip EZ-10488 status to 'Arrived'",
    tripNumber: "EZ-10488",
    details: "تأكيد وصول الشاحنة IV-660927431 إلى موقع الطائف وبدء التفريغ",
  },
  {
    id: "log-2",
    timestamp: "اليوم ٠٩:٣٠ ص",
    actor: "مشرف التحميل",
    actionAr: "بدء تجهيز وتحميل الرحلة EZ-10487",
    actionEn: "Started loading trip EZ-10487",
    tripNumber: "EZ-10487",
    details: "تحميل ٢٦.٨ طن أسمنت سائب في قلاب مرسيدس أكتروس",
  },
  {
    id: "log-3",
    timestamp: "اليوم ٠٨:٤٥ ص",
    actor: "نظام التتبع الآلي",
    actionAr: "تسجيل قراءة حرارة المبرّد (-18.5°C) للرحلة EZ-10483",
    actionEn: "Logged reefer temperature (-18.5°C) for EZ-10483",
    tripNumber: "EZ-10483",
    details: "قراءة مطابقة للاشتراطات القياسية لهيئة الغذاء والدواء",
  },
];

// Initial Chat Messages
const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    tripId: "trip-1",
    from: "dispatch",
    senderName: "غرفة العمليات المركزية",
    textAr: "صباح الخير فهد، كيف وضع تثبيت الشحنة والرباطات؟",
    textEn: "Morning Fahad, how is the cargo strapping and seal?",
    timestamp: "٠٧:٤٢ ص",
    read: true,
  },
  {
    id: "msg-2",
    tripId: "trip-1",
    from: "driver",
    senderName: "فهد القحطاني",
    textAr: "أهلاً بالعمليات، الحبال والسلاسل مفحوصة والستارة محكمة ومختومة تماماً.",
    textEn: "Hello dispatch, chains checked twice and curtains tightly sealed.",
    timestamp: "٠٧:٥١ ص",
    read: true,
  },
  {
    id: "msg-3",
    tripId: "trip-1",
    from: "dispatch",
    senderName: "غرفة العمليات المركزية",
    textAr: "ممتاز. حافظ على سرعة ٨٥-٩٠ كم/س، أمامك وقت كافٍ قبل موعد الوصول.",
    textEn: "Excellent. Cruise at 85-90 km/h, schedule has comfortable buffer.",
    timestamp: "٠٧:٥٣ ص",
    read: true,
  },
  {
    id: "msg-4",
    tripId: "trip-2",
    from: "driver",
    senderName: "محمد رفيق",
    textAr: "درجة حرارة الصندوق ثابتة على -18.5°C ومستوى الديزل لوحدة التبريد ممتاز.",
    textEn: "Box temp holding steady at -18.5°C, reefer fuel is 95%.",
    timestamp: "٠٨:٣٠ ص",
    read: true,
  },
];

export function FleetStoreProvider({ children }: { children: ReactNode }) {
  // Load from FLEET dataset
  const [trucks, setTrucks] = useState<Vehicle[]>(() => {
    try {
      const saved = localStorage.getItem("ejaz_trucks_store");
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return FLEET;
  });

  useEffect(() => {
    try {
      localStorage.setItem("ejaz_trucks_store", JSON.stringify(trucks));
    } catch (e) {
      console.warn(e);
    }
  }, [trucks]);

  const [trips, setTrips] = useState<Trip[]>(() => {
    try {
      const saved = localStorage.getItem("ejaz_trips_store");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Failed reading trips store", e);
    }
    return INITIAL_TRIPS;
  });

  const [drivers] = useState<Driver[]>(INITIAL_DRIVERS);

  const [alerts, setAlerts] = useState<SmartAlert[]>(() => {
    try {
      const saved = localStorage.getItem("ejaz_alerts_store");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return INITIAL_ALERTS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const saved = localStorage.getItem("ejaz_logs_store");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return INITIAL_LOGS;
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem("ejaz_chat_store");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return INITIAL_MESSAGES;
  });

  const [selectedTripId, setSelectedTripId] = useState<string>(() => trips[0]?.id || "trip-1");
  const [selectedTruckId, setSelectedTruckId] = useState<string>("v1");
  const [currentRole, setCurrentRole] = useState<Role>("admin");
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Synchronize with Authoritative Backend API
  useEffect(() => {
    let isMounted = true;
    async function syncBackendData() {
      try {
        const [tripsRes] = await Promise.all([
          apiClient.trips.getAll(),
        ]);

        if (!isMounted) return;

        if (tripsRes?.trips?.length) {
          const mappedTrips: Trip[] = tripsRes.trips.map((bt: any) => ({
            id: bt.id,
            tripNumber: bt.tripNumber,
            truckId: bt.vehicleId || "v1",
            driverId: bt.driverId || "d1",
            shipper: bt.customerName || "شركة سدافكو للأغذية والمشروبات",
            consignee: bt.deliveryAddress || "ميناء جدة الإسلامي",
            originCity: bt.originCity,
            originTerminal: bt.pickupAddress,
            destinationCity: bt.destinationCity,
            destinationTerminal: bt.deliveryAddress,
            corridorKey: bt.corridorKey || "riyadh-jeddah",
            cargoType: (bt.cargoType === "براد" ? "reefer" : bt.cargoType === "سطحة" ? "flatbed" : bt.cargoType === "جاف" ? "container" : "curtain") as BodyType,
            cargoWeightTons: Number(bt.cargoWeightTons),
            maxCapacityTons: Number(bt.maxCapacityTons || 25),
            status: (bt.status === "IN_TRANSIT" ? "on_road" : bt.status === "DELIVERED" ? "delivered" : bt.status === "COMPLETED" ? "completed" : "ready") as TripStatus,
            progressPct: bt.status === "IN_TRANSIT" ? 48 : (bt.status === "DELIVERED" || bt.status === "COMPLETED" ? 100 : 0),
            speedKmH: Number(bt.currentSpeed || 0),
            headingDeg: Number(bt.currentHeading || 0),
            currentLat: Number(bt.currentLat || 24.7136),
            currentLng: Number(bt.currentLng || 46.6753),
            distanceTotalKm: 948,
            distanceCoveredKm: bt.status === "IN_TRANSIT" ? 417 : 0,
            distanceRemainingKm: bt.status === "IN_TRANSIT" ? 531 : 948,
            etaMinutes: 210,
            nextWaypointAr: "محطة ميزان القويعية",
            nextWaypointEn: "Al Quwayiyah Weighbridge",
            createdAt: bt.createdAt,
            qrCodeToken: `EJAZ-${bt.tripNumber}`,
            timeline: [
              {
                id: `e-init-${bt.id}`,
                timestamp: "مسجلة في الخادم",
                titleAr: `تم إنشاء الرحلة برقم موحد ${bt.tripNumber}`,
                titleEn: `Authoritative Trip Created: ${bt.tripNumber}`,
                status: "ready" as TripStatus,
                actor: "النظام المركزي",
              },
            ],
            // Authoritative server-side properties preserved
            requestedByDriverId: bt.requestedByDriverId,
            requestedByDriverName: bt.requestedByDriverName,
            driverRequestStatus: bt.driverRequestStatus,
            driverRequestNotes: bt.driverRequestNotes,
            driverHistory: bt.driverHistory,
            vehicleHistory: bt.vehicleHistory,
            additionalDriverId: bt.additionalDriverId,
            additionalDriverName: bt.additionalDriverName,
          }));

          setTrips(mappedTrips);
        }
      } catch (err) {
        console.warn("[FleetStore] Operating with baseline data cache", err);
      }
    }

    syncBackendData();
    const syncTimer = setInterval(syncBackendData, 4000);
    return () => {
      isMounted = false;
      clearInterval(syncTimer);
    };
  }, []);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("ejaz_trips_store", JSON.stringify(trips));
    } catch (e) {
      console.warn(e);
    }
  }, [trips]);

  useEffect(() => {
    try {
      localStorage.setItem("ejaz_alerts_store", JSON.stringify(alerts));
    } catch (e) {
      console.warn(e);
    }
  }, [alerts]);

  useEffect(() => {
    try {
      localStorage.setItem("ejaz_logs_store", JSON.stringify(auditLogs));
    } catch (e) {
      console.warn(e);
    }
  }, [auditLogs]);

  useEffect(() => {
    try {
      localStorage.setItem("ejaz_chat_store", JSON.stringify(chatMessages));
    } catch (e) {
      console.warn(e);
    }
  }, [chatMessages]);

  // LIVE GPS & SIMULATION ENGINE
  // Every 2 seconds, active trips advance realistically along real Saudi coordinates
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setTrips((prevTrips) =>
        prevTrips.map((trip) => {
          if (trip.status !== "on_road") return trip;

          // Advance progress slightly
          const nextProgress = Math.min(99.5, trip.progressPct + 0.12);
          const interp = interpolateRoute(trip.corridorKey, nextProgress);

          return {
            ...trip,
            progressPct: Number(nextProgress.toFixed(2)),
            currentLat: interp.lat,
            currentLng: interp.lng,
            headingDeg: interp.heading,
            speedKmH: interp.speed,
            distanceCoveredKm: interp.distanceCoveredKm,
            distanceRemainingKm: interp.distanceRemainingKm,
            etaMinutes: interp.etaMinutes,
            nextWaypointAr: interp.nextWaypoint || trip.nextWaypointAr,
          };
        })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, [isSimulating]);

  // Record audit log helper
  const recordAuditLog = (
    actionAr: string,
    actionEn: string,
    tripNumber?: string,
    details?: string
  ) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
      actor:
        currentRole === "admin"
          ? "مدير العمليات"
          : currentRole === "driver"
          ? "السائق"
          : currentRole === "shipper"
          ? "العميل / الشاحن"
          : "مالك الأسطول",
      actionAr,
      actionEn,
      tripNumber,
      details: details || "",
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Actions
  const updateTripStatus = (
    tripId: string,
    newStatus: TripStatus,
    noteAr?: string,
    noteEn?: string,
    signature?: string
  ) => {
    setTrips((prev) =>
      prev.map((t) => {
        if (t.id !== tripId) return t;

        const timeStr = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
        const actorName =
          currentRole === "driver"
            ? "السائق"
            : currentRole === "shipper"
            ? "العميل المستلم"
            : "غرفة العمليات";

        const newEvent: TimelineEvent = {
          id: `e-${Date.now()}`,
          timestamp: timeStr,
          titleAr: noteAr || `تحديث حالة الرحلة إلى ${newStatus}`,
          titleEn: noteEn || `Trip status updated to ${newStatus}`,
          status: newStatus,
          actor: actorName,
        };

        const updated: Trip = {
          ...t,
          status: newStatus,
          timeline: [...t.timeline, newEvent],
          recipientSignature: signature || t.recipientSignature,
          deliveryTime: newStatus === "delivered" || newStatus === "completed" ? timeStr : t.deliveryTime,
        };

        return updated;
      })
    );

    recordAuditLog(
      `تحديث حالة الرحلة ${tripId} إلى ${newStatus}`,
      `Updated trip ${tripId} status to ${newStatus}`,
      tripId,
      noteAr
    );

    // Map UI status to Canonical Backend State
    const CANONICAL_MAP: Record<TripStatus, string> = {
      new: "DRAFT_CREATED",
      planning: "PENDING_APPROVAL",
      ready: "CONFIRMED",
      loading: "ARRIVED_LOADING",
      on_road: "IN_TRANSIT",
      stopped: "IN_TRANSIT",
      arrived: "ARRIVED_DESTINATION",
      delivered: "DELIVERED",
      completed: "COMPLETED",
      cancelled: "CANCELLED",
    };

    const targetCanonical = CANONICAL_MAP[newStatus];
    if (targetCanonical) {
      apiClient.trips
        .transition(tripId, {
          targetStatus: targetCanonical,
          notes: noteAr,
          reason: noteAr,
        })
        .catch((err) => {
          console.warn("[FleetStore] Backend transition sync:", err);
        });

      // If delivered and signature present, record authoritative POD
      if (newStatus === "delivered" && signature) {
        apiClient.pod
          .create({
            tripId,
            recipientName: "العميل المستلم",
            signatureUrl: signature,
            notes: noteAr || "تم الاستلام والتوقيع عبر التطبيق",
          })
          .catch((e) => console.warn("[FleetStore] POD sync:", e));
      }
    }
  };

  const updateCargoWeight = (tripId: string, tons: number) => {
    setTrips((prev) =>
      prev.map((t) => (t.id === tripId ? { ...t, cargoWeightTons: Number(tons.toFixed(1)) } : t))
    );
  };

  const assignDriverAndTruck = (tripId: string, driverId: string, truckId: string) => {
    setTrips((prev) =>
      prev.map((t) => (t.id === tripId ? { ...t, driverId, truckId } : t))
    );
    recordAuditLog("تعيين سائق وشاحنة للرحلة", "Assigned driver and truck", tripId);
  };

  const createNewTrip = (tripData: Partial<Trip>): Trip => {
    const year = new Date().getFullYear();
    const tempNum = `EJ-${year}-${Math.floor(100000 + Math.random() * 900000)}`;
    const tripId = `trip-${Date.now()}`;
    const newTrip: Trip = {
      id: tripId,
      tripNumber: tempNum,
      truckId: tripData.truckId || "v1",
      driverId: tripData.driverId || "d1",
      shipper: tripData.shipper || "شركة سدافكو للأغذية",
      consignee: tripData.consignee || "مستودع الوجهة المركزي",
      originCity: tripData.originCity || "الرياض",
      originTerminal: tripData.originTerminal || "الرياض - الميناء الجاف",
      destinationCity: tripData.destinationCity || "جدة",
      destinationTerminal: tripData.destinationTerminal || "جدة - الميناء الإسلامي",
      corridorKey: tripData.corridorKey || "riyadh-jeddah",
      cargoType: tripData.cargoType || "curtain",
      cargoWeightTons: tripData.cargoWeightTons || 20,
      maxCapacityTons: tripData.maxCapacityTons || 25,
      status: "ready",
      progressPct: 0,
      speedKmH: 0,
      headingDeg: 250,
      currentLat: 24.7136,
      currentLng: 46.6753,
      distanceTotalKm: 948,
      distanceCoveredKm: 0,
      distanceRemainingKm: 948,
      etaMinutes: 630,
      nextWaypointAr: "محطة ميزان القويعية",
      nextWaypointEn: "Al Quwayiyah Weighbridge",
      createdAt: "الآن",
      qrCodeToken: `EJAZ-${tempNum}`,
      timeline: [
        {
          id: `e-${Date.now()}`,
          timestamp: "الآن",
          titleAr: "إنشاء الرحلة وحجز الشاحنة بالخادم",
          titleEn: "Trip order created and truck reserved",
          status: "ready",
          actor: "غرفة العمليات",
        },
      ],
      ...tripData,
    };

    setTrips((prev) => [newTrip, ...prev]);

    // Send asynchronous request to backend to persist with official trip sequence
    apiClient.trips
      .create({
        originCity: newTrip.originCity,
        destinationCity: newTrip.destinationCity,
        pickupAddress: newTrip.originTerminal,
        deliveryAddress: newTrip.destinationTerminal,
        cargoDescription: `شحنة ${newTrip.cargoType} حمولة ${newTrip.cargoWeightTons} طن`,
        cargoType:
          newTrip.cargoType === "reefer"
            ? "براد"
            : newTrip.cargoType === "flatbed"
            ? "سطحة"
            : newTrip.cargoType === "container"
            ? "جاف"
            : "ستارة",
        cargoWeightTons: newTrip.cargoWeightTons,
        maxCapacityTons: newTrip.maxCapacityTons,
        corridorKey: newTrip.corridorKey,
        vehicleId: newTrip.truckId,
        driverId: newTrip.driverId,
      })
      .then((res) => {
        if (res?.trip?.tripNumber) {
          setTrips((prev) =>
            prev.map((t) =>
              t.id === tripId
                ? {
                    ...t,
                    tripNumber: res.trip.tripNumber,
                    id: res.trip.id,
                  }
                : t
            )
          );
        }
      })
      .catch((err) => {
        console.warn("[FleetStore] Trip created locally, pending backend sync:", err);
      });

    recordAuditLog(`إنشاء رحلة شحن جديدة ${tempNum}`, `Created new freight trip ${tempNum}`, tempNum);
    return newTrip;
  };

  const resolveAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, resolved: true } : a))
    );
  };

  const sendChatMessage = (tripId: string, text: string) => {
    const timeStr = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      tripId,
      from: currentRole === "driver" ? "driver" : currentRole === "shipper" ? "shipper" : "dispatch",
      senderName:
        currentRole === "driver"
          ? "السائق فهد القحطاني"
          : currentRole === "shipper"
          ? "العميل (شركة سدافكو)"
          : "غرفة العمليات المركزية",
      textAr: text,
      textEn: text,
      timestamp: timeStr,
      read: true,
    };

    setChatMessages((prev) => [...prev, userMsg]);

    // Simulated instant smart AI / dispatch reply after 1.5 seconds
    setTimeout(() => {
      const replyRepliesAr = [
        "علم وجاري المتابعة، تم تأكيد البيانات مع السائق فوراً.",
        "تم فحص مستشعرات GPS والحرارة، القراءات كلها سليمة ومطابقة.",
        "الشاحنة تسير بسرعة ٨٦ كم/س والوصول المتوقع في وقته المحدد.",
        "تم إرسال بوليصة الشحن الإلكترونية المحدثة إلى بريدكم.",
      ];
      const replyRepliesEn = [
        "Roger that, verified with driver immediately.",
        "Telemetry and thermal sensors checked; all parameters nominal.",
        "Truck cruising at 86 km/h, on track for scheduled ETA.",
        "Updated electronic waybill dispatched to your terminal.",
      ];
      const randIdx = Math.floor(Math.random() * replyRepliesAr.length);

      const botReply: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        tripId,
        from: currentRole === "driver" ? "dispatch" : "driver",
        senderName: currentRole === "driver" ? "غرفة العمليات المركزية" : "السائق (الميدان)",
        textAr: replyRepliesAr[randIdx],
        textEn: replyRepliesEn[randIdx],
        timestamp: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
        read: false,
      };
      setChatMessages((prev) => [...prev, botReply]);
    }, 1400);
  };

  const resetAllDemoData = () => {
    localStorage.removeItem("ejaz_trucks_store");
    localStorage.removeItem("ejaz_trips_store");
    localStorage.removeItem("ejaz_alerts_store");
    localStorage.removeItem("ejaz_logs_store");
    localStorage.removeItem("ejaz_chat_store");
    setTrucks(FLEET);
    setTrips(INITIAL_TRIPS);
    setAlerts(INITIAL_ALERTS);
    setAuditLogs(INITIAL_LOGS);
    setChatMessages(INITIAL_MESSAGES);
    setSelectedTripId(INITIAL_TRIPS[0].id);
  };

  const selectedTrip = useMemo(
    () => trips.find((t) => t.id === selectedTripId) || trips[0],
    [trips, selectedTripId]
  );

  const selectedTruck = useMemo(
    () => trucks.find((t) => t.id === selectedTruckId) || trucks[0] || ({} as Vehicle),
    [trucks, selectedTruckId]
  );

  return (
    <FleetStoreContext.Provider
      value={{
        trucks,
        trips,
        drivers,
        alerts,
        auditLogs,
        chatMessages,
        selectedTripId,
        selectedTruckId,
        currentRole,
        isSimulating,
        searchQuery,
        selectedTrip,
        selectedTruck,
        selectTrip: setSelectedTripId,
        selectTruck: setSelectedTruckId,
        setRole: setCurrentRole,
        setSearchQuery,
        toggleSimulation: () => setIsSimulating((v) => !v),
        updateTripStatus,
        updateCargoWeight,
        assignDriverAndTruck,
        createNewTrip,
        resolveAlert,
        sendChatMessage,
        recordAuditLog,
        resetAllDemoData,
      }}
    >
      {children}
    </FleetStoreContext.Provider>
  );
}

export function useFleetStore() {
  const context = useContext(FleetStoreContext);
  if (!context) {
    throw new Error("useFleetStore must be used within FleetStoreProvider");
  }
  return context;
}
