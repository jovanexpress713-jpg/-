import { useState, useEffect } from "react";
import { cn } from "../utils/cn";
import { useVehicleAssets } from "../state/vehicleAssetStore";
import type { CanonicalVehicleTypeId } from "../data/vehicleTypes";

/**
 * Weight optimisation: every official photograph ships with a WebP derivative
 * (~85% smaller) used purely for display, while the published PNG remains the
 * official asset, untouched. If the browser cannot decode WebP (or the file is
 * missing) the renderer falls back to the original PNG automatically.
 */
function lightWeight(src: string): string {
  return src.replace(/(\/images\/trucks\/official\/official-[a-z-]+)\.png$/i, "$1.webp");
}

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
  vehicle?: { id?: string; body?: CanonicalVehicleTypeId | string | null; customImage?: string | null };
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

  const optimizedSrc = lightWeight(primarySrc);
  const [currentSrc, setCurrentSrc] = useState(optimizedSrc);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrentSrc(lightWeight(primarySrc));
    setFailed(false);
  }, [primarySrc]);

  const fallbackSrc = typeImage(vehicle?.body || body || "curtain");

  const handleError = () => {
    // 1) WebP not supported / missing → serve the official PNG as-is
    if (currentSrc !== primarySrc) {
      setCurrentSrc(primarySrc);
      return;
    }
    // 2) The published asset is unavailable → fall back to the category asset
    const nextFallback = lightWeight(fallbackSrc);
    if (currentSrc !== nextFallback) {
      setCurrentSrc(nextFallback);
      return;
    }
    setFailed(true);
  };

  return (
    <img
      src={currentSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      loading={loading}
      onError={handleError}
      draggable={false}
      className={cn(
        "truck-plate pointer-events-none select-none object-contain",
        failed && "opacity-60",
        className,
      )}
    />
  );
}
