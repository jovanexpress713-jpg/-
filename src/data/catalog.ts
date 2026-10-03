import type { BodyType, Brand } from "./types";

export const COMPANY = {
  name: "EJAZ",
  nameAr: "مؤسسة إيجاز للنقليات",
  nameEn: "Establishment Ejaz Transport",
  tagline: "Since 2022",
};

export const BRANDS: { id: Brand; prefix: string; models: string[] }[] = [
  {
    id: "Mercedes-Benz",
    prefix: "MB",
    models: ["Actros L 1863", "Actros 2551", "Actros F"],
  },
  { id: "Volvo", prefix: "VL", models: ["FH16 750", "FH Aero", "FM 460"] },
  { id: "Scania", prefix: "SC", models: ["R 500", "S 590"] },
  { id: "MAN", prefix: "MN", models: ["TGX 18.510"] },
  { id: "DAF", prefix: "DF", models: ["XF 480"] },
  { id: "Iveco", prefix: "IV", models: ["S-Way 570"] },
];

export const BODY_TYPES: {
  id: BodyType;
  label: [string, string];
  note: [string, string];
}[] = [
  { id: "flatbed", label: ["Flatbed", "سطحة"], note: ["Heavy steel & equipment", "حديد ثقيل ومعدات"] },
  { id: "reefer", label: ["Reefer", "براد"], note: ["Temperature controlled cold-chain", "سلسلة التبريد وضبط الحرارة"] },
  { id: "dry", label: ["Dry", "جاف"], note: ["Enclosed dry merchandise", "بضائع جافة ومغلقة"] },
  { id: "curtain", label: ["Curtainsider", "ستارة"], note: ["Palletised fast loading", "بضائع عامة وباليتات"] },
];

export const PARTNERS = [
  "Al Rajhi Logistics",
  "SADAFCO Cold Chain",
  "Saudi Aramco Fuel",
  "Red Sea Gateway",
  "Almarai",
  "Al Ittan Steel",
  "Saudi Binladin Group",
  "Aljomaih Bottling",
  "Yamama Cement",
  "Ma'aden",
  "Al Rabie Foods",
  "SABIC",
];

/** Grey monochrome studio renders (pure black plates, blended with `lighten`). */
export const TRUCK_IMAGES: Record<string, string> = {
  "mb-curtain": "images/trucks/mb-curtain.jpg",
  "mb-reefer": "images/trucks/mb-reefer.jpg",
  "volvo-tanker": "images/trucks/volvo-tanker.jpg",
  "volvo-container": "images/trucks/volvo-container.jpg",
  "scania-flatbed": "images/trucks/scania-flatbed.jpg",
  "scania-tipper": "images/trucks/scania-tipper.jpg",
};

export const AERIAL_NIGHT = "images/trucks/aerial-night.jpg";

export function imageFor(_brand: Brand, body: BodyType): string {
  if (body === "reefer") return TRUCK_IMAGES["mb-reefer"];
  if (body === "flatbed") return TRUCK_IMAGES["scania-flatbed"];
  if (body === "dry") return TRUCK_IMAGES["volvo-container"];
  return TRUCK_IMAGES["mb-curtain"];
}

export const STATUS_LABEL: Record<string, [string, string]> = {
  active: ["On Route", "على الطريق"],
  waiting: ["Waiting", "في الانتظار"],
  inactive: ["Inactive", "متوقفة"],
};

export function docsFor(body: BodyType): string[] {
  const base = ["Bill of Lading", "Commercial Invoice", "Cargo Insurance"];
  if (body === "reefer") return [...base, "Temperature Log"];
  if (body === "dry") return [...base, "Container Manifest"];
  return base;
}

const PX = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=800`;

export const PHOTO_REPORTS: { src: string; en: string; ar: string }[] = [
  { src: PX(29786116), en: "Curtain-side loading · Riyadh DC", ar: "تحميل ستائر جانبية · مستودع الرياض" },
  { src: PX(6169668), en: "Pre-cool check · Dammam Plant", ar: "فحص التبريد · مصنع الدمام" },
  { src: PX(6169660), en: "Palletised cargo · Bay 4", ar: "شحن منصّد · الرصيف ٤" },
  { src: PX(1267327), en: "Night unloading · Jeddah Terminal", ar: "تفريغ ليلي · محطة جدة" },
  { src: PX(5876475), en: "Bay allocation · Red Sea Gateway", ar: "توزيع الرصيف · البوابة البحرية" },
  { src: PX(7267443), en: "Flatbed secured · Mill yard", ar: "تثبيت المسطّحة · ساحة المصنع" },
];
