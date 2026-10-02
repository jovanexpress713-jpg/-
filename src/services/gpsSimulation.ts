export interface GPSCoordinate {
  lat: number;
  lng: number;
  name?: string;
  speedLimit?: number;
}

export interface HighwayCorridor {
  id: string;
  nameAr: string;
  nameEn: string;
  highwayNumber: string;
  totalDistanceKm: number;
  points: [number, number][]; // [lat, lng]
  waypoints: {
    nameAr: string;
    nameEn: string;
    lat: number;
    lng: number;
    type: "terminal" | "toll" | "rest" | "weighbridge" | "customs";
  }[];
}

/** Real coordinates along Saudi Arabia's major heavy freight arteries */
export const SAUDI_CORRIDORS: Record<string, HighwayCorridor> = {
  // Highway 40: Riyadh -> Taif -> Makkah -> Jeddah
  "riyadh-jeddah": {
    id: "riyadh-jeddah",
    nameAr: "طريق الرياض - مكة المكرمة - جدة السريع",
    nameEn: "Highway 40: Riyadh - Taif - Jeddah",
    highwayNumber: "40",
    totalDistanceKm: 948,
    points: [
      [24.7136, 46.6753], // Riyadh DC Gate 3
      [24.5822, 46.4109], // Riyadh West Exit
      [24.4601, 45.8912], // Muzahmiyya
      [24.3211, 45.3104], // Al Quwayiyah
      [23.9512, 44.3812], // Ruwaydah
      [23.7011, 43.6214], // Halban
      [23.3102, 42.8105], // Al Khasrah
      [22.8415, 41.7302], // Zalim Rest Station
      [22.2514, 41.0112], // Radwan Checkpoint
      [21.6501, 40.5211], // Al Sail Al Kabeer
      [21.4312, 39.9501], // Makkah Bypass
      [21.5204, 39.4211], // Bahrah Industrial
      [21.4858, 39.1925], // Jeddah Port Terminal
    ],
    waypoints: [
      { nameAr: "مستودع الرياض المركزي", nameEn: "Riyadh Central DC", lat: 24.7136, lng: 46.6753, type: "terminal" },
      { nameAr: "محطة ميزان القويعية", nameEn: "Al Quwayiyah Weighbridge", lat: 24.3211, lng: 45.3104, type: "weighbridge" },
      { nameAr: "استراحة واستراحة ظلم", nameEn: "Zalim Oasis Rest Stop", lat: 22.8415, lng: 41.7302, type: "rest" },
      { nameAr: "نقطة تفتيش السيل الكبير", nameEn: "Al Sail Inspection", lat: 21.6501, lng: 40.5211, type: "toll" },
      { nameAr: "ميناء جدة الإسلامي - رصيف ٧", nameEn: "Jeddah Islamic Port - Berth 7", lat: 21.4858, lng: 39.1925, type: "terminal" },
    ],
  },

  // Highway 80: Dammam -> Hofuf -> Riyadh
  "dammam-riyadh": {
    id: "dammam-riyadh",
    nameAr: "طريق الدمام - الرياض السريع",
    nameEn: "Highway 80: Dammam - Riyadh Express",
    highwayNumber: "80",
    totalDistanceKm: 395,
    points: [
      [26.4207, 50.0888], // Dammam Logistics Zone
      [26.2811, 49.9102], // Dhahran Junction
      [25.9214, 49.3811], // Buqayq Oil Terminal
      [25.3833, 49.5833], // Hofuf Cold Hub
      [25.1205, 48.7214], // Khurais Junction
      [24.9102, 47.7812], // Saada Checkpoint
      [24.8105, 47.1211], // Thumamah Junction
      [24.7136, 46.6753], // Riyadh Dry Port
    ],
    waypoints: [
      { nameAr: "منطقة الدمام اللوجستية", nameEn: "Dammam Freight Terminal", lat: 26.4207, lng: 50.0888, type: "terminal" },
      { nameAr: "محطة تبريد الهفوف", nameEn: "Hofuf Cold Storage Hub", lat: 25.3833, lng: 49.5833, type: "rest" },
      { nameAr: "ميزان شاحنات سعد", nameEn: "Saad Truck Weighbridge", lat: 24.9102, lng: 47.7812, type: "weighbridge" },
      { nameAr: "الميناء الجاف بالرياض", nameEn: "Riyadh Dry Port Terminal", lat: 24.7136, lng: 46.6753, type: "terminal" },
    ],
  },

  // Highway 15: Jeddah -> Rabigh -> Madinah
  "jeddah-madinah": {
    id: "jeddah-madinah",
    nameAr: "طريق الهجرة السريع: جدة - المدينة المنورة",
    nameEn: "Highway 15: Jeddah - Madinah Expressway",
    highwayNumber: "15",
    totalDistanceKm: 420,
    points: [
      [21.4858, 39.1925], // Jeddah North DC
      [21.8412, 39.1102], // Dhahban Junction
      [22.3811, 39.0912], // Thuwal Industrial Valley
      [22.7812, 39.0211], // Rabigh Petrochemical
      [23.2104, 39.2105], // Masturah
      [23.7812, 39.4102], // Al Suwayq
      [24.1205, 39.5211], // Abyar Ali Checkpoint
      [24.5247, 39.6125], // Madinah ICD Terminal
    ],
    waypoints: [
      { nameAr: "محطة جدة للشحن البحري", nameEn: "Jeddah Port RSGT Gate", lat: 21.4858, lng: 39.1925, type: "terminal" },
      { nameAr: "مجمع بترو رابغ", nameEn: "Rabigh Industrial Park", lat: 22.7812, lng: 39.0211, type: "rest" },
      { nameAr: "ميزان أبيار علي", nameEn: "Abyar Ali Axle Weighbridge", lat: 24.1205, lng: 39.5211, type: "weighbridge" },
      { nameAr: "المدينة المنورة - مركز التوزيع", nameEn: "Madinah Logistics Center", lat: 24.5247, lng: 39.6125, type: "terminal" },
    ],
  },

  // Highway 85/80: Jubail -> Riyadh
  "jubail-riyadh": {
    id: "jubail-riyadh",
    nameAr: "طريق الجبيل الصناعية - الرياض",
    nameEn: "Jubail Industrial - Riyadh Hazmat Line",
    highwayNumber: "85",
    totalDistanceKm: 470,
    points: [
      [27.0046, 50.1029], // Jubail SABIC Facility
      [26.8105, 49.8214], // Abu Hadriyah Junction
      [26.4207, 49.2105], // Nariyah Junction
      [25.8211, 48.4211], // Rumah Expressway
      [25.1204, 47.6102], // Riyadh NE Ring
      [24.7136, 46.6753], // Riyadh Chemical Depot
    ],
    waypoints: [
      { nameAr: "مجمع سابك البتروكيماوي بالجبيل", nameEn: "SABIC Chemical Hub Jubail", lat: 27.0046, lng: 50.1029, type: "terminal" },
      { nameAr: "نقطة فحص صهاريج ADR", nameEn: "ADR Hazmat Inspection Gate", lat: 26.8105, lng: 49.8214, type: "weighbridge" },
      { nameAr: "استراحة رماح للشاحنات", nameEn: "Rumah Heavy Fleet Stop", lat: 25.8211, lng: 48.4211, type: "rest" },
      { nameAr: "مستودع الكيماويات - جنوب الرياض", nameEn: "Riyadh Hazmat Terminal", lat: 24.7136, lng: 46.6753, type: "terminal" },
    ],
  },

  // Northern Corridor: Riyadh -> Hail -> Tabuk -> NEOM
  "riyadh-neom": {
    id: "riyadh-neom",
    nameAr: "الممر الشمالي: الرياض - حائل - تبوك - نيوم",
    nameEn: "Highway 65/80: Riyadh - Hail - NEOM",
    highwayNumber: "65",
    totalDistanceKm: 1380,
    points: [
      [24.7136, 46.6753], // Riyadh
      [25.5102, 45.4211], // Majmaah
      [26.3283, 43.9667], // Buraydah / Qassim
      [27.5167, 41.7000], // Hail Hub
      [28.0211, 39.5102], // Tayma
      [28.3835, 36.5667], // Tabuk Freight Depot
      [28.1204, 35.8102], // Sharma Junction
      [28.0000, 35.4000], // NEOM Gate 9
    ],
    waypoints: [
      { nameAr: "ساحة تحميل الرياض", nameEn: "Riyadh Mega Depot", lat: 24.7136, lng: 46.6753, type: "terminal" },
      { nameAr: "مستودع القصيم الإقليمي", nameEn: "Qassim Regional Hub", lat: 26.3283, lng: 43.9667, type: "rest" },
      { nameAr: "مركز صيانة حائل", nameEn: "Hail Fleet Workshop", lat: 27.5167, lng: 41.7000, type: "weighbridge" },
      { nameAr: "محطة تفريغ نيوم - البوابة ٩", nameEn: "NEOM Logistics Site Gate 9", lat: 28.0000, lng: 35.4000, type: "terminal" },
    ],
  },
};

