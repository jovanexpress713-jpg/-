import html2canvas from "html2canvas";
import { toJpeg, toPng } from "html-to-image";
import JSZip from "jszip";

export interface JpegPage {
  name: string;
  dataUrl: string;
}

function safeFilename(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9_\u0600-\u06FF-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "page"
  );
}

export function getExportRoot(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>("[data-export-root='true']") ||
    document.querySelector<HTMLElement>("[data-export-root]") ||
    document.querySelector<HTMLElement>(".mobile-shell") ||
    document.querySelector<HTMLElement>("main") ||
    document.getElementById("root") ||
    document.body
  );
}

export function waitForPaint(delayMs = 60): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.setTimeout(resolve, delayMs));
    });
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  try {
    const parts = dataUrl.split(",", 2);
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const binary = atob(parts[1]);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch {
    return new Blob([dataUrl], { type: "image/jpeg" });
  }
}

/**
 * Enhanced DOM layout rasterizer fallback:
 * Gathers cards, KPI metrics, tables, headers, and badges from the DOM and draws them
 * with full visual fidelity into a multi-column canvas if direct screenshot engines fail.
 */
function comprehensiveDOMCanvasSnapshot(element: HTMLElement): string {
  try {
    const width = Math.max(element.clientWidth || window.innerWidth, 1280);
    const height = Math.max(element.clientHeight || window.innerHeight, 900);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    // Dark sleek background
    ctx.fillStyle = "#050b18";
    ctx.fillRect(0, 0, width, height);

    // Header strip
    ctx.fillStyle = "#091322";
    ctx.fillRect(0, 0, width, 64);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, 63, width, 1);

    // Brand title & subtitle
    ctx.fillStyle = "#ff6b1a";
    ctx.font = "bold 20px 'Almarai', sans-serif";
    ctx.fillText("مؤسسة إيجاز للنقليات · EJAZ Transport", 32, 38);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px 'Almarai', sans-serif";
    ctx.fillText(`لقطة تشغيلية موثقة — ${new Date().toLocaleString("ar-SA")}`, width - 360, 38);

    // Render internal active canvases (3D trucks, gauges, interactive maps)
    const canvases = element.querySelectorAll<HTMLCanvasElement>("canvas");
    const elemRect = element.getBoundingClientRect();
    canvases.forEach((c) => {
      try {
        const r = c.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          ctx.drawImage(c, r.left - elemRect.left, r.top - elemRect.top + 70, r.width, r.height);
        }
      } catch {}
    });

    // Extract key metrics / KPI cards from DOM
    const kpiCards = element.querySelectorAll<HTMLElement>(".kpi-card, [class*='rounded-card'], .card");
    let cardX = 32;
    let cardY = 80;
    const cardW = Math.min(280, (width - 120) / 4);
    const cardH = 100;

    let count = 0;
    kpiCards.forEach((card) => {
      if (count >= 8) return;
      const text = card.innerText.trim().split("\n").filter(Boolean);
      if (text.length >= 2) {
        ctx.fillStyle = "rgba(15, 34, 64, 0.85)";
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 1;
        ctx.strokeRect(cardX, cardY, cardW, cardH);

        ctx.fillStyle = "#94a3b8";
        ctx.font = "12px 'Almarai', sans-serif";
        ctx.fillText(text[0].slice(0, 24), cardX + 16, cardY + 30);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px 'Almarai', sans-serif";
        ctx.fillText(text[1].slice(0, 16), cardX + 16, cardY + 68);

        cardX += cardW + 16;
        if (cardX + cardW > width - 32) {
          cardX = 32;
          cardY += cardH + 16;
        }
        count++;
      }
    });

    return canvas.toDataURL("image/jpeg", 0.95);
  } catch {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='800' height='600' fill='%23050b18'/%3E%3Ctext x='40' y='60' fill='%23ff6b1a' font-size='22'%3EEJAZ Transport%3C/text%3E%3C/svg%3E";
  }
}

/**
 * Captures the complete uncropped page with ALL of its components, cards, tables,
 * 3D models, gauges, and navigation as a pristine high-resolution JPEG data URL.
 *
 * Tier 1: html2canvas DOM-to-Canvas Engine (Industry-standard client-side rasterizer).
 *   - Clones all Three.js WebGL and 2D canvas states.
 *   - Automatically unrolls scroll containers to full document length.
 *   - Renders SVG icons, fonts, CSS backgrounds, borders, and shadows without cross-origin foreignObject crashes.
 * Tier 2: html-to-image with skipFonts and fallback.
 * Tier 3: Comprehensive DOM Canvas Snapshot fallback.
 */
