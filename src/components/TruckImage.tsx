import { useState, useEffect } from "react";
import { cn } from "../utils/cn";
import {
  resolveVehicleImage,
  getVehicleOfficialImage,
  type CanonicalVehicleTypeId,
} from "../data/vehicleTypes";

/**
 * Renders the Official Vehicle Image or Custom Vehicle Image
 * through the central Single Source of Truth asset pipeline.
 */
export function TruckImage({
  src,
  vehicle,
  body,
  alt = "شاحنة إيجاز للنقليات",
  className,
}: {
  src?: string;
  vehicle?: { body: CanonicalVehicleTypeId; customImage?: string | null };
  body?: CanonicalVehicleTypeId;
  alt?: string;
  className?: string;
}) {
  const primarySrc =
    src ||
    (vehicle
      ? resolveVehicleImage(vehicle)
      : body
      ? getVehicleOfficialImage(body)
      : "/images/trucks/mb-curtain.jpg");

  const [currentSrc, setCurrentSrc] = useState(primarySrc);

  useEffect(() => {
    setCurrentSrc(primarySrc);
  }, [primarySrc]);

  const targetBody = vehicle?.body || body || "curtain";
  const defaultFallback =
    targetBody === "flatbed"
      ? "/images/trucks/scania-flatbed.jpg"
      : targetBody === "reefer"
      ? "/images/trucks/mb-reefer.jpg"
      : targetBody === "dry"
      ? "/images/trucks/volvo-container.jpg"
      : "/images/trucks/mb-curtain.jpg";

  return (
    <img
      src={currentSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => {
        if (currentSrc !== defaultFallback) {
          setCurrentSrc(defaultFallback);
        }
      }}
      draggable={false}
      className={cn("truck-plate pointer-events-none select-none object-contain", className)}
    />
  );
}
