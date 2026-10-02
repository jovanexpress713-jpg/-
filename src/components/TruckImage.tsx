import { cn } from "../utils/cn";

/**
 * Grey monochrome studio plates are authored on a pure black canvas,
 * so they are composited with `lighten` over our dark surfaces.
 */
export function TruckImage({
  src,
  alt = "",
  className,
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={cn("truck-plate pointer-events-none select-none", className)}
    />
  );
}
