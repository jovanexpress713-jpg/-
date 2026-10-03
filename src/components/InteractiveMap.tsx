import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { useSettings } from "../settings";
import { SAUDI_CORRIDORS } from "../services/gpsSimulation";
import type { Trip } from "../state/fleetStore";
import { Operational3DScene } from "./Operational3DScene";
import {
  IconLayers,
  IconZoomIn,
  IconZoomOut,
  IconPin,
  IconTruck,
} from "./Icons";
import { TruckTypeIcon, TruckTypeBadge } from "./TruckTypeIcon";

interface InteractiveMapProps {
  trip: Trip;
  className?: string;
  compact?: boolean;
  accent?: boolean;
  showCardOverlay?: boolean;
  onWaypointClick?: (wpName: string) => void;
}

export function InteractiveMap({
  trip,
  className,
  compact = false,
  accent = false,
  showCardOverlay = true,
  onWaypointClick,
}: InteractiveMapProps) {
  const { t, dir } = useSettings();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Map state
  const [zoom, setZoom] = useState(compact ? 1.1 : 1.35);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [mapLayer, setMapLayer] = useState<"logistics" | "satellite" | "google" | "3d_scene">("logistics");
  const [hoveredWaypoint] = useState<string | null>(null);
  const [selectedPin] = useState<{ name: string; lat: number; lng: number } | null>(null);

  const corridor = SAUDI_CORRIDORS[trip.corridorKey] || SAUDI_CORRIDORS["riyadh-jeddah"];
  const strokeColor = accent ? "#2F80FF" : "#FF7A00";

  // Projection: Saudi Lat/Lng to Canvas pixels
  // Center roughly at Riyadh (24.7, 46.7) with K scaling
  const projectCoords = (
    lat: number,
    lng: number,
    width: number,
    height: number
  ): [number, number] => {
    // Saudi bounds: Lat 16 to 32, Lng 34 to 56
    const minLat = 16.5;
    const maxLat = 31.5;
    const minLng = 34.5;
    const maxLng = 55.5;

    const xRatio = (lng - minLng) / (maxLng - minLng);
    const yRatio = 1 - (lat - minLat) / (maxLat - minLat);

    const baseCenterX = width * 0.5 + pan.x;
    const baseCenterY = height * 0.5 + pan.y;

    const x = baseCenterX + (xRatio - 0.5) * width * 1.6 * zoom;
    const y = baseCenterY + (yRatio - 0.5) * height * 1.6 * zoom;

    return [x, y];
  };

  // Recenter on active truck
  const recenter = () => {
    setPan({ x: 0, y: 0 });
    setZoom(compact ? 1.1 : 1.4);
  };

  // Canvas drawing loop
  useEffect(() => {
    if (mapLayer === "google") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;

    const render = () => {
      const width = canvas.parentElement?.clientWidth || 600;
      const height = canvas.parentElement?.clientHeight || 400;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      // 1) Background canvas
      ctx.fillStyle = mapLayer === "satellite" ? "#060f1b" : "#091527";
      ctx.fillRect(0, 0, width, height);

      // 2) Graticule grid lines
      ctx.strokeStyle = "rgba(41, 65, 96, 0.28)";
      ctx.lineWidth = 1;
      const gridSize = 45 * zoom;
      const offsetX = (pan.x % gridSize);
      const offsetY = (pan.y % gridSize);

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

      // 3) Major Cities
      const CITIES: [string, number, number][] = [
        ["الرياض", 24.7136, 46.6753],
        ["جدة", 21.4858, 39.1925],
        ["الدمام", 26.4207, 50.0888],
        ["مكة المكرمة", 21.3891, 39.8579],
        ["المدينة المنورة", 24.5247, 39.6125],
        ["الجبيل", 27.0046, 50.1029],
        ["تبوك", 28.3835, 36.5667],
        ["نيوم", 28.0000, 35.4000],
        ["حائل", 27.5167, 41.7000],
        ["أبها", 18.2167, 42.5000],
        ["الطائف", 21.2667, 40.4167],
      ];

      CITIES.forEach(([cityName, cLat, cLng]) => {
        const [cx, cy] = projectCoords(cLat, cLng, width, height);
        if (cx < -40 || cx > width + 40 || cy < -40 || cy > height + 40) return;

        // City halo
        ctx.fillStyle = "rgba(110, 126, 150, 0.45)";
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = "rgba(167, 180, 201, 0.85)";
        ctx.font = "10.5px 'Tajawal', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(cityName, cx, cy - 6);
      });

      // 4) Highway Route Path (Dashed Pending vs Glowing Traveled)
      const points = corridor.points;
      if (points.length >= 2) {
        // Full corridor line (background dashed)
        ctx.beginPath();
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = "rgba(110, 126, 150, 0.35)";
        ctx.lineWidth = 3.5;
        const [startX, startY] = projectCoords(points[0][0], points[0][1], width, height);
        ctx.moveTo(startX, startY);

        for (let i = 1; i < points.length; i++) {
          const [px, py] = projectCoords(points[i][0], points[i][1], width, height);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Active traveled glowing path up to current truck position
        const [truckX, truckY] = projectCoords(trip.currentLat, trip.currentLng, width, height);

        ctx.save();
        ctx.shadowColor = strokeColor;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(startX, startY);

        // Find segments up to truck
        for (let i = 1; i < points.length; i++) {
          const [px, py] = projectCoords(points[i][0], points[i][1], width, height);
          // if points are roughly before truck
          if (i < points.length * (trip.progressPct / 100)) {
            ctx.lineTo(px, py);
          } else {
            ctx.lineTo(truckX, truckY);
            break;
          }
        }
        ctx.stroke();
        ctx.restore();
      }

      // 5) Waypoints (Tolls, Weighbridges, Terminals)
      corridor.waypoints.forEach((wp) => {
        const [wx, wy] = projectCoords(wp.lat, wp.lng, width, height);
        const isHovered = hoveredWaypoint === wp.nameAr;

        ctx.save();
        ctx.fillStyle = wp.type === "terminal" ? strokeColor : "#2FD08A";
        ctx.beginPath();
        ctx.arc(wx, wy, isHovered ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#0A1931";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Waypoint name banner if hovered or terminal
        if (isHovered || wp.type === "terminal" || zoom > 1.6) {
          ctx.fillStyle = "rgba(10, 25, 49, 0.9)";
          const text = wp.nameAr;
          ctx.font = "10px 'Tajawal', sans-serif";
          const tw = ctx.measureText(text).width;
          ctx.fillRect(wx - tw / 2 - 4, wy + 8, tw + 8, 16);
          ctx.fillStyle = "#EAF0FA";
          ctx.textAlign = "center";
          ctx.fillText(text, wx, wy + 20);
        }
        ctx.restore();
      });

      // 6) 3D ISOMETRIC / ROTATED TRUCK MODEL WITH HEADING & CARGO
      const [tx, ty] = projectCoords(trip.currentLat, trip.currentLng, width, height);

      ctx.save();
      ctx.translate(tx, ty);

      // Rotate canvas by truck's live GPS heading
      const rad = ((trip.headingDeg - 90) * Math.PI) / 180;
      ctx.rotate(rad);

      // Truck Ground Shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.beginPath();
      ctx.ellipse(0, 3, 24, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Trailer (matching 4 canonical cargo types)
      const trailerColor =
        trip.cargoType === "reefer"
          ? "#EAF0FA" // White thermal box
          : trip.cargoType === "dry"
          ? "#2F80FF" // Blue container / dry box
          : trip.cargoType === "flatbed"
          ? "#FF7A00" // Flatbed industrial orange
          : strokeColor; // Curtain / standard

      // Draw Trailer chassis & body
      ctx.fillStyle = trailerColor;
      ctx.strokeStyle = "#0A1931";
      ctx.lineWidth = 1.5;

      // Trailer Box (-22 to 2 px)
      ctx.fillRect(-22, -7, 24, 14);
      ctx.strokeRect(-22, -7, 24, 14);

      // Detail accents for trailer types
      if (trip.cargoType === "flatbed") {
        // Flatbed steel straps
        ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
        ctx.beginPath();
        ctx.moveTo(-16, -7); ctx.lineTo(-16, 7);
        ctx.moveTo(-8, -7); ctx.lineTo(-8, 7);
        ctx.moveTo(0, -7); ctx.lineTo(0, 7);
        ctx.stroke();
      } else if (trip.cargoType === "reefer") {
        // Reefer unit on front
        ctx.fillStyle = "#A7B4C9";
        ctx.fillRect(-2, -4, 4, 8);
      }

      // Truck Tractor Cabin (5 to 16 px)
      ctx.fillStyle = strokeColor;
      ctx.fillRect(3, -6.5, 12, 13);
      ctx.strokeRect(3, -6.5, 12, 13);

      // Windshield (glass reflection)
      ctx.fillStyle = "#0A1931";
      ctx.fillRect(10, -5, 4, 10);

      // Dual wheels
      ctx.fillStyle = "#1E252F";
      ctx.fillRect(-18, -9, 6, 2.5); // Rear left
      ctx.fillRect(-18, 6.5, 6, 2.5); // Rear right
      ctx.fillRect(-6, -9, 6, 2.5); // Middle left
      ctx.fillRect(-6, 6.5, 6, 2.5); // Middle right
      ctx.fillRect(6, -8.5, 5, 2.5); // Front left
      ctx.fillRect(6, 6, 5, 2.5); // Front right

      // Cargo fill strip indicator on roof
      const fillRatio = Math.min(1, trip.cargoWeightTons / trip.maxCapacityTons);
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.fillRect(-20, -1.5, 20 * fillRatio, 3);

      ctx.restore();

      // Radar Pulse ring around truck
      const pulse = (Date.now() / 800) % 1;
      ctx.save();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.8;
      ctx.globalAlpha = 1 - pulse;
      ctx.beginPath();
      ctx.arc(tx, ty, 14 + pulse * 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Small pin hover / selection info
      if (selectedPin) {
        const [px, py] = projectCoords(selectedPin.lat, selectedPin.lng, width, height);
        ctx.fillStyle = "#0A1931";
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.fillRect(px - 60, py - 36, 120, 26);
        ctx.strokeRect(px - 60, py - 36, 120, 26);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "11px 'Tajawal', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(selectedPin.name, px, py - 20);
      }

      animFrame = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animFrame);
  }, [trip, zoom, pan, mapLayer, hoveredWaypoint, selectedPin, strokeColor]);

  // Mouse & Touch Pan Handling
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });

    if (onWaypointClick) {
      onWaypointClick(trip.nextWaypointAr);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.12 : -0.12;
    setZoom((z) => Math.max(0.7, Math.min(3.2, +(z + delta).toFixed(2))));
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[14px] bg-surface-1 border border-border-subtle select-none",
        isDragging ? "cursor-grabbing" : "cursor-grab",
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* 1) Canvas Map View or 3D Operational Stage or Google Maps */}
      {mapLayer === "3d_scene" ? (
        <Operational3DScene trip={trip} className="h-full w-full" />
      ) : mapLayer !== "google" ? (
        <canvas ref={canvasRef} className="h-full w-full block" />
      ) : (
        <div className="relative h-full w-full bg-surface-2">
          <div className="pointer-events-none absolute top-14 start-3 z-10 flex items-center gap-1.5 rounded-full bg-navy/90 px-3 py-1 text-[10.5px] font-semibold text-brand backdrop-blur-md border border-brand/30 shadow-md">
            <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
            <span>{t("Maps Dev Adapter · Live GPS", "وضع تطوير الخرائط · تتبع مباشر")}</span>
          </div>
          <iframe
            title="Google Maps Live GPS"
            src={`https://maps.google.com/maps?q=${trip.currentLat},${trip.currentLng}&z=8&output=embed`}
            className="h-full w-full border-0"
            style={{ filter: "saturate(0.9) contrast(1.05)" }}
            loading="lazy"
          />
        </div>
      )}

      {/* 2) Top Floating Telemetry Capsule */}
      {showCardOverlay && (
        <div
          className={cn(
            "pointer-events-auto absolute top-3 flex items-center gap-2.5 rounded-full bg-navy/85 px-4 py-2 text-white shadow-xl backdrop-blur-md border border-white/10 text-[11.5px]",
            dir === "rtl" ? "right-3" : "left-3"
          )}
        >
          <span className="flex items-center gap-1.5 font-bold text-brand">
            <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
            {trip.tripNumber}
          </span>
          <span className="text-white/40">|</span>
          <span className="text-white/90">
            {trip.originCity} → {trip.destinationCity}
          </span>
          <span className="text-white/40">|</span>
          <span className="font-semibold tabular-nums text-status-active">
            {trip.speedKmH} {t("km/h", "كم/س")}
          </span>
          <span className="text-white/40">|</span>
          <span className="tabular-nums text-white/70">
            {trip.distanceRemainingKm} {t("km left", "كم متبقي")}
          </span>
        </div>
      )}

      {/* 3) Floating Map Controls */}
      <div className="absolute top-3 end-3 flex flex-col items-center gap-1.5 z-20">
        {!compact && (
          <>
            <button
              onClick={() => setZoom((z) => Math.min(3.2, +(z + 0.2).toFixed(2)))}
              className="btn-icon-sm bg-navy/85 text-white shadow-lg backdrop-blur-md hover:bg-brand hover:text-navy border border-white/10"
              title={t("Zoom In", "تكبير")}
            >
              <IconZoomIn size={15} />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.2).toFixed(2)))}
              className="btn-icon-sm bg-navy/85 text-white shadow-lg backdrop-blur-md hover:bg-brand hover:text-navy border border-white/10"
              title={t("Zoom Out", "تصغير")}
            >
              <IconZoomOut size={15} />
            </button>
            <button
              onClick={recenter}
              className="btn-icon-sm bg-navy/85 text-white shadow-lg backdrop-blur-md hover:bg-brand hover:text-navy border border-white/10"
              title={t("Recenter on Truck", "إعادة التمركز على الشاحنة")}
            >
              <IconPin size={15} />
            </button>
          </>
        )}

        {/* 3D Scene View Toggle */}
        <button
          onClick={() =>
            setMapLayer((cur) => (cur === "3d_scene" ? "logistics" : "3d_scene"))
          }
          className={cn(
            "btn-icon-sm shadow-lg backdrop-blur-md hover:scale-105 border transition-all",
            mapLayer === "3d_scene"
              ? "bg-brand text-on-brand border-brand"
              : "bg-navy/85 text-white/80 border-white/10"
          )}
          title={t("Toggle 3D Operational Stage Scene", "عرض المشهد التشغيلي ثلاثي الأبعاد")}
        >
          <span className="text-[10px] font-extrabold">3D</span>
        </button>

        {/* Map Layers Dropdown Button */}
        <button
          onClick={() =>
            setMapLayer((cur) =>
              cur === "logistics" ? "google" : cur === "google" ? "satellite" : "logistics"
            )
          }
          className="btn-icon-sm bg-navy/85 text-brand shadow-lg backdrop-blur-md hover:scale-105 border border-brand/30"
          title={t("Toggle Layer: Vector / Google / Satellite", "تبديل الطبقة: تفاعلية / جوجل / قمر صناعي")}
        >
          <IconLayers size={15} />
        </button>
      </div>

      {/* 4) Bottom Live Heading & Waypoint Strip */}
      <div
        className={cn(
          "pointer-events-auto absolute bottom-3 inset-x-3 flex items-center justify-between gap-2 rounded-[10px] bg-navy/90 px-3.5 py-2 text-white text-[11px] backdrop-blur-md border border-white/10",
          compact && "hidden"
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <TruckTypeIcon truckType={trip.cargoType} size={16} className="text-brand shrink-0" />
          <span className="truncate text-white/90">
            {t("Next Waypoint:", "المحطة القادمة:")}{" "}
            <strong className="text-brand font-semibold">{trip.nextWaypointAr}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 tabular-nums">
          <span className="text-white/60">
            {t("Heading:", "الاتجاه:")} {trip.headingDeg}°
          </span>
          <a
            href={`https://www.google.com/maps?q=${trip.currentLat},${trip.currentLng}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-brand hover:underline"
          >
            {t("Open Google Maps", "خرائط Google")} ↗
          </a>
        </div>
      </div>
    </div>
  );
}
