import { useState, useEffect } from "react";
import { cn } from "../utils/cn";
import { useVehicleAssets } from "../state/vehicleAssetStore";
import type { CanonicalVehicleTypeId } from "../data/vehicleTypes";

/**
 * EJAZ Transport — Official Vehicle Image Renderer.
 *
 * Resolution order (Single Source of Truth):
 *   1. an explicit `src` override
 *   2. the vehicle's published photograph (Vehicle Asset Registry)
 *   3. the vehicle's stored custom image
 *   4. the OFFICIAL image of its approved category (سطحة / براد / جاف / ستارة)
 *
 * The same resolution runs in the Android app and in the admin control room,
 * so a single published asset appears everywhere identically.
 */
export function TruckImage({
  src,
  vehicle,
  body,
  alt = "شاحنة إيجاز للنقليات",
  className,
  loading = "lazy",
}: {
  src?: string;
  vehicle?: { id?: string; body: CanonicalVehicleTypeId | string; customImage?: string | null };
  body?: CanonicalVehicleTypeId | string;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const { vehicleImage, typeImage } = useVehicleAssets();

  const primarySrc = src
    ? src
    : vehicle
      ? vehicleImage(vehicle as any)
      : body
        ? typeImage(body)
        : typeImage("curtain");

  const [currentSrc, setCurrentSrc] = useState(primarySrc);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrentSrc(primarySrc);
    setFailed(false);
  }, [primarySrc]);

  const fallbackSrc = typeImage(vehicle?.body || body || "curtain");

  return (
    <img
      src={currentSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      loading={loading}
      onError={() => {
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        } else if (!failed) {
          setFailed(true);
        }
      }}
      draggable={false}
      className={cn(
        "truck-plate pointer-events-none select-none object-contain",
        failed && "opacity-60",
        className,
      )}
    />
  );
}
