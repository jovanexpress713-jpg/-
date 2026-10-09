import { useState, useMemo } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { BODY_TYPES, BRANDS, PARTNERS, docsFor } from "../data/catalog";
import type { BodyType, Brand, RequestKind, Vehicle } from "../data/types";
import {
  IconClose,
  IconTruck,
  IconCargo,
  IconRepair,
  IconDriver,
  IconReport,
  IconCheck,
  IconPin,
  IconBolt,
  IconDownload,
} from "./Icons";
import { TruckTypeIcon, TruckTypeAvatar } from "./TruckTypeIcon";
import { getVehicleTypeMeta } from "../data/vehicleTypes";
import { useFleetStore } from "../state/fleetStore";
import { useToast } from "./Toast";

export const DRIVER_POOL = [
  { id: "dp-1", name: "فهد الشمري (كابتن أسطول)", phone: "+966 55 123 4567", initials: "فش", rating: 4.95, trips: 212 },
  { id: "dp-2", name: "سالم المري (كابتن تبريد)", phone: "+966 55 234 5678", initials: "سم", rating: 4.98, trips: 184 },
  { id: "dp-3", name: "ماجد البلوي (كابتن ثقيل)", phone: "+966 55 345 6789", initials: "مب", rating: 4.88, trips: 142 },
  { id: "dp-4", name: "عبدالله الدوسري (كابتن مسار)", phone: "+966 55 456 7890", initials: "عد", rating: 4.92, trips: 198 },
  { id: "dp-5", name: "يوسف العتيبي (كابتن مساند)", phone: "+966 55 567 8901", initials: "يع", rating: 4.91, trips: 167 },
];

const HP: Record<Brand, number> = {
  "Mercedes-Benz": 510,
  Volvo: 500,
  Scania: 500,
  MAN: 510,
  DAF: 480,
  Iveco: 570,
};

const SAUDI_CITIES = [
  "الرياض",
  "جدة",
  "الدمام",
  "الخرج",
  "الجبيل",
  "القصيم (بريدة)",
  "المدينة المنورة",
  "مكة المكرمة",
  "أبها",
  "حائل",
  "ينبع",
  "تبوك",
  "جازان",
];

interface Props {
  initialKind: RequestKind;
  onClose: () => void;
  onCreate: (v: Vehicle, kind: RequestKind) => void;
}