/** Precise Haversine distance in kilometers */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Bearing angle in degrees (0 = North, 90 = East, 180 = South, 270 = West) */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * High-precision path interpolation for live truck position, speed, and heading
 */
export function interpolateRoute(
  corridorKey: string,
  progressPct: number // 0 to 100
): {
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  currentSegment: number;
  nextWaypoint?: string;
  distanceCoveredKm: number;
  distanceRemainingKm: number;
  etaMinutes: number;
} {
  const corridor = SAUDI_CORRIDORS[corridorKey] || SAUDI_CORRIDORS["riyadh-jeddah"];
  const points = corridor.points;
  const totalKm = corridor.totalDistanceKm;

  const t = Math.max(0.001, Math.min(0.999, progressPct / 100));

  // Compute segment lengths
  const segLengths: number[] = [];
  let pathTotal = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const d = calculateDistanceKm(
      points[i][0],
      points[i][1],
      points[i + 1][0],
      points[i + 1][1]
    );
    segLengths.push(d);
    pathTotal += d;
  }

  let targetDist = t * pathTotal;
  let lat = points[0][0];
  let lng = points[0][1];
  let heading = 90;
  let segIdx = 0;

  for (let i = 0; i < segLengths.length; i++) {
    if (targetDist <= segLengths[i] || i === segLengths.length - 1) {
      const segRatio = Math.max(0, Math.min(1, targetDist / segLengths[i]));
      const p1 = points[i];
      const p2 = points[i + 1];
      lat = p1[0] + (p2[0] - p1[0]) * segRatio;
      lng = p1[1] + (p2[1] - p1[1]) * segRatio;
      heading = calculateBearing(p1[0], p1[1], p2[0], p2[1]);
      segIdx = i;
      break;
    }
    targetDist -= segLengths[i];
  }

  // Realistic highway speed calculation with micro-variations
  const baseSpeed = segIdx === 0 || segIdx === points.length - 2 ? 45 : 86;
  const jitter = Math.sin(t * 120) * 4.2 + Math.cos(t * 45) * 2.1;
  const speed = Math.max(0, Math.round(baseSpeed + jitter));

  const distanceCoveredKm = Math.round(t * totalKm);
  const distanceRemainingKm = Math.max(0, totalKm - distanceCoveredKm);
  const avgSpeed = Math.max(50, speed);
  const etaMinutes = Math.round((distanceRemainingKm / avgSpeed) * 60);

  // Find next waypoint
  let nextWp = corridor.waypoints[corridor.waypoints.length - 1].nameAr;
  for (const wp of corridor.waypoints) {
    const wpDist = calculateDistanceKm(points[0][0], points[0][1], wp.lat, wp.lng);
    if (wpDist > distanceCoveredKm) {
      nextWp = wp.nameAr;
      break;
    }
  }

  return {
    lat,
    lng,
    heading: Math.round(heading),
    speed,
    currentSegment: segIdx,
    nextWaypoint: nextWp,
    distanceCoveredKm,
    distanceRemainingKm,
    etaMinutes,
  };
}
