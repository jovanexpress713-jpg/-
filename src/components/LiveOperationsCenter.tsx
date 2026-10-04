import { useState, useRef, useEffect } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { useFleetStore, type Trip } from "../state/fleetStore";
import { SAUDI_CORRIDORS } from "../services/gpsSimulation";
import {
  APPROVED_VEHICLE_TYPES,
  getVehicleTypeMeta,
  normalizeVehicleType,
  type CanonicalVehicleTypeId,
} from "../data/vehicleTypes";
import { Vehicle3DViewer } from "./Vehicle3DViewer";
import { TruckTypeIcon } from "./TruckTypeIcon";
import {
  IconZoomIn,
  IconZoomOut,
  IconClose,
  IconPin,
  IconLayers,
  IconArrowRight,
  IconDoc,
} from "./Icons";
import { palette, rgba } from "../utils/palette";

interface LiveOperationsCenterProps {
  onOpenTripDetails?: (tripId: string) => void;
  onOpenShipmentDetails?: (tripId: string) => void;
}

export function LiveOperationsCenter({
  onOpenTripDetails,
  onOpenShipmentDetails,
}: LiveOperationsCenterProps) {
  const { t } = useSettings();
  const {
    trips,
    trucks,
    drivers,
    alerts,
    selectedTripId,
    selectTrip,
    selectTruck,
  } = useFleetStore();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Map state
  const [zoom, setZoom] = useState(1.25);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mapLayer, setMapLayer] = useState<"logistics" | "satellite">("logistics");

  // Filter selection on map
  const [typeFilter, setTypeFilter] = useState<"ALL" | CanonicalVehicleTypeId>("ALL");

  // Floating Vehicle Panel State
  const [focusedTripId, setFocusedTripId] = useState<string>(selectedTripId || trips[0]?.id || "trip-1");
  const [showFloatingPanel, setShowFloatingPanel] = useState(true);

  // Synchronize focused trip with store
  useEffect(() => {
    if (selectedTripId) setFocusedTripId(selectedTripId);
  }, [selectedTripId]);

  const focusedTrip: Trip = useFleetStore().trips.find((tr) => tr.id === focusedTripId) || trips[0];
  const focusedTruck = trucks.find((v) => v.id === focusedTrip?.truckId) || trucks[0];
  const focusedDriver = drivers.find((d) => d.id === focusedTrip?.driverId) || drivers[0];

  // Operations KPI Metrics
  const activeTripsCount = trips.length;
  const inTransitCount = trips.filter((t) => t.status === "on_road").length;
  const loadingCount = trips.filter((t) => t.status === "loading" || t.status === "planning").length;
  const deliveredCount = trips.filter((t) => t.status === "delivered" || t.status === "completed").length;
  const activeAlertsCount = alerts.filter((a) => !a.resolved).length;

  // Real projected coordinates
  const projectCoords = (
    lat: number,
    lng: number,
    width: number,
    height: number
  ): [number, number] => {
    const minLat = 16.5;
    const maxLat = 31.8;
    const minLng = 34.2;
    const maxLng = 55.8;

    const xRatio = (lng - minLng) / (maxLng - minLng);
    const yRatio = 1 - (lat - minLat) / (maxLat - minLat);

    const baseCenterX = width * 0.5 + pan.x;
    const baseCenterY = height * 0.5 + pan.y;

    const x = baseCenterX + (xRatio - 0.5) * width * 1.55 * zoom;
    const y = baseCenterY + (yRatio - 0.5) * height * 1.55 * zoom;

    return [x, y];
  };

  // Center on focused truck
  const handleCenterOnTruck = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1.4);
  };

  // Canvas drawing loop: High performance Saudi Logistics Operations Map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    /* Spec §4.3 — resolved from the design tokens so this canvas follows the
       same navy + orange system (and the same theme flip) as the DOM. */
    const pal = palette();

    let animFrame: number;

    const render = () => {
      const width = canvas.parentElement?.clientWidth || 800;
      const height = canvas.parentElement?.clientHeight || 600;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      // 1. Background
      ctx.fillStyle = mapLayer === "satellite" ? pal["--color-bg-deep"] : pal["--color-bg-main"];
      ctx.fillRect(0, 0, width, height);

      // 2. Graticule Lat/Lng grid
      ctx.strokeStyle = rgba(pal["--color-surface-6"], 0.3);
      ctx.lineWidth = 1;
      const gridSize = 48 * zoom;
      const offsetX = pan.x % gridSize;
      const offsetY = pan.y % gridSize;

      for (let x = offsetX; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = offsetY; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 3. Major Logistics Nodes / Cities
      const CITIES: [string, number, number][] = [
        ["الرياض (المركز اللوجستي الأوسط)", 24.7136, 46.6753],
        ["جدة (الميناء الإسلامي)", 21.4858, 39.1925],
        ["الدمام (ميناء الملك عبدالعزيز)", 26.4207, 50.0888],
        ["الجبيل الصناعية", 27.0046, 50.1029],
        ["الخرج (مجمع المعالجة)", 24.1556, 47.3119],
        ["القصيم (بريدة)", 26.3260, 43.9750],
        ["المدينة المنورة", 24.5247, 39.6125],
        ["مكة المكرمة", 21.3891, 39.8579],
        ["تبوك", 28.3835, 36.5667],
        ["أبها", 18.2167, 42.5000],
      ];

      CITIES.forEach(([cityName, cLat, cLng]) => {
        const [cx, cy] = projectCoords(cLat, cLng, width, height);
        if (cx < -40 || cx > width + 40 || cy < -40 || cy > height + 40) return;

        // Outer glow
        ctx.fillStyle = rgba(pal["--color-status-info"], 0.25);
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.fillStyle = pal["--color-text-secondary"];
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // City label
        ctx.fillStyle = rgba(pal["--color-text-primary"], 0.75);
        ctx.font = "10px 'Tajawal', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(cityName, cx, cy - 7);
      });

      // 4. Highway Logistics Corridors (Render All Active)
      trips.forEach((tr) => {
        const isFocused = tr.id === focusedTrip?.id;
        const corridor = SAUDI_CORRIDORS[tr.corridorKey] || SAUDI_CORRIDORS["riyadh-jeddah"];
        const points = corridor.points;
        if (!points || points.length < 2) return;

        const normType = normalizeVehicleType(tr.cargoType);
        const meta = getVehicleTypeMeta(normType);

        // Background dashed route
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = isFocused ? rgba(pal["--color-brand"], 0.45) : rgba(pal["--color-text-muted"], 0.2);
        ctx.lineWidth = isFocused ? 3 : 1.5;

        const [sX, sY] = projectCoords(points[0][0], points[0][1], width, height);
        ctx.moveTo(sX, sY);
        for (let i = 1; i < points.length; i++) {
          const [px, py] = projectCoords(points[i][0], points[i][1], width, height);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Active Traveled Glowing Route
        if (isFocused) {
          const [truckX, truckY] = projectCoords(tr.currentLat, tr.currentLng, width, height);
          ctx.save();
          ctx.shadowColor = meta.accentColor;
          ctx.shadowBlur = 10;
          ctx.strokeStyle = meta.accentColor;
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(sX, sY);

          for (let i = 1; i < points.length; i++) {
            const [px, py] = projectCoords(points[i][0], points[i][1], width, height);
            if (i < points.length * (tr.progressPct / 100)) {
              ctx.lineTo(px, py);
            } else {
              ctx.lineTo(truckX, truckY);
              break;
            }
          }
          ctx.stroke();
          ctx.restore();

          // Loading & Unloading Terminal Badges
          const [destX, destY] = projectCoords(
            points[points.length - 1][0],
            points[points.length - 1][1],
            width,
            height
          );

          // Origin marker
          ctx.fillStyle = pal["--color-brand"];
          ctx.beginPath();
          ctx.arc(sX, sY, 5, 0, Math.PI * 2);
          ctx.fill();

          // Dest marker
          ctx.fillStyle = pal["--color-status-active"];
          ctx.beginPath();
          ctx.arc(destX, destY, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // 5. Active Fleet Vehicle Markers (Real trucks from database)
      trips.forEach((tr) => {
        const normType = normalizeVehicleType(tr.cargoType);
        if (typeFilter !== "ALL" && normType !== typeFilter) return;

        const isFocused = tr.id === focusedTrip?.id;
        const [tx, ty] = projectCoords(tr.currentLat, tr.currentLng, width, height);
        const meta = getVehicleTypeMeta(normType);

        ctx.save();
        ctx.translate(tx, ty);

        // Ground shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.beginPath();
        ctx.ellipse(0, 2, 14, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Heading directional marker
        const rad = ((tr.headingDeg - 90) * Math.PI) / 180;
        ctx.rotate(rad);

        // Focused pulsing aura
        if (isFocused) {
          ctx.strokeStyle = pal["--color-brand"];
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 16, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Vehicle Marker Box (Tractor + Trailer representation)
        ctx.fillStyle = meta.accentColor;
        ctx.fillRect(-10, -4, 15, 8); // Trailer

        ctx.fillStyle = pal["--color-navy"];
        ctx.fillRect(5, -4, 5, 8); // Cab

        // Windshield
        ctx.fillStyle = pal["--color-paper"];
        ctx.fillRect(7, -2.5, 2, 5);

        ctx.restore();

        // Label above truck
        ctx.fillStyle = isFocused ? pal["--color-brand"] : pal["--color-text-primary"];
        ctx.font = isFocused ? "bold 11px 'Tajawal', sans-serif" : "10px 'Tajawal', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(tr.tripNumber, tx, ty - 14);

        if (isFocused && tr.speedKmH > 0) {
          ctx.fillStyle = pal["--color-status-active"];
          ctx.font = "9.5px 'Tajawal', sans-serif";
          ctx.fillText(`${tr.speedKmH} كم/س`, tx, ty + 18);
        }
      });
    };

    render();
    const parent = canvas.parentElement;
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && parent
        ? new ResizeObserver(() => {
            cancelAnimationFrame(animFrame);
            animFrame = requestAnimationFrame(render);
          })
        : null;
    if (resizeObserver && parent) resizeObserver.observe(parent);

    return () => {
      cancelAnimationFrame(animFrame);
      resizeObserver?.disconnect();
    };
  }, [trips, focusedTrip, pan, zoom, mapLayer, typeFilter]);

  // Pointer panning & dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Click on Canvas to select nearest truck
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check proximity to all trucks
    for (const tr of trips) {
      const [tx, ty] = projectCoords(tr.currentLat, tr.currentLng, canvas.width, canvas.height);
      const dist = Math.hypot(clickX - tx, clickY - ty);
      if (dist < 22) {
        setFocusedTripId(tr.id);
        selectTrip(tr.id);
        selectTruck(tr.truckId);
        setShowFloatingPanel(true);
        break;
      }
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-0">
      {/* 1. OPERATIONS SUMMARY BAR (Section 4) */}
      <div className="shrink-0 bg-surface-1 border-b border-border-subtle px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Operations Center Brand Label */}
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-status-active animate-ping" />
            <span className="font-bold text-[14px] text-text-primary tracking-wide">
              {t("EJAZ LIVE OPERATIONS CENTER", "مركز عمليات وتشغيل إيجاز المباشر")}
            </span>
            <span className="text-text-muted text-[11px]">|</span>
            <span className="text-[11.5px] text-text-secondary">
              {t("Highway Fleet Telemetry & Central Dispatch", "تتبع حركة الأسطول اللوجستي والتوجيه المركزي")}
            </span>
          </div>

          {/* Quick Metrics KPI Cards */}
          <div className="flex items-center gap-2 overflow-x-auto text-[11.5px]">
            <div className="flex items-center gap-1.5 bg-surface-2 px-3 py-1.5 rounded-[8px] border border-white/5">
              <span className="text-text-muted">{t("Active", "الرحلات النشطة")}:</span>
              <span className="font-bold text-text-primary tabular-nums">{activeTripsCount}</span>
            </div>

            <div className="flex items-center gap-1.5 bg-surface-2 px-3 py-1.5 rounded-[8px] border border-white/5">
              <span className="h-2 w-2 rounded-full bg-status-active" />
              <span className="text-text-muted">{t("In Transit", "على الطريق")}:</span>
              <span className="font-bold text-status-active tabular-nums">{inTransitCount}</span>
            </div>

            <div className="flex items-center gap-1.5 bg-surface-2 px-3 py-1.5 rounded-[8px] border border-white/5">
              <span className="h-2 w-2 rounded-full bg-status-waiting" />
              <span className="text-text-muted">{t("Loading", "قيد التحميل")}:</span>
              <span className="font-bold text-status-waiting tabular-nums">{loadingCount}</span>
            </div>

            <div className="flex items-center gap-1.5 bg-surface-2 px-3 py-1.5 rounded-[8px] border border-white/5">
              <span className="h-2 w-2 rounded-full bg-accent-2" />
              <span className="text-text-muted">{t("Delivered", "تم التسليم")}:</span>
              <span className="font-bold text-accent-2 tabular-nums">{deliveredCount}</span>
            </div>

            {activeAlertsCount > 0 && (
              <div className="flex items-center gap-1.5 bg-status-danger/15 px-3 py-1.5 rounded-[8px] border border-status-danger/30 text-status-danger">
                <span className="h-2 w-2 rounded-full bg-status-danger animate-pulse" />
                <span className="font-bold">{activeAlertsCount} {t("Alerts", "تنبيهات")}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. MAIN MAP VIEWPORT (Section 5 & 6) */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* Interactive Canvas */}
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
          className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        />

        {/* Floating Top Controls Toolbar on Map */}
        <div className="absolute top-4 start-4 z-20 flex flex-wrap items-center gap-2 bg-surface-1/90 backdrop-blur-md p-1.5 rounded-[12px] border border-border-subtle shadow-xl text-[11.5px]">
          {/* 4 Types Filter */}
          <button
            onClick={() => setTypeFilter("ALL")}
            className={cn(
              "px-2.5 py-1 rounded-[6px] font-semibold transition-colors",
              typeFilter === "ALL" ? "bg-brand text-on-brand" : "text-text-secondary hover:text-text-primary"
            )}
          >
            {t("All", "الكل")}
          </button>
          {(["flatbed", "reefer", "dry", "curtain"] as CanonicalVehicleTypeId[]).map((tid) => {
            const m = APPROVED_VEHICLE_TYPES[tid];
            const isSel = typeFilter === tid;
            return (
              <button
                key={tid}
                onClick={() => setTypeFilter(tid)}
                className={cn(
                  "px-2.5 py-1 rounded-[6px] font-semibold transition-colors flex items-center gap-1",
                  isSel ? "bg-brand text-on-brand font-bold" : "text-text-secondary hover:text-text-primary"
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: isSel ? "var(--color-navy)" : m.accentColor }} />
                <span>{m.arabicName}</span>
              </button>
            );
          })}

          <span className="text-white/20">|</span>

          {/* Layer switcher */}
          <button
            onClick={() => setMapLayer(mapLayer === "logistics" ? "satellite" : "logistics")}
            className="px-2.5 py-1 rounded-[6px] bg-surface-3 hover:bg-surface-4 text-text-secondary hover:text-text-primary font-medium flex items-center gap-1"
          >
            <IconLayers size={13} />
            <span>{mapLayer === "logistics" ? t("Satellite", "قمر صناعي") : t("Logistics", "خريطة الممرات")}</span>
          </button>
        </div>

        {/* Zoom & Recenter Controls */}
        <div className="absolute bottom-6 end-6 z-20 flex flex-col gap-1.5 bg-surface-1/90 backdrop-blur-md p-1.5 rounded-[10px] border border-border-subtle shadow-xl">
          <button
            onClick={handleCenterOnTruck}
            className="p-2 rounded-[6px] text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
            title={t("Center on Selected Truck", "توسيط الخريطة على الشاحنة المختارة")}
          >
            <IconPin size={16} className="text-brand" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(3.0, z + 0.25))}
            className="p-2 rounded-[6px] text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
            title={t("Zoom In", "تكبير")}
          >
            <IconZoomIn size={16} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.7, z - 0.25))}
            className="p-2 rounded-[6px] text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
            title={t("Zoom Out", "تصغير")}
          >
            <IconZoomOut size={16} />
          </button>
        </div>

        {/* 3. FLOATING VEHICLE / TRIP PANEL (Section 5 Example) */}
        {showFloatingPanel && focusedTrip && (
          <div className="absolute top-2 end-2 z-20 flex w-[calc(100%-1rem)] max-w-[340px] flex-col overflow-hidden rounded-[16px] border border-border-subtle bg-surface-1/95 shadow-2xl backdrop-blur-md animate-fade-up sm:top-4 sm:end-4 sm:w-[380px] sm:max-w-none">
            {/* Header */}
            <div className="p-3.5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-status-active animate-pulse" />
                <span className="font-mono font-bold text-[13px] text-brand">
                  {focusedTrip.tripNumber}
                </span>
                <span className="text-[11px] text-text-muted">·</span>
                <span className="text-[11px] font-semibold text-text-secondary">
                  {focusedTruck.plate}
                </span>
              </div>
              <button
                onClick={() => setShowFloatingPanel(false)}
                className="btn-icon-sm"
                aria-label="Close"
              >
                <IconClose size={14} />
              </button>
            </div>

            {/* Embedded 3D Vehicle Viewer */}
            <div className="relative h-[160px] w-full bg-surface-2 border-b border-white/5">
              <Vehicle3DViewer
                vehicleType={focusedTrip.cargoType}
                vehiclePlate={focusedTruck.plate}
                previewMode={false}
                height="100%"
                compact={true}
                showControls={false}
              />
              <div className="absolute bottom-2 start-2 z-10">
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md"
                  style={{
                    backgroundColor: getVehicleTypeMeta(focusedTrip.cargoType).badgeBg,
                    color: getVehicleTypeMeta(focusedTrip.cargoType).accentColor,
                  }}
                >
                  {getVehicleTypeMeta(focusedTrip.cargoType).arabicName} — {getVehicleTypeMeta(focusedTrip.cargoType).englishName}
                </span>
              </div>
            </div>

            {/* Telemetry & Details Body */}
            <div className="p-3.5 space-y-2.5 text-[12px]">
              {/* Route */}
              <div className="flex items-center justify-between bg-surface-2 p-2 rounded-[8px] border border-white/5">
                <div className="truncate">
                  <div className="text-[9.5px] text-text-muted">{t("Origin", "الانطلاق")}</div>
                  <div className="font-semibold text-text-primary truncate">{focusedTrip.originCity}</div>
                </div>
                <span className="text-brand font-bold text-[13px]">→</span>
                <div className="truncate text-end">
                  <div className="text-[9.5px] text-text-muted">{t("Destination", "الوجهة")}</div>
                  <div className="font-semibold text-text-primary truncate">{focusedTrip.destinationCity}</div>
                </div>
              </div>

              {/* Driver & Telemetry */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-surface-2 p-2 rounded-[8px]">
                  <div className="text-text-muted text-[9.5px]">{t("Driver", "السائق")}</div>
                  <div className="font-semibold text-text-primary truncate mt-0.5">{focusedDriver.name}</div>
                </div>

                <div className="bg-surface-2 p-2 rounded-[8px]">
                  <div className="text-text-muted text-[9.5px]">{t("GPS Speed", "السرعة الحية")}</div>
                  <div className="font-bold text-status-active tabular-nums mt-0.5">
                    {focusedTrip.speedKmH > 0 ? `${focusedTrip.speedKmH} كم/س (LIVE)` : "متوقفة"}
                  </div>
                </div>
              </div>

              {/* Progress & Remaining */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10.5px] text-text-muted tabular-nums">
                  <span>{t("Progress", "نسبة الإنجاز")}: {focusedTrip.progressPct}%</span>
                  <span>{t("Remaining", "المتبقي")}: {focusedTrip.distanceRemainingKm} كم ({focusedTrip.etaMinutes} د)</span>
                </div>
                <div className="h-1.5 w-full bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all"
                    style={{ width: `${focusedTrip.progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Panel Action Buttons */}
            <div className="p-3 bg-surface-2 border-t border-border-subtle flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  if (onOpenTripDetails) onOpenTripDetails(focusedTrip.id);
                }}
                className="btn-primary flex-1 py-1.5 text-[11.5px]"
              >
                <span>{t("Full Trip Details", "تفاصيل الرحلة والمسار")}</span>
                <IconArrowRight size={13} />
              </button>

              <button
                onClick={() => {
                  if (onOpenShipmentDetails) onOpenShipmentDetails(focusedTrip.id);
                }}
                className="btn-ghost py-1.5 px-3 text-[11px]"
                title={t("View Waybill & POD", "بوليصة الشحن")}
              >
                <IconDoc size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. ACTIVE TRIPS / SHIPMENTS BOTTOM STRIP (Section 4) */}
      <div className="shrink-0 bg-surface-1 border-t border-border-subtle p-3 lg:px-6">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[12px] text-text-primary">
              {t("Active Highway Shipments", "الشحنات والرحلات النشطة على الطريق")}
            </span>
            <span className="text-text-muted text-[10.5px]">({trips.length})</span>
          </div>
          <div className="text-[11px] text-text-muted">
            {t("Click any trip to focus map & 3D vehicle", "اضغط على أي رحلة للتركيز على الخريطة والمجسم")}
          </div>
        </div>

        {/* Horizontal Scrollable Trips Carousel */}
        <div className="flex items-center gap-3 overflow-x-auto pb-1 scroll-thin">
          {trips.map((tr) => {
            const isSelected = tr.id === focusedTrip?.id;
            const normType = normalizeVehicleType(tr.cargoType);
            const meta = getVehicleTypeMeta(normType);

            return (
              <button
                key={tr.id}
                onClick={() => {
                  setFocusedTripId(tr.id);
                  selectTrip(tr.id);
                  selectTruck(tr.truckId);
                  setShowFloatingPanel(true);
                }}
                className={cn(
                  "shrink-0 min-w-[220px] p-2.5 rounded-[10px] text-start border transition-all duration-200 flex flex-col justify-between",
                  isSelected
                    ? "bg-brand/12 border-brand shadow-md"
                    : "bg-surface-2 border-border-subtle hover:bg-surface-3"
                )}
              >
                <div className="flex items-center justify-between gap-1 w-full">
                  <span className="font-mono font-bold text-[11.5px] text-text-primary">
                    {tr.tripNumber}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[9.5px] font-bold"
                    style={{ backgroundColor: meta.badgeBg, color: meta.accentColor }}
                  >
                    <TruckTypeIcon truckType={tr.cargoType} size={13} />
                    {meta.arabicName}
                  </span>
                </div>

                <div className="text-[11px] font-medium text-text-secondary truncate mt-1">
                  {tr.originCity} → {tr.destinationCity}
                </div>

                <div className="flex items-center justify-between text-[10px] text-text-muted mt-2 border-t border-white/5 pt-1 tabular-nums">
                  <span>{tr.cargoWeightTons} طن</span>
                  <span className={cn(tr.speedKmH > 0 ? "text-status-active font-semibold" : "")}>
                    {tr.speedKmH > 0 ? `${tr.speedKmH} كم/س` : "في المحطة"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