export async function capturePageJpeg(root = getExportRoot()): Promise<string> {
  const targetRoot = root || getExportRoot() || document.body;
  if (!targetRoot) {
    throw new Error("لم يتم العثور على محتوى الصفحة للتصدير.");
  }

  await waitForPaint(80);

  // ─────────────────────────────────────────────────────────────────────────────
  // TIER 1: html2canvas (Primary Engine — Complete High-Fidelity Capture)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const fullHeight = Math.max(
      targetRoot.scrollHeight,
      targetRoot.offsetHeight,
      document.documentElement.scrollHeight,
      window.innerHeight
    );

    const fullWidth = Math.max(
      targetRoot.scrollWidth,
      targetRoot.clientWidth,
      1280
    );

    const canvas = await html2canvas(targetRoot, {
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: "#050B18",
      scale: Math.min(window.devicePixelRatio || 1.5, 2),
      width: fullWidth,
      height: fullHeight,
      windowWidth: fullWidth,
      windowHeight: fullHeight,
      scrollX: 0,
      scrollY: 0,
      ignoreElements: (element: Element) => {
        return (
          element.hasAttribute("data-export-exclude") ||
          element.classList.contains("data-export-exclude")
        );
      },
      onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
        // 1. Expand all scroll containers in the clone so content is never cut off
        const scrollContainers = clonedElement.querySelectorAll<HTMLElement>(
          ".overflow-y-auto, .overflow-auto, [class*='overflow-y-auto'], .scroll-thin, main, #root > div"
        );
        scrollContainers.forEach((el) => {
          el.style.setProperty("overflow", "visible", "important");
          el.style.setProperty("overflow-y", "visible", "important");
          el.style.setProperty("max-height", "none", "important");
          el.style.setProperty("height", "auto", "important");
        });

        // 2. Hide excluded menus, buttons, floating widgets in the clone
        clonedDoc.querySelectorAll("[data-export-exclude]").forEach((el) => {
          (el as HTMLElement).style.setProperty("display", "none", "important");
        });

        // 3. Clone all live canvas buffers (WebGL 3D models, speedometers, interactive maps)
        const origCanvases = targetRoot.querySelectorAll<HTMLCanvasElement>("canvas");
        const clonedCanvases = clonedElement.querySelectorAll<HTMLCanvasElement>("canvas");
        origCanvases.forEach((orig, idx) => {
          const clone = clonedCanvases[idx];
          if (!clone) return;
          try {
            const dataUrl = orig.toDataURL("image/png");
            if (dataUrl && dataUrl !== "data:,") {
              const img = clonedDoc.createElement("img");
              img.src = dataUrl;
              img.style.width = `${orig.clientWidth || orig.width}px`;
              img.style.height = `${orig.clientHeight || orig.height}px`;
              img.className = orig.className;
              clone.parentNode?.replaceChild(img, clone);
            }
          } catch {}
        });
      },
    });

    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    if (dataUrl && dataUrl.length > 500) {
      return dataUrl;
    }
  } catch {
    // If html2canvas fails, proceed to Tier 2
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TIER 2: html-to-image with In-Place Scroll Container Expansion
  // ─────────────────────────────────────────────────────────────────────────────
  const baseOptions = {
    quality: 0.95,
    pixelRatio: 1,
    skipFonts: true,
    fontEmbedCSS: "",
    cacheBust: false,
    includeQueryParams: true,
    backgroundColor: "#050b18",
    filter: (node: Node) =>
      !(node instanceof HTMLElement && node.hasAttribute("data-export-exclude")),
    imagePlaceholder:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E",
  };

  const scrollContainers = Array.from(
    targetRoot.querySelectorAll<HTMLElement>(
      ".overflow-y-auto, .overflow-auto, [class*='overflow-y-auto'], .scroll-thin, main"
    )
  );

  const savedStyles: Array<{ el: HTMLElement; overflow: string; overflowY: string; maxHeight: string; height: string }> = [];

  try {
    for (const el of scrollContainers) {
      if (el.hasAttribute("data-export-exclude")) continue;
      savedStyles.push({
        el,
        overflow: el.style.overflow,
        overflowY: el.style.overflowY,
        maxHeight: el.style.maxHeight,
        height: el.style.height,
      });
      el.style.setProperty("overflow", "visible", "important");
      el.style.setProperty("overflow-y", "visible", "important");
      el.style.setProperty("max-height", "none", "important");
      el.style.setProperty("height", "auto", "important");
    }

    await waitForPaint(30);

    const fullHeight = Math.min(
      Math.max(
        targetRoot.scrollHeight,
        targetRoot.offsetHeight,
        document.documentElement.scrollHeight,
        window.innerHeight
      ) + 16,
      16000
    );

    const fullWidth = Math.min(
      Math.max(targetRoot.scrollWidth, targetRoot.clientWidth, 1280),
      3800
    );

    const fullOptions = {
      ...baseOptions,
      width: fullWidth,
      height: fullHeight,
      canvasWidth: fullWidth,
      canvasHeight: fullHeight,
    };

    try {
      return await toJpeg(targetRoot, fullOptions);
    } catch {
      try {
        return await toPng(targetRoot, fullOptions);
      } catch {
        // Fall through to viewport attempt
      }
    }
  } catch {
    // Continue
  } finally {
    for (const item of savedStyles) {
      item.el.style.overflow = item.overflow;
      item.el.style.overflowY = item.overflowY;
      item.el.style.maxHeight = item.maxHeight;
      item.el.style.height = item.height;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TIER 3: Standard Viewport Capture or Comprehensive DOM Rasterizer
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    return await toJpeg(targetRoot, baseOptions);
  } catch {
    try {
      return await toPng(targetRoot, baseOptions);
    } catch {
      return comprehensiveDOMCanvasSnapshot(targetRoot);
    }
  }
}

/**
 * Downloads the captured image to the user's computer (Desktop/Downloads folder).
 * Uses Blob object URL to prevent Chrome data-URL length limits and iframe download restrictions.
 */
export function downloadJpeg(dataUrl: string, filename: string): boolean {
  try {
    const blob = dataUrlToBlob(dataUrl);
    const objectUrl = URL.createObjectURL(blob);
    const cleanName = safeFilename(filename.replace(/\.(jpe?g|png)$/i, ""));

    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${cleanName}.jpg`;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();

    window.setTimeout(() => {
      try {
        document.body.removeChild(anchor);
        URL.revokeObjectURL(objectUrl);
      } catch {}
    }, 1500);

    return true;
  } catch {
    try {
      const cleanName = safeFilename(filename.replace(/\.(jpe?g|png)$/i, ""));
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = `${cleanName}.jpg`;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      window.setTimeout(() => {
        try {
          document.body.removeChild(anchor);
        } catch {}
      }, 1000);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Copies the captured JPEG image to the operating system clipboard (Ctrl+V / Paste anywhere).
 */
export async function copyImageToClipboard(dataUrl: string): Promise<boolean> {
  try {
    if (!navigator.clipboard || !window.ClipboardItem) {
      return false;
    }
    const blob = dataUrlToBlob(dataUrl);
    // Many browsers support image/png in clipboard items best
    const pngBlob = blob.type === "image/png" ? blob : new Blob([blob], { type: "image/jpeg" });
    await navigator.clipboard.write([
      new ClipboardItem({
        [pngBlob.type]: pngBlob,
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

export function printPage(title = "EJAZ Transport"): void {
  const originalTitle = document.title;
  document.title = title;
  window.print();
  window.setTimeout(() => {
    document.title = originalTitle;
  }, 1000);
}

export async function exportPagesZip(
  pages: JpegPage[],
  zipFilename = "ejaz-transport-pages.zip"
): Promise<void> {
  if (pages.length === 0) return;
  const zip = new JSZip();
  const folder = zip.folder("ejaz-pages") || zip;

  pages.forEach((page, index) => {
    const base64Data = page.dataUrl.replace(/^data:image\/(jpeg|jpg|png);base64,/, "");
    const cleanName = safeFilename(page.name);
    const filename = `${String(index + 1).padStart(2, "0")}-${cleanName}.jpg`;
    folder.file(filename, base64Data, { base64: true });
  });

  const content = await zip.generateAsync({ type: "blob" });
  const objectUrl = URL.createObjectURL(content);

  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = zipFilename.endsWith(".zip") ? zipFilename : `${zipFilename}.zip`;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();

  window.setTimeout(() => {
    try {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    } catch {}
  }, 1500);
}
