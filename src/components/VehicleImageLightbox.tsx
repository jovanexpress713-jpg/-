import { useEffect } from "react";
import { useSettings } from "../settings";
import { IconClose } from "./Icons";

/**
 * EJAZ Transport — simple document/image lightbox.
 * Opens an attached registration document (image or PDF) without leaving the
 * console, matching the existing dark console styling.
 */
export function VehicleImageLightbox({
  src,
  isPdf: isPdfProp = false,
  onClose,
}: {
  src: string;
  isPdf?: boolean;
  onClose: () => void;
}) {
  const { t } = useSettings();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isPdf = isPdfProp || /\.pdf($|\?)/i.test(src);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        className="absolute top-4 end-4 rounded-full border border-white/15 bg-black/60 p-2 text-white transition-colors hover:text-brand"
        aria-label={t("Close", "إغلاق")}
      >
        <IconClose size={18} />
      </button>

      {isPdf ? (
        <iframe
          src={src}
          title={t("Document", "مستند")}
          onClick={(e) => e.stopPropagation()}
          className="h-full w-full max-w-[900px] rounded-[12px] border border-white/10 bg-white"
        />
      ) : (
        <img
          src={src}
          alt={t("Request document", "مستند الطلب")}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-[12px] border border-white/10 object-contain"
        />
      )}
    </div>
  );
}