export function CreateRequest({ initialKind, onClose, onCreate }: Props) {
  const { t } = useSettings();
  const toast = useToast();
  const { trucks, addVehicle, updateVehicle } = useFleetStore();
  const [kind, setKind] = useState<RequestKind>(initialKind);

  // =========================================================================
  // 1. STATE FOR: TRUCK REQUEST (طلب شاحنة للأسطول)
  // =========================================================================
  const [truckBrand, setTruckBrand] = useState<Brand>("Mercedes-Benz");
  const [truckModel, setTruckModel] = useState(BRANDS[0].models[0]);
  const [truckYear, setTruckYear] = useState(2024);
  const [truckBody, setTruckBody] = useState<BodyType>("curtain");
  const [truckCab, setTruckCab] = useState("GigaSpace Cab");
  const [truckPurpose, setTruckPurpose] = useState<"fleet_expansion" | "route_replacement" | "seasonal_lease">("fleet_expansion");
  const [truckMaxLoad, setTruckMaxLoad] = useState(26);
  const [truckPlate, setTruckPlate] = useState(`أ ب ج ${Math.floor(1000 + Math.random() * 8999)}`);
  const [truckYard, setTruckYard] = useState("ساحة إيجاز المركزية — الرياض (السلي)");
  const [truckDriverId, setTruckDriverId] = useState<string>("dp-1");
  const [truckFeatures, setTruckFeatures] = useState<{ [key: string]: boolean }>({
    gpsGsm: true,
    axleWeighing: true,
    tempSensors: false,
    longHaulTires: true,
    fireSafety: true,
  });

  // =========================================================================
  // 2. STATE FOR: CARGO REQUEST (طلب شحن بضائع)
  // =========================================================================
  const [cargoCategory, setCargoCategory] = useState<string>("food_cold");
  const [cargoBody, setCargoBody] = useState<BodyType>("reefer");
  const [cargoTargetTemp, setCargoTargetTemp] = useState<number>(-18);
  const [cargoPartner, setCargoPartner] = useState(PARTNERS[1] || "SADAFCO Cold Chain");
  const [cargoOriginCity, setCargoOriginCity] = useState("الرياض");
  const [cargoPickupAddress, setCargoPickupAddress] = useState("مستودع السلي بوابة ٤");
  const [cargoPickupContact, setCargoPickupContact] = useState("م. ناصر الشهري · ٠٥٠١١٢٢٣٣٤");
  const [cargoDestCity, setCargoDestCity] = useState("جدة");
  const [cargoDeliveryAddress, setCargoDeliveryAddress] = useState("ميناء جدة الإسلامي — رصيف ٧");
  const [cargoDeliveryContact, setCargoDeliveryContact] = useState("خالد السبيعي · ٠٥٥٤٤٣٣٢٢١");
  const [cargoWeightTons, setCargoWeightTons] = useState<number>(21.5);
  const [cargoPallets, setCargoPallets] = useState<number>(24);
  const [cargoReadyDate, setCargoReadyDate] = useState("اليوم · خلال ساعتين");
  const [cargoPriority, setCargoPriority] = useState<"standard" | "express" | "super_urgent">("express");
  const [cargoHazmat, setCargoHazmat] = useState(false);
  const [cargoForklift, setCargoForklift] = useState(true);
  const [cargoNotes, setCargoNotes] = useState("بضائع غذائية مجمدة، يشترط تشغيل جهاز التبريد المسبق وضبط الحرارة على -١٨ مئوية.");

  // =========================================================================
  // 3. STATE FOR: REPAIR REQUEST (طلب صيانة وورشة)
  // =========================================================================
  const [repairTruckId, setRepairTruckId] = useState<string>(trucks[0]?.id || "v1");
  const [repairOdometer, setRepairOdometer] = useState<number>(342800);
  const [repairType, setRepairType] = useState<"routine" | "tires_brakes" | "engine" | "reefer_unit" | "electrical" | "roadside">("reefer_unit");
  const [repairPriority, setRepairPriority] = useState<"critical" | "urgent" | "normal">("critical");
  const [repairLocationType, setRepairLocationType] = useState<"workshop" | "roadside">("workshop");
  const [repairWorkshop, setRepairWorkshop] = useState("ورشة إيجاز المركزية (الرياض - مخرج ١٨)");
  const [repairRoadsideDesc, setRepairRoadsideDesc] = useState("طريق الرياض - الدمام السريع كم ١٢٠ محطة ساسكو");
  const [repairDescription, setRepairDescription] = useState("ارتفاع حرارة وحدة التبريد من -١٨ إلى -٨ مع صدور صوت صفير في سير الكمبروسر.");
  const [repairNeedReplacement, setRepairNeedReplacement] = useState(true);

  // =========================================================================
  // 4. STATE FOR: DRIVER REQUEST (طلب سائق وتكليف مهمة)
  // =========================================================================
  const [driverMissionType, setDriverMissionType] = useState<"primary" | "co_driver" | "relief" | "new_onboard">("co_driver");
  const [driverTruckId, setDriverTruckId] = useState<string>(trucks[0]?.id || "v1");
  const [driverCorridor, setDriverCorridor] = useState("الرياض ↔ جدة (المسار السريع — ٩٥٠ كم)");
  const [driverCandidateMode, setDriverCandidateMode] = useState<"pool" | "manual">("pool");
  const [driverSelectedPoolId, setDriverSelectedPoolId] = useState("dp-2");
  const [driverManualName, setDriverManualName] = useState("عبدالله سالم الدوسري");
  const [driverManualPhone, setDriverManualPhone] = useState("+966 55 982 3344");
  const [driverManualLicense, setDriverManualLicense] = useState("DL-SA-901823");
  const [driverDurationDays, setDriverDurationDays] = useState(5);
  const [driverAllowanceSar, setDriverAllowanceSar] = useState(750);
  const [driverReqTgaCard, setDriverReqTgaCard] = useState(true);
  const [driverReqHazmat, setDriverReqHazmat] = useState(false);
  const [driverReqMedical, setDriverReqMedical] = useState(true);

  // =========================================================================
  // 5. STATE FOR: REPORT REQUEST (طلب تقرير رسمي)
  // =========================================================================
  const [reportType, setReportType] = useState<"axle_weight" | "cold_chain" | "fuel_telemetry" | "driver_sla" | "client_billing" | "incident_claim">("cold_chain");
  const [reportScope, setReportScope] = useState<"all" | "truck" | "partner">("truck");
  const [reportTruckId, setReportTruckId] = useState<string>(trucks[0]?.id || "v1");
  const [reportPartner, setReportPartner] = useState<string>(PARTNERS[0]);
  const [reportDateRange, setReportDateRange] = useState<"today" | "7d" | "30d" | "quarter">("7d");
  const [reportFormat, setReportFormat] = useState<"pdf" | "excel" | "csv">("pdf");
  const [reportOfficialSeal, setReportOfficialSeal] = useState(true);
  const [reportSendEmail, setReportSendEmail] = useState(true);
  const [reportEmailTo, setReportEmailTo] = useState("operations@ejaz.sa");

  const KINDS: { id: RequestKind; en: string; ar: string; descEn: string; descAr: string; icon: typeof IconTruck; color: string }[] = [
    {
      id: "truck",
      en: "Fleet Truck",
      ar: "شاحنة أسطول",
      descEn: "Register, allocate or lease a heavy vehicle",
      descAr: "تسجيل أو تخصيص أو استئجار شاحنة للأسطول",
      icon: IconTruck,
      color: "#FF6B1A",
    },
    {
      id: "cargo",
      en: "Cargo Shipment",
      ar: "شحنة بضائع",
      descEn: "Dispatch commercial freight with waybill",
      descAr: "أمر شحن تجاري وإصدار بوليصة نقل ومسار",
      icon: IconCargo,
      color: "#22c55e",
    },
    {
      id: "repair",
      en: "Maintenance",
      ar: "صيانة وورشة",
      descEn: "Open a repair order or report road breakdown",
      descAr: "فتح تذكرة صيانة أو بلاغ عطل فني على المسار",
      icon: IconRepair,
      color: "#ffb020",
    },
    {
      id: "driver",
      en: "Driver Staffing",
      ar: "تكليف سائق",
      descEn: "Assign primary, relief or long-haul co-driver",
      descAr: "تعيين كابتن رئيسي أو بديل أو طاقم قيادة مزدوج",
      icon: IconDriver,
      color: "#a855f7",
    },
    {
      id: "report",
      en: "Official Report",
      ar: "تقرير رسمي",
      descEn: "Generate authenticated audit, billing or cold-chain docs",
      descAr: "استخراج تقارير معتمدة وسجلات حرارة وكشوفات",
      icon: IconReport,
      color: "#38bdf8",
    },
  ];

  const activeKindMeta = useMemo(() => KINDS.find((k) => k.id === kind) || KINDS[0], [kind]);

  // Selected truck for repair details
  const currentRepairTruck = useMemo(() => {
    return trucks.find((v) => v.id === repairTruckId) || trucks[0];
  }, [trucks, repairTruckId]);

  // Dynamic estimated price calculation for cargo
  const cargoEstimatedPrice = useMemo(() => {
    const baseRate = cargoBody === "reefer" ? 5600 : cargoBody === "flatbed" ? 4200 : cargoBody === "dry" ? 4500 : 4350;
    const weightFactor = Math.max(0.8, cargoWeightTons / 22);
    const expressMultiplier = cargoPriority === "super_urgent" ? 1.25 : cargoPriority === "express" ? 1.1 : 1.0;
    return Math.round(baseRate * weightFactor * expressMultiplier);
  }, [cargoBody, cargoWeightTons, cargoPriority]);

  // =========================================================================
  // SUBMISSION LOGIC PER KIND
  // =========================================================================
  const handleSubmit = () => {
    if (kind === "truck") {
      const prefix = BRANDS.find((b) => b.id === truckBrand)?.prefix || "TR";
      const assignedDriver = DRIVER_POOL.find((d) => d.id === truckDriverId) || DRIVER_POOL[0];
      const newVehicle: Vehicle = {
        id: `v-new-${Date.now()}`,
        shipment: `${prefix}-${Math.floor(100000000 + Math.random() * 899999999)}`,
        brand: truckBrand,
        model: truckModel,
        cab: truckCab,
        body: truckBody,
        status: "active",
        hp: HP[truckBrand] || 500,
        odometer: 15400,
        year: truckYear,
        plate: truckPlate,
        fuel: 100,
        engineTemp: 88,
        boxTemp: truckBody === "reefer" ? -18 : undefined,
        load: 0,
        maxLoad: truckMaxLoad,
        speed: 0,
        etaMinutes: 0,
        milesLeft: 0,
        progress: 0,
        driver: assignedDriver,
        partner: "مؤسسة إيجاز للنقليات (أسطول الشركة)",
        from: truckYard.split("—")[0].trim(),
        to: "جاهزة للتشغيل",
        stops: [
          { name: truckYard, place: t("Base Depot", "المقر الرئيسي"), done: true },
          { name: t("Ready for dispatch", "جاهزة للحركة"), place: t("Available", "متاحة"), done: false },
        ],
        route: "r-local",
        photos: [0, 1],
        comments: [
          {
            from: "me",
            text: t(`Truck ${truckPlate} commissioned into fleet.`, `تم ضم الشاحنة ${truckPlate} رسمياً إلى الأسطول.`),
            time: "الآن",
          },
        ],
        docs: docsFor(truckBody).map((name) => ({
          name,
          meta: t("Verified · TGA Approved", "معتمد · هيئة النقل"),
          state: "done" as const,
        })),
      };
      addVehicle(newVehicle);
      onCreate(newVehicle, "truck");
      return;
    }

    if (kind === "cargo") {
      const assignedDriver = DRIVER_POOL[Math.floor(Math.random() * DRIVER_POOL.length)];
      const cargoTruck = trucks.find((v) => v.body === cargoBody && v.status === "active") || trucks[0];
      const newShipmentVehicle: Vehicle = {
        id: `v-cargo-${Date.now()}`,
        shipment: `EJ-${Math.floor(20260000 + Math.random() * 8999)}`,
        brand: cargoTruck?.brand || "Mercedes-Benz",
        model: cargoTruck?.model || "Actros L 1863",
        cab: t("Freight Dispatch", "إرسالية شحن تجاري"),
        body: cargoBody,
        status: "active",
        hp: cargoTruck?.hp || 510,
        odometer: 240000 + Math.floor(Math.random() * 50000),
        year: 2024,
        plate: cargoTruck?.plate || `س ف ر ${Math.floor(1000 + Math.random() * 8999)}`,
        fuel: 95,
        engineTemp: 89,
        boxTemp: cargoBody === "reefer" ? cargoTargetTemp : undefined,
        load: cargoWeightTons,
        maxLoad: Math.max(25, cargoWeightTons),
        speed: 84,
        etaMinutes: 380,
        milesLeft: 890,
        progress: 5,
        driver: assignedDriver,
        partner: cargoPartner,
        from: `${cargoOriginCity} · ${cargoPickupAddress}`,
        to: `${cargoDestCity} · ${cargoDeliveryAddress}`,
        stops: [
          { name: cargoOriginCity, place: t("Loading Hub", "موقع التحميل والتجهيز"), done: true },
          { name: t("Corridor Waypoint", "محطة العبور السريعة"), place: t("In transit", "في الطريق السريع"), done: false },
          { name: cargoDestCity, place: t("Consignee Delivery", "مستودع التسليم والتفريغ"), done: false },
        ],
        route: "r-corridor",
        photos: [0, 1, 2],
        comments: [
          {
            from: "me",
            text: `تم إنشاء أمر الشحن: ${cargoNotes}`,
            time: "الآن",
          },
        ],
        docs: [
          { name: "بوليصة الشحن الإلكترونية (بيان)", meta: "معتمدة إلكترونياً", state: "done" },
          { name: cargoBody === "reefer" ? "سجل درجات حرارة التبريد" : "كشف الأوزان والموازين", meta: "حساسات نشطة", state: "done" },
        ],
      };
      addVehicle(newShipmentVehicle);
      onCreate(newShipmentVehicle, "cargo");
      return;
    }

    if (kind === "repair") {
      const targetTruck = currentRepairTruck;
      if (targetTruck) {
        updateVehicle(targetTruck.id, {
          status: "inactive",
          odometer: repairOdometer,
        });
      }
      const dummyVehicle: Vehicle = {
        ...(targetTruck || trucks[0]),
        status: "inactive",
        odometer: repairOdometer,
      };
      onCreate(dummyVehicle, "repair");
      return;
    }

    if (kind === "driver") {
      const targetTruck = trucks.find((v) => v.id === driverTruckId) || trucks[0];
      const selectedD = driverCandidateMode === "pool"
        ? (DRIVER_POOL.find((d) => d.id === driverSelectedPoolId) || DRIVER_POOL[0])
        : {
            id: `d-custom-${Date.now()}`,
            name: driverManualName,
            phone: driverManualPhone,
            initials: driverManualName.slice(0, 2),
            rating: 5.0,
            trips: 1,
          };
      if (targetTruck) {
        updateVehicle(targetTruck.id, {
          driver: selectedD,
        });
      }
      onCreate(targetTruck || trucks[0], "driver");
      return;
    }

    if (kind === "report") {
      toast(t("Report Generated", "تم استخراج التقرير الرسمي"), `${reportType.toUpperCase()} · ${reportFormat.toUpperCase()}`);
      onCreate(trucks[0], "report");
    }
  };

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[70] grid place-items-center bg-black/80 p-3 md:p-6 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up scroll-thin flex max-h-[92vh] w-full max-w-[760px] flex-col overflow-hidden rounded-panel bg-surface-3 shadow-2xl border border-border-subtle"
        style={{
          boxShadow: `0 35px 80px -20px color-mix(in oklab, ${activeKindMeta.color} 25%, transparent), 0 0 0 1px var(--color-border-subtle)`,
        }}
      >
        {/* ================================================================= */}
        {/* MODAL HEADER WITH DISTINCT TITLE AND METRICS                      */}
        {/* ================================================================= */}
        <div className="border-b border-border-subtle bg-surface-2/70 p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-control transition-colors duration-200"
                style={{
                  backgroundColor: `color-mix(in oklab, ${activeKindMeta.color} 18%, transparent)`,
                  color: activeKindMeta.color,
                }}
              >
                <activeKindMeta.icon size={22} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-section-title font-bold text-text-primary">
                    {t("Create New Request", "إنشاء طلب جديد")} · {t(activeKindMeta.en, activeKindMeta.ar)}
                  </h3>
                  <span
                    className="rounded-chip px-2 py-0.5 text-micro font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: `color-mix(in oklab, ${activeKindMeta.color} 15%, transparent)`,
                      color: activeKindMeta.color,
                      border: `1px solid color-mix(in oklab, ${activeKindMeta.color} 30%, transparent)`,
                    }}
                  >
                    {t(activeKindMeta.en, activeKindMeta.ar)}
                  </span>
                </div>
                <p className="mt-1 text-label text-text-muted">
                  {t(activeKindMeta.descEn, activeKindMeta.descAr)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn-icon rounded-chip bg-surface-4/60 hover:bg-surface-4 text-text-muted hover:text-text-primary"
              aria-label={t("Close", "إغلاق")}
            >
              <IconClose size={16} />
            </button>
          </div>

          {/* KIND SELECTOR TABS: Each kind has a distinct visual personality */}
          <div className="mt-4 grid grid-cols-5 gap-1.5 rounded-inner bg-surface-1 p-1 border border-border-subtle/50">
            {KINDS.map((k) => {
              const active = kind === k.id;
              const Icon = k.icon;
              return (
                <button
                  key={k.id}
                  onClick={() => setKind(k.id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-control py-2 px-1 text-center transition-all duration-200",
                    active
                      ? "bg-surface-3 shadow-sm font-bold text-text-primary"
                      : "text-text-muted hover:text-text-secondary hover:bg-surface-2/60"
                  )}
                  style={
                    active
                      ? {
                          borderBottom: `2.5px solid ${k.color}`,
                          color: "var(--color-text-primary)",
                        }
                      : {}
                  }
                >
                  <span style={{ color: active ? k.color : undefined }}>
                    <Icon size={16} />
                  </span>
                  <span className="text-label leading-tight truncate w-full">{t(k.en, k.ar)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ================================================================= */}
        {/* DYNAMIC SCROLLABLE BODY BASED ON KIND                             */}
        {/* ================================================================= */}
        <div className="scroll-thin flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          {/* --------------------------------------------------------------- */}
          {/* KIND 1: TRUCK (طلب إضافة أو تخصيص شاحنة)                         */}
          {/* --------------------------------------------------------------- */}
          {kind === "truck" && (
            <div className="space-y-4 animate-fade-in">
              {/* Purpose banner */}
              <div className="rounded-inner bg-surface-2 p-3 border border-border-subtle/80 flex items-center justify-between gap-3">
                <span className="text-label text-text-secondary font-medium">
                  {t("Allocation Purpose:", "الغرض من تخصيص الشاحنة:")}
                </span>
                <div className="flex gap-1.5">
                  {[
                    ["fleet_expansion", "إضافة للأسطول", "New Addition"],
                    ["route_replacement", "شاحنة بديلة لمسار", "Replacement"],
                    ["seasonal_lease", "تأجير تشغيلي", "Lease Unit"],
                  ].map(([val, ar, en]) => (
                    <button
                      key={val}
                      onClick={() => setTruckPurpose(val as any)}
                      className={cn(
                        "rounded-chip px-2.5 py-1 text-label font-bold transition-all",
                        truckPurpose === val
                          ? "bg-brand text-on-brand shadow-sm"
                          : "bg-surface-4 text-text-muted hover:text-text-primary"
                      )}
                    >
                      {t(en, ar)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body Type Selection */}
              <div>
                <Label>{t("Body Category & Specs", "فئة الهيكل والمواصفة الفنية")}</Label>
                <div className="mt-1.5 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {BODY_TYPES.map((b) => {
                    const active = truckBody === b.id;
                    const meta = getVehicleTypeMeta(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setTruckBody(b.id)}
                        className={cn(
                          "flex flex-col items-start gap-1 rounded-inner p-3 text-start transition-all border",
                          active
                            ? "bg-surface-2 border-brand shadow-sm"
                            : "bg-surface-2/40 border-border-subtle/60 hover:bg-surface-2"
                        )}
                      >
                        <div className="flex w-full items-center justify-between">
                          <TruckTypeAvatar truckType={b.id} size={30} iconSize={16} />
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: active ? meta.accentColor : "transparent" }}
                          />
                        </div>
                        <span className="font-bold text-card-title text-text-primary mt-1">
                          {t(b.label[0], b.label[1])}
                        </span>
                        <span className="text-micro text-text-muted line-clamp-1">
                          {t(b.note[0], b.note[1])}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Truck Specs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>{t("Brand", "ماركة الشاحنة")}</Label>
                  <select
                    value={truckBrand}
                    onChange={(e) => {
                      const b = e.target.value as Brand;
                      setTruckBrand(b);
                      setTruckModel(BRANDS.find((x) => x.id === b)!.models[0]);
                    }}
                    className="field mt-1.5 w-full"
                  >
                    {BRANDS.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{t("Model", "الموديل وطراز المحرك")}</Label>
                  <select
                    value={truckModel}
                    onChange={(e) => setTruckModel(e.target.value)}
                    className="field mt-1.5 w-full"
                  >
                    {BRANDS.find((b) => b.id === truckBrand)!.models.map((m) => (
                      <option key={m} value={m}>
                        {m} ({HP[truckBrand]} HP)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{t("Manufacturing Year", "سنة الصنع")}</Label>
                  <select
                    value={truckYear}
                    onChange={(e) => setTruckYear(+e.target.value)}
                    className="field mt-1.5 w-full font-mono tabular-nums"
                  >
                    {[2026, 2025, 2024, 2023, 2022].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Plate and Cab */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>{t("Plate Number", "رقم اللوحة المعتمد")}</Label>
                  <input
                    value={truckPlate}
                    onChange={(e) => setTruckPlate(e.target.value)}
                    className="field mt-1.5 w-full font-mono font-bold text-brand"
                    placeholder="ر ج د ٤٨٢١"
                  />
                </div>
                <div>
                  <Label>{t("Cab Cabin Type", "نوع الكابينة وتجهيز المنامة")}</Label>
                  <input
                    value={truckCab}
                    onChange={(e) => setTruckCab(e.target.value)}
                    className="field mt-1.5 w-full"
                    placeholder="GigaSpace Highline Cab"
                  />
                </div>
              </div>

              {/* Depot Yard & Driver Assignment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>{t("Home Yard / Depot", "ساحة التمركز والتسليم")}</Label>
                  <select
                    value={truckYard}
                    onChange={(e) => setTruckYard(e.target.value)}
                    className="field mt-1.5 w-full text-label-lg"
                  >
                    <option value="ساحة إيجاز المركزية — الرياض (السلي)">ساحة إيجاز المركزية — الرياض (السلي)</option>
                    <option value="محطة ميناء جدة الإسلامي (رصيف ٧)">محطة ميناء جدة الإسلامي (رصيف ٧)</option>
                    <option value="ساحة الميناء اللوجستية — الدمام">ساحة الميناء اللوجستية — الدمام</option>
                    <option value="مستودعات القصيم المركزية — بريدة">مستودعات القصيم المركزية — بريدة</option>
                  </select>
                </div>
                <div>
                  <Label>{t("Assigned Fleet Driver", "السائق المخصص للشاحنة")}</Label>
                  <select
                    value={truckDriverId}
                    onChange={(e) => setTruckDriverId(e.target.value)}
                    className="field mt-1.5 w-full text-label-lg"
                  >
                    {DRIVER_POOL.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.trips} رحلة · ⭐{d.rating})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Capacity Slider */}
              <div className="rounded-inner bg-surface-2 p-3.5 border border-border-subtle">
                <div className="flex items-center justify-between">
                  <span className="text-label text-text-secondary font-medium">
                    {t("Max Certified Payload", "سعة الحمولة القصوى المعتمدة")}
                  </span>
                  <span className="font-mono text-card-title font-bold text-brand tabular-nums">
                    {truckMaxLoad} {t("Tons", "طن")}
                  </span>
                </div>
                <input
                  type="range"
                  min={18}
                  max={36}
                  step={0.5}
                  value={truckMaxLoad}
                  onChange={(e) => setTruckMaxLoad(+e.target.value)}
                  className="range mt-2 w-full"
                />
              </div>

              {/* Technical equipment checkboxes */}
              <div>
                <Label>{t("Mandatory Technical Systems", "التجهيزات الفنية الإلزامية")}</Label>
                <div className="mt-1.5 grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    ["gpsGsm", "تتبع GPS وصل / TGA", "TGA Tracking AVL"],
                    ["axleWeighing", "حساسات أوزان المحاور", "Axle Sensors"],
                    ["tempSensors", "حساسات حرارة ورطوبة", "Temp Sensors"],
                    ["longHaulTires", "إطارات خطوط معتمدة", "Heavy Tires"],
                    ["fireSafety", "أنظمة الإطفاء والسلامة", "Safety Gear"],
                  ].map(([key, ar, en]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setTruckFeatures((prev) => ({ ...prev, [key]: !prev[key] }))
                      }
                      className={cn(
                        "flex items-center gap-2 rounded-chip p-2 text-start text-label border transition-colors",
                        truckFeatures[key]
                          ? "bg-surface-4 border-brand/50 text-text-primary"
                          : "bg-surface-2 border-border-subtle/50 text-text-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-4 w-4 shrink-0 place-items-center rounded-micro text-micro",
                          truckFeatures[key] ? "bg-brand text-on-brand" : "border border-border-subtle"
                        )}
                      >
                        {truckFeatures[key] && <IconCheck size={11} />}
                      </span>
                      <span className="truncate">{t(en, ar)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* KIND 2: CARGO (طلب شحنة بضائع ونقل تجاري)                         */}
          {/* --------------------------------------------------------------- */}
          {kind === "cargo" && (
            <div className="space-y-4 animate-fade-in">
              {/* Cargo Category Pills */}
              <div>
                <Label>{t("Cargo Nature & Commodity Type", "طبيعة وتصنيف البضاعة المشحونة")}</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {[
                    ["food_cold", "reefer", "أغذية مثلجة ومجمدة (-١٨°)", "Frozen Foods (-18°C)"],
                    ["dairy_fresh", "reefer", "ألبان وعصائر طازجة (+٤°)", "Fresh Dairy (+4°C)"],
                    ["steel_const", "flatbed", "حديد ومواد بناء ثقيلة", "Steel & Structural"],
                    ["dry_goods", "dry", "سلع تجزئة وبضائع جافة", "Packaged Dry Goods"],
                    ["pallets_general", "curtain", "باليتات ومنتجات استهلاكية", "General Pallets"],
                  ].map(([cat, bType, ar, en]) => {
                    const active = cargoCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setCargoCategory(cat);
                          setCargoBody(bType as BodyType);
                          if (cat === "food_cold") setCargoTargetTemp(-18);
                          else if (cat === "dairy_fresh") setCargoTargetTemp(4);
                        }}
                        className={cn(
                          "chip flex items-center gap-1.5",
                          active && "chip-on"
                        )}
                      >
                        <TruckTypeIcon truckType={bType as BodyType} size={14} />
                        <span>{t(en, ar)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cold Chain Panel if Reefer */}
              {cargoBody === "reefer" && (
                <div className="rounded-inner bg-accent-2/10 border border-accent-2/30 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-label-lg font-bold text-accent-2">
                      <IconBolt size={15} />
                      {t("Cold-Chain Target Temperature", "درجة حرارة سلسلة التبريد المطلوبة:")}
                    </span>
                    <span className="font-mono text-card-title font-bold text-accent-2 tabular-nums">
                      {cargoTargetTemp > 0 ? `+${cargoTargetTemp}` : cargoTargetTemp} °C
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={-25}
                      max={15}
                      step={1}
                      value={cargoTargetTemp}
                      onChange={(e) => setCargoTargetTemp(+e.target.value)}
                      className="range flex-1"
                    />
                    <div className="flex gap-1 shrink-0">
                      {[-18, -4, 4, 12].map((temp) => (
                        <button
                          key={temp}
                          type="button"
                          onClick={() => setCargoTargetTemp(temp)}
                          className={cn(
                            "rounded-micro px-2 py-0.5 text-micro font-mono font-bold tabular-nums",
                            cargoTargetTemp === temp ? "bg-accent-2 text-navy" : "bg-surface-3 text-text-muted"
                          )}
                        >
                          {temp > 0 ? `+${temp}` : temp}°
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Shipper Partner */}
              <div>
                <Label>{t("Shipper Commercial Partner", "الجهة الشاحنة (العميل أو الشريك)")}</Label>
                <select
                  value={cargoPartner}
                  onChange={(e) => setCargoPartner(e.target.value)}
                  className="field mt-1.5 w-full font-medium"
                >
                  {PARTNERS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Origin and Destination Corridor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-inner bg-surface-2 p-3 border border-border-subtle/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-label font-bold text-text-primary">
                    <IconPin size={14} className="text-brand" />
                    <span>{t("Loading Origin", "نقطة الانطلاق والتحميل")}</span>
                  </div>
                  <div>
                    <Label>{t("City", "المدينة")}</Label>
                    <select
                      value={cargoOriginCity}
                      onChange={(e) => setCargoOriginCity(e.target.value)}
                      className="field mt-1 w-full text-label-lg"
                    >
                      {SAUDI_CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>{t("Address / Gate", "العنوان والمستودع والبوابة")}</Label>
                    <input
                      value={cargoPickupAddress}
                      onChange={(e) => setCargoPickupAddress(e.target.value)}
                      className="field mt-1 w-full text-label-lg"
                      placeholder="الرياض · مستودع السلي بوابة ٤"
                    />
                  </div>
                  <div>
                    <Label>{t("Contact Person", "مسؤول الاستلام والهاتف")}</Label>
                    <input
                      value={cargoPickupContact}
                      onChange={(e) => setCargoPickupContact(e.target.value)}
                      className="field mt-1 w-full text-label-lg"
                      placeholder="محمد العتيبي · ٠٥٠١١٢٢٣٣٤"
                    />
                  </div>
                </div>

                <div className="rounded-inner bg-surface-2 p-3 border border-border-subtle/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-label font-bold text-text-primary">
                    <IconPin size={14} className="text-status-active" />
                    <span>{t("Delivery Destination", "نقطة الوصول والتفريغ")}</span>
                  </div>
                  <div>
                    <Label>{t("City", "المدينة")}</Label>
                    <select
                      value={cargoDestCity}
                      onChange={(e) => setCargoDestCity(e.target.value)}
                      className="field mt-1 w-full text-label-lg"
                    >
                      {SAUDI_CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>{t("Address / Terminal", "العنوان والمستودع والرصيف")}</Label>
                    <input
                      value={cargoDeliveryAddress}
                      onChange={(e) => setCargoDeliveryAddress(e.target.value)}
                      className="field mt-1 w-full text-label-lg"
                      placeholder="جدة · الميناء الإسلامي رصيف ٧"
                    />
                  </div>
                  <div>
                    <Label>{t("Receiver Contact", "المستلم والهاتف")}</Label>
                    <input
                      value={cargoDeliveryContact}
                      onChange={(e) => setCargoDeliveryContact(e.target.value)}
                      className="field mt-1 w-full text-label-lg"
                      placeholder="خالد السبيعي · ٠٥٥٤٤٣٣٢٢١"
                    />
                  </div>
                </div>
              </div>

              {/* Weight and Pallets */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-inner bg-surface-2 p-3 border border-border-subtle">
                  <div className="flex items-center justify-between">
                    <Label>{t("Net Cargo Weight", "الوزن الصافي للشحنة")}</Label>
                    <span className="font-mono text-card-title font-bold text-brand tabular-nums">
                      {cargoWeightTons} {t("Tons", "طن")}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    step={0.5}
                    value={cargoWeightTons}
                    onChange={(e) => setCargoWeightTons(+e.target.value)}
                    className="range mt-2 w-full"
                  />
                </div>
                <div className="rounded-inner bg-surface-2 p-3 border border-border-subtle">
                  <div className="flex items-center justify-between">
                    <Label>{t("Pallet Count", "عدد الطبالي / الطرود")}</Label>
                    <span className="font-mono text-card-title font-bold text-text-primary tabular-nums">
                      {cargoPallets} {t("Pallets", "طبلية")}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={33}
                    step={1}
                    value={cargoPallets}
                    onChange={(e) => setCargoPallets(+e.target.value)}
                    className="range mt-2 w-full"
                  />
                </div>
              </div>

              {/* Priority and Handling Flags */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>{t("Urgency Level", "درجة الاستعجال")}</Label>
                  <div className="mt-1.5 flex gap-2">
                    {[
                      ["standard", "عادي مجدول", "Standard"],
                      ["express", "سريع مباشر", "Express"],
                      ["super_urgent", "فوري طارئ", "Emergency"],
                    ].map(([p, ar, en]) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCargoPriority(p as any)}
                        className={cn(
                          "chip flex-1 text-center justify-center",
                          cargoPriority === p && "chip-on"
                        )}
                      >
                        {t(en, ar)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>{t("Loading Window", "نافذة التحميل المطلوبة")}</Label>
                  <input
                    value={cargoReadyDate}
                    onChange={(e) => setCargoReadyDate(e.target.value)}
                    className="field mt-1.5 w-full text-label-lg"
                    placeholder="اليوم · خلال ساعتين"
                  />
                </div>
              </div>

              {/* Special Handling and Notes */}
              <div>
                <Label>{t("Special Handling & Safety Conditions", "شروط السلامة والمناولة الخاصة")}</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCargoForklift(!cargoForklift)}
                    className={cn(
                      "chip flex items-center gap-1.5",
                      cargoForklift && "chip-on font-bold"
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", cargoForklift ? "bg-status-active" : "bg-text-muted")} />
                    <span>{t("Forklift Loading Required", "تحميل وتفريغ برافعة شوكية")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCargoHazmat(!cargoHazmat)}
                    className={cn(
                      "chip flex items-center gap-1.5",
                      cargoHazmat && "chip-on font-bold"
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", cargoHazmat ? "bg-status-warning" : "bg-text-muted")} />
                    <span>{t("HazMat / Chemical Clearance", "تصريح مواد كيميائية / خطرة")}</span>
                  </button>
                </div>
              </div>

              <div>
                <Label>{t("Operational Dispatch Instructions", "تعليمات وملاحظات إدارة الحركة")}</Label>
                <textarea
                  rows={2}
                  value={cargoNotes}
                  onChange={(e) => setCargoNotes(e.target.value)}
                  className="field mt-1.5 w-full text-label-lg"
                  placeholder="ملاحظات الشحن ومواعيد الوصول الخاصة..."
                />
              </div>

              {/* Tariff Card Summary */}
              <div className="rounded-inner bg-brand/10 border border-brand/30 p-3.5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-label text-text-secondary font-medium">
                    {t("Official Tariff Estimate (SAR):", "التسعيرة المعتمدة وفق دفتر التعرفة:")}
                  </div>
                  <div className="text-label text-text-muted mt-0.5">
                    {cargoOriginCity} ←→ {cargoDestCity} ({cargoBody.toUpperCase()})
                  </div>
                </div>
                <div className="text-end">
                  <div className="font-mono text-hero-sm font-bold text-brand tabular-nums">
                    {cargoEstimatedPrice.toLocaleString()} {t("SAR", "ر.س")}
                  </div>
                  <div className="text-micro text-text-muted">شامل التتبع والتأمين</div>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* KIND 3: REPAIR (طلب صيانة وورشة وعطل فني)                        */}
          {/* --------------------------------------------------------------- */}
          {kind === "repair" && (
            <div className="space-y-4 animate-fade-in">
              {/* Truck Selector */}
              <div>
                <Label>{t("Target Fleet Vehicle", "الشاحنة المعنية بالبلاغ")}</Label>
                <div className="mt-1.5 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {trucks.slice(0, 6).map((truck) => {
                    const active = repairTruckId === truck.id;
                    const meta = getVehicleTypeMeta(truck.body);
                    return (
                      <button
                        key={truck.id}
                        type="button"
                        onClick={() => {
                          setRepairTruckId(truck.id);
                          setRepairOdometer(truck.odometer);
                        }}
                        className={cn(
                          "flex items-center gap-3 rounded-inner p-2.5 text-start transition-all border",
                          active
                            ? "bg-surface-2 border-brand shadow-sm"
                            : "bg-surface-2/40 border-border-subtle/60 hover:bg-surface-2"
                        )}
                      >
                        <TruckTypeAvatar truckType={truck.body} size={36} iconSize={18} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-label-lg font-bold text-brand">
                              {truck.plate}
                            </span>
                            <span className="text-micro font-medium text-text-muted">{meta.arabicName}</span>
                          </div>
                          <div className="text-label text-text-secondary truncate">
                            {truck.brand} {truck.model}
                          </div>
                          <div className="text-micro text-text-muted truncate">
                            السائق: {truck.driver?.name || "بدون سائق"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Maintenance Category */}
              <div>
                <Label>{t("Maintenance Category", "تصنيف العطل أو الصيانة")}</Label>
                <div className="mt-1.5 grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    ["routine", "صيانة دورية وزيوت", "Routine Oil & Filters"],
                    ["tires_brakes", "إطارات وفرامل ومحاور", "Tires & Brakes"],
                    ["engine", "محرك وناقل حركة", "Engine & Transmission"],
                    ["reefer_unit", "وحدة التبريد والحرارة", "Thermo King / Refrig"],
                    ["electrical", "كهرباء وحساسات وتتبع", "Electrical & GPS"],
                    ["roadside", "عطل طارئ على الطريق", "Roadside Emergency"],
                  ].map(([id, ar, en]) => {
                    const active = repairType === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setRepairType(id as any)}
                        className={cn(
                          "rounded-chip p-2.5 text-start border transition-all text-label font-bold",
                          active
                            ? "bg-surface-4 border-status-waiting text-status-waiting shadow-sm"
                            : "bg-surface-2 border-border-subtle/50 text-text-secondary hover:text-text-primary"
                        )}
                      >
                        <div className="truncate">{t(en, ar)}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priority and Odometer */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>{t("Urgency / Severity Level", "درجة الخطورة والإلحاح")}</Label>
                  <div className="mt-1.5 flex gap-2">
                    {[
                      ["critical", "طوارئ حرجة", "Critical"],
                      ["urgent", "أولوية عاجلة", "Urgent"],
                      ["normal", "صيانة عادية", "Normal"],
                    ].map(([p, ar, en]) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setRepairPriority(p as any)}
                        className={cn(
                          "chip flex-1 text-center justify-center",
                          repairPriority === p && "chip-on font-bold",
                          repairPriority === p && p === "critical" && "text-status-danger border-status-danger/40 bg-status-danger/10"
                        )}
                      >
                        {t(en, ar)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>{t("Current Odometer (KM)", "قراءة العداد الحالية (كم)")}</Label>
                  <input
                    type="number"
                    value={repairOdometer}
                    onChange={(e) => setRepairOdometer(+e.target.value)}
                    className="field mt-1.5 w-full font-mono tabular-nums font-bold"
                  />
                </div>
              </div>

              {/* Location: Workshop vs Roadside */}
              <div>
                <Label>{t("Service Location", "موقع تقديم الخدمة الفنية")}</Label>
                <div className="mt-1.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRepairLocationType("workshop")}
                    className={cn(
                      "chip flex-1 text-center justify-center",
                      repairLocationType === "workshop" && "chip-on"
                    )}
                  >
                    {t("Authorized Workshop", "ورشة معتمدة داخلية")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepairLocationType("roadside")}
                    className={cn(
                      "chip flex-1 text-center justify-center",
                      repairLocationType === "roadside" && "chip-on"
                    )}
                  >
                    {t("Roadside Breakdown Location", "موقع العطل على الطريق")}
                  </button>
                </div>
                {repairLocationType === "workshop" ? (
                  <select
                    value={repairWorkshop}
                    onChange={(e) => setRepairWorkshop(e.target.value)}
                    className="field mt-2 w-full text-label-lg"
                  >
                    <option value="ورشة إيجاز المركزية (الرياض - مخرج ١٨)">ورشة إيجاز المركزية (الرياض - مخرج ١٨)</option>
                    <option value="ورشة الدمام اللوجستية (طريق الميناء)">ورشة الدمام اللوجستية (طريق الميناء)</option>
                    <option value="ورشة المنطقة الغربية (جدة - الخمرة)">ورشة المنطقة الغربية (جدة - الخمرة)</option>
                    <option value="مركز صيانة القصيم المعتمد">مركز صيانة القصيم المعتمد</option>
                  </select>
                ) : (
                  <input
                    value={repairRoadsideDesc}
                    onChange={(e) => setRepairRoadsideDesc(e.target.value)}
                    className="field mt-2 w-full text-label-lg"
                    placeholder="طريق الرياض - الدمام السريع كم ١٢٠ محطة ساسكو"
                  />
                )}
              </div>

              {/* Technical Description Textarea */}
              <div>
                <Label>{t("Detailed Technical Description", "وصف العطل والأعراض الملاحظة من السائق")}</Label>
                <textarea
                  rows={3}
                  value={repairDescription}
                  onChange={(e) => setRepairDescription(e.target.value)}
                  className="field mt-1.5 w-full text-label-lg leading-relaxed"
                  placeholder="اشرح المشكلة بدقة: مثل تسريب هواء الفرامل، ارتفاع حرارة المحرك، خلل في التبريد..."
                />
              </div>

              {/* Replacement truck toggle */}
              <div className="rounded-inner bg-surface-2 p-3 border border-border-subtle flex items-center justify-between gap-3">
                <div>
                  <div className="text-label font-bold text-text-primary">
                    {t("Require Immediate Cargo Replacement Truck?", "هل تتطلب توفير شاحنة بديلة لإنقاذ الشحنة؟")}
                  </div>
                  <div className="text-micro text-text-muted mt-0.5">
                    {t("Dispatches a standby truck to shift the load and avoid SLA penalties.", "إرسال شاحنة مساندة لنقل الحمولة ومنع تأخر التسليم.")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRepairNeedReplacement(!repairNeedReplacement)}
                  className={cn(
                    "rounded-chip px-3 py-1.5 text-label font-bold transition-all",
                    repairNeedReplacement
                      ? "bg-status-waiting text-navy shadow-sm"
                      : "bg-surface-4 text-text-muted"
                  )}
                >
                  {repairNeedReplacement ? t("Yes · Required", "نعم · مطلوبة فوراً") : t("No · In-situ only", "لا · صيانة بالموقع")}
                </button>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* KIND 4: DRIVER (طلب سائق وتكليف مهمة قيادة)                       */}
          {/* --------------------------------------------------------------- */}
          {kind === "driver" && (
            <div className="space-y-4 animate-fade-in">
              {/* Mission Type */}
              <div>
                <Label>{t("Staffing & Mission Scope", "طبيعة التكليف ومهمة الكابتن")}</Label>
                <div className="mt-1.5 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    ["primary", "سائق رحلة رئيسي", "Primary Captain"],
                    ["co_driver", "سائق إضافي (طاقم ثنائي)", "Long-haul Co-driver"],
                    ["relief", "سائق بديل طارئ", "Emergency Relief"],
                    ["new_onboard", "استقطاب كابتن جديد", "New Recruitment"],
                  ].map(([m, ar, en]) => {
                    const active = driverMissionType === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDriverMissionType(m as any)}
                        className={cn(
                          "rounded-inner p-2.5 text-start border transition-all text-label font-bold",
                          active
                            ? "bg-surface-4 border-ai text-ai shadow-sm"
                            : "bg-surface-2 border-border-subtle/50 text-text-secondary hover:text-text-primary"
                        )}
                      >
                        <div className="truncate">{t(en, ar)}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Truck Assignment */}
              <div>
                <Label>{t("Assigned Vehicle from Fleet", "الشاحنة المخصصة للمهمة")}</Label>
                <select
                  value={driverTruckId}
                  onChange={(e) => setDriverTruckId(e.target.value)}
                  className="field mt-1.5 w-full font-medium"
                >
                  {trucks.map((truck) => (
                    <option key={truck.id} value={truck.id}>
                      {truck.plate} · {truck.brand} {truck.model} ({getVehicleTypeMeta(truck.body).arabicName}) — {truck.partner}
                    </option>
                  ))}
                </select>
              </div>

              {/* Corridor Route */}
              <div>
                <Label>{t("Operating Corridor / Highway Route", "مسار الرحلة ومنطقة التشغيل")}</Label>
                <select
                  value={driverCorridor}
                  onChange={(e) => setDriverCorridor(e.target.value)}
                  className="field mt-1.5 w-full font-medium"
                >
                  <option value="الرياض ↔ جدة (المسار السريع — ٩٥٠ كم)">الرياض ↔ جدة (المسار السريع — ٩٥٠ كم)</option>
                  <option value="الرياض ↔ الدمام والجبيل (المسار الشرقي — ٤٨٠ كم)">الرياض ↔ الدمام والجبيل (المسار الشرقي — ٤٨٠ كم)</option>
                  <option value="جدة ↔ أبها وجازان (المسار الجنوبي — ٦٨٠ كم)">جدة ↔ أبها وجازان (المسار الجنوبي — ٦٨٠ كم)</option>
                  <option value="الرياض ↔ القصيم وحائل (المسار الشمالي — ٦٢٠ كم)">الرياض ↔ القصيم وحائل (المسار الشمالي — ٦٢٠ كم)</option>
                  <option value="النقل والتوزيع الإقليمي داخل المنطقة الوسطى">النقل والتوزيع الإقليمي داخل المنطقة الوسطى</option>
                </select>
              </div>

              {/* Candidate Selection Mode: Pool vs Manual */}
              <div>
                <div className="flex items-center justify-between">
                  <Label>{t("Candidate Selection", "اختيار الكابتن المرشح")}</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDriverCandidateMode("pool")}
                      className={cn("text-label font-bold", driverCandidateMode === "pool" ? "text-ai underline" : "text-text-muted")}
                    >
                      {t("From Ready Pool", "من بنك السائقين الجاهزين")}
                    </button>
                    <span className="text-text-muted">·</span>
                    <button
                      type="button"
                      onClick={() => setDriverCandidateMode("manual")}
                      className={cn("text-label font-bold", driverCandidateMode === "manual" ? "text-ai underline" : "text-text-muted")}
                    >
                      {t("Manual Entry", "تسجيل بيانات كابتن جديد")}
                    </button>
                  </div>
                </div>

                {driverCandidateMode === "pool" ? (
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {DRIVER_POOL.map((d) => {
                      const active = driverSelectedPoolId === d.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setDriverSelectedPoolId(d.id)}
                          className={cn(
                            "flex items-center gap-3 rounded-inner p-2.5 text-start border transition-all",
                            active
                              ? "bg-surface-4 border-ai shadow-sm"
                              : "bg-surface-2 border-border-subtle/50 text-text-secondary hover:bg-surface-2"
                          )}
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ai/20 text-label font-bold text-ai">
                            {d.initials}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-label-lg text-text-primary truncate">{d.name}</div>
                            <div className="text-micro text-text-muted font-mono">{d.phone} · ⭐{d.rating} ({d.trips} رحلة)</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label>{t("Full Name", "الاسم الرباعي")}</Label>
                      <input
                        value={driverManualName}
                        onChange={(e) => setDriverManualName(e.target.value)}
                        className="field mt-1 w-full text-label-lg"
                        placeholder="عبدالله سالم الدوسري"
                      />
                    </div>
                    <div>
                      <Label>{t("Phone Number", "رقم الجوال المعتمد")}</Label>
                      <input
                        value={driverManualPhone}
                        onChange={(e) => setDriverManualPhone(e.target.value)}
                        className="field mt-1 w-full text-label-lg font-mono"
                        placeholder="+966 55 982 3344"
                      />
                    </div>
                    <div>
                      <Label>{t("License Number", "رقم رخصة النقل الثقيل")}</Label>
                      <input
                        value={driverManualLicense}
                        onChange={(e) => setDriverManualLicense(e.target.value)}
                        className="field mt-1 w-full text-label-lg font-mono"
                        placeholder="DL-SA-901823"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Duration and Allowance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-inner bg-surface-2 p-3 border border-border-subtle">
                  <div className="flex items-center justify-between">
                    <Label>{t("Mission Duration (Days)", "مدة التكليف (بالأيام)")}</Label>
                    <span className="font-mono text-card-title font-bold text-ai tabular-nums">
                      {driverDurationDays} {t("Days", "أيام")}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    step={1}
                    value={driverDurationDays}
                    onChange={(e) => setDriverDurationDays(+e.target.value)}
                    className="range mt-2 w-full"
                  />
                </div>
                <div className="rounded-inner bg-surface-2 p-3 border border-border-subtle">
                  <div className="flex items-center justify-between">
                    <Label>{t("Trip Per Diem Allowance", "بدل ومخصص الرحلة (ر.س)")}</Label>
                    <span className="font-mono text-card-title font-bold text-brand tabular-nums">
                      {driverAllowanceSar} {t("SAR", "ر.س")}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={2500}
                    step={50}
                    value={driverAllowanceSar}
                    onChange={(e) => setDriverAllowanceSar(+e.target.value)}
                    className="range mt-2 w-full"
                  />
                </div>
              </div>

              {/* Regulatory Compliances */}
              <div>
                <Label>{t("Regulatory Certification Checks", "اشتراطات واعتمادات هيئة النقل (TGA)")}</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {[
                    ["tgaCard", driverReqTgaCard, () => setDriverReqTgaCard(!driverReqTgaCard), "بطاقة سائق مهني معتمدة (وصل)", "TGA Driver Card"],
                    ["hazmat", driverReqHazmat, () => setDriverReqHazmat(!driverReqHazmat), "تصريح نقل مواد خطرة (HAZMAT)", "HazMat Certified"],
                    ["medical", driverReqMedical, () => setDriverReqMedical(!driverReqMedical), "فحص طبي ومكافحة مخدرات سارٍ", "Medical & Drug Check"],
                  ].map(([key, active, toggle, ar, en]) => (
                    <button
                      key={key as string}
                      type="button"
                      onClick={toggle as any}
                      className={cn(
                        "chip flex items-center gap-1.5",
                        active && "chip-on font-bold"
                      )}
                    >
                      <span className={cn("h-2 w-2 rounded-full", active ? "bg-ai" : "bg-text-muted")} />
                      <span>{t(en as string, ar as string)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* KIND 5: REPORT (طلب تقرير رسمي وتصدير بيانات)                     */}
          {/* --------------------------------------------------------------- */}
          {kind === "report" && (
            <div className="space-y-4 animate-fade-in">
              {/* Report Type Selector */}
              <div>
                <Label>{t("Official Report Category", "نوع التقرير التشغيلي أو النظامي")}</Label>
                <div className="mt-1.5 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    ["cold_chain", "❄️ سجل حرارة سلسلة التبريد المعتمد", "Cold-Chain Temperature Audit Log"],
                    ["axle_weight", "⚖️ تقرير بيان حمولة ومطابقة الموازين", "Axle Load Compliance Waybill"],
                    ["fuel_telemetry", "⛽ كفاءة استهلاك الوقود والانبعاثات", "Fuel & Telemetry Eco Audit"],
                    ["driver_sla", "⭐ أداء والتزام السائق وساعات العمل", "Driver SLA & Hours of Service"],
                    ["client_billing", "📑 كشف حساب رحلات العميل مع الفواتير", "Customer Billing & Trip Statement"],
                    ["incident_claim", "🚨 سجل الحوادث والأعطال ومطالبات التأمين", "Incident & Insurance Claims Summary"],
                  ].map(([id, ar, en]) => {
                    const active = reportType === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setReportType(id as any)}
                        className={cn(
                          "rounded-inner p-3 text-start border transition-all",
                          active
                            ? "bg-surface-4 border-info text-info shadow-sm"
                            : "bg-surface-2 border-border-subtle/50 text-text-secondary hover:text-text-primary"
                        )}
                      >
                        <div className="font-bold text-label-lg">{ar}</div>
                        <div className="text-micro text-text-muted mt-0.5 truncate">{en}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Data Scope */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>{t("Data Scope Filter", "نطاق شمولية البيانات")}</Label>
                  <div className="mt-1.5 flex gap-2">
                    {[
                      ["all", "كامل الأسطول", "Entire Fleet"],
                      ["truck", "شاحنة محددة", "By Truck"],
                      ["partner", "عميل محدد", "By Partner"],
                    ].map(([s, ar, en]) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setReportScope(s as any)}
                        className={cn("chip flex-1 text-center justify-center", reportScope === s && "chip-on")}
                      >
                        {t(en, ar)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>{t("Timeframe Window", "النطاق الزمني للتقرير")}</Label>
                  <div className="mt-1.5 flex gap-2">
                    {[
                      ["today", "اليوم", "Today"],
                      ["7d", "آخر ٧ أيام", "Last 7D"],
                      ["30d", "هذا الشهر", "30 Days"],
                      ["quarter", "الربع الحالي", "Quarter"],
                    ].map(([d, ar, en]) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setReportDateRange(d as any)}
                        className={cn("chip flex-1 text-center justify-center font-mono", reportDateRange === d && "chip-on")}
                      >
                        {t(en, ar)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Specific Truck or Partner if scoped */}
              {reportScope === "truck" && (
                <div>
                  <Label>{t("Select Specific Vehicle", "تحديد الشاحنة المستهدفة بالتقرير")}</Label>
                  <select
                    value={reportTruckId}
                    onChange={(e) => setReportTruckId(e.target.value)}
                    className="field mt-1.5 w-full font-medium"
                  >
                    {trucks.map((truck) => (
                      <option key={truck.id} value={truck.id}>
                        {truck.plate} · {truck.brand} {truck.model} ({getVehicleTypeMeta(truck.body).arabicName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {reportScope === "partner" && (
                <div>
                  <Label>{t("Select Commercial Partner", "تحديد الشريك أو العميل")}</Label>
                  <select
                    value={reportPartner}
                    onChange={(e) => setReportPartner(e.target.value)}
                    className="field mt-1.5 w-full font-medium"
                  >
                    {PARTNERS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Output Format */}
              <div>
                <Label>{t("Export Output Format", "صيغة التصدير المطلوبة")}</Label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {[
                    ["pdf", "مستند PDF رسمي مروّس ومختوم", "Official PDF Document", "📄"],
                    ["excel", "جدول بيانات Excel تحليلي", "Analytical Excel Sheet", "📊"],
                    ["csv", "ملف بيانات CSV خام للربط", "Raw CSV Data Feed", "⚙️"],
                  ].map(([f, ar, en, icon]) => {
                    const active = reportFormat === f;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setReportFormat(f as any)}
                        className={cn(
                          "rounded-inner p-3 text-start border transition-all",
                          active
                            ? "bg-surface-4 border-info text-info shadow-sm"
                            : "bg-surface-2 border-border-subtle/50 text-text-secondary hover:text-text-primary"
                        )}
                      >
                        <div className="text-section-title">{icon}</div>
                        <div className="font-bold text-label-lg mt-1">{ar}</div>
                        <div className="text-micro text-text-muted truncate">{en}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Authentication and Email Copy */}
              <div className="rounded-inner bg-surface-2 p-3.5 border border-border-subtle space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("grid h-5 w-5 place-items-center rounded-micro text-micro", reportOfficialSeal ? "bg-info text-navy" : "border border-border-subtle")}>
                      {reportOfficialSeal && <IconCheck size={12} />}
                    </span>
                    <span className="text-label-lg font-bold text-text-primary">
                      {t("Apply EJAZ Official Digital Authentication Seal", "تطبيق ختم الاعتماد الرقمي الرسمي لمؤسسة إيجاز")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReportOfficialSeal(!reportOfficialSeal)}
                    className="text-label text-brand font-bold"
                  >
                    {reportOfficialSeal ? "مفعّل" : "تعطيل"}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border-subtle/50">
                  <button
                    type="button"
                    onClick={() => setReportSendEmail(!reportSendEmail)}
                    className="flex items-center gap-2 text-start"
                  >
                    <span className={cn("grid h-5 w-5 place-items-center rounded-micro text-micro", reportSendEmail ? "bg-info text-navy" : "border border-border-subtle")}>
                      {reportSendEmail && <IconCheck size={12} />}
                    </span>
                    <span className="text-label-lg font-bold text-text-primary">
                      {t("Send Email Copy to Operations Dispatch", "إرسال نسخة بريدية فورية لإدارة الحركة")}
                    </span>
                  </button>
                  <input
                    value={reportEmailTo}
                    onChange={(e) => setReportEmailTo(e.target.value)}
                    className="field font-mono text-label py-1 px-2.5 max-w-[200px]"
                    placeholder="operations@ejaz.sa"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* MODAL FOOTER WITH SPECIFIC ACTION BUTTON                          */}
        {/* ================================================================= */}
        <div className="border-t border-border-subtle bg-surface-2/80 p-4 md:p-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost text-label-lg"
          >
            {t("Cancel", "إلغاء")}
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="btn-primary px-6 flex items-center gap-2 text-label-lg font-bold"
            style={{
              backgroundColor: activeKindMeta.color,
              color: kind === "report" ? "#050B18" : "#ffffff",
            }}
          >
            {kind === "truck" && (
              <>
                <IconTruck size={17} />
                <span>{t("Commission Truck to Fleet", "تسجيل الشاحنة في الأسطول")}</span>
              </>
            )}
            {kind === "cargo" && (
              <>
                <IconCargo size={17} />
                <span>{t("Confirm Shipment & Generate Waybill", "تأكيد طلب الشحنة وتوليد البوليصة")}</span>
              </>
            )}
            {kind === "repair" && (
              <>
                <IconRepair size={17} />
                <span>{t("Issue Workshop Maintenance Order", "إصدار أمر الصيانة وتحويل للورشة")}</span>
              </>
            )}
            {kind === "driver" && (
              <>
                <IconDriver size={17} />
                <span>{t("Approve Driver Assignment Mission", "اعتماد تكليف السائق بالمهمة")}</span>
              </>
            )}
            {kind === "report" && (
              <>
                <IconDownload size={17} />
                <span>{t("Generate & Export Official Report", "توليد وتحميل التقرير فوراً")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-label tracking-wide text-text-muted font-bold uppercase mb-1">
      {children}
    </span>
  );
}
