import { toJpeg } from "html-to-image";
import JSZip from "jszip";

export interface JpegPage {
  name: string;
  dataUrl: string;
}

function safeFilename(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "page";
}

export function getExportRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-export-root]");
}

export function waitForPaint(delayMs = 180): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.setTimeout(resolve, delayMs));
    });
  });
}

async function waitForFontsAndImages(root: HTMLElement): Promise<void> {
  const fontReady = "fonts" in document ? document.fonts.ready.catch(() => undefined) : Promise.resolve();
  const imageReady = Promise.all(
    Array.from(root.querySelectorAll("img"), async (image) => {
      if (image.complete) return;
      await new Promise<void>((resolve) => {
        const finish = () => resolve();
        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
        window.setTimeout(finish, 1800);
      });
    }),
  );
  await Promise.race([
    Promise.all([fontReady, imageReady]),
    new Promise<void>((resolve) => window.setTimeout(resolve, 2200)),
  ]);
}

interface ExportClone {
  stage: HTMLDivElement;
  root: HTMLElement;
}

/**
 * Creates an off-screen copy of the app's export surface. The live app is not
 * resized or scrolled during capture. Ancestor shells are copied (shallowly) so
 * inherited direction, theme classes and layout selectors still apply.
 */
function createFullPageClone(source: HTMLElement): ExportClone {
  const sourceRect = source.getBoundingClientRect();
  const viewportWidth = Math.ceil(Math.max(source.clientWidth, source.scrollWidth, sourceRect.width, 1));
  const stage = document.createElement("div");
  stage.setAttribute("aria-hidden", "true");
  stage.dataset.exportCaptureStage = "true";
  Object.assign(stage.style, {
    position: "fixed",
    top: "0",
    left: "-100000px",
    zIndex: "-2147483647",
    display: "block",
    width: `${viewportWidth}px`,
    height: "auto",
    overflow: "visible",
    visibility: "visible",
    pointerEvents: "none",
    contain: "none",
  });

  // Preserve the DOM ancestry that supplies theme and direction attributes.
  const ancestors: HTMLElement[] = [];
  for (let parent = source.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    ancestors.unshift(parent);
  }
  let parent: HTMLElement = stage;
  for (const ancestor of ancestors) {
    const shell = ancestor.cloneNode(false) as HTMLElement;
    shell.style.setProperty("position", "static", "important");
    shell.style.setProperty("width", `${viewportWidth}px`, "important");
    shell.style.setProperty("height", "auto", "important");
    shell.style.setProperty("min-height", "0", "important");
    shell.style.setProperty("max-height", "none", "important");
    shell.style.setProperty("overflow", "visible", "important");
    shell.style.setProperty("transform", "none", "important");
    shell.style.setProperty("contain", "none", "important");
    parent.appendChild(shell);
    parent = shell;
  }

  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.setProperty("position", "relative", "important");
  clone.style.setProperty("width", `${viewportWidth}px`, "important");
  clone.style.setProperty("height", "auto", "important");
  clone.style.setProperty("min-height", "0", "important");
  clone.style.setProperty("max-height", "none", "important");
  clone.style.setProperty("overflow", "visible", "important");
  clone.style.setProperty("flex", "none", "important");
  clone.style.setProperty("transform", "none", "important");
  clone.style.setProperty("contain", "none", "important");
  parent.appendChild(clone);
  document.body.appendChild(stage);

  // Expand nested scroll containers in the clone, bottom-up. Their full scroll
  // extent is preserved while the original viewport and scroll position remain
  // untouched. Repeat because expanding a child can increase its ancestors.
  const sourceNodes = [source, ...Array.from(source.querySelectorAll<HTMLElement>("*"))];
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))];
  const count = Math.min(sourceNodes.length, cloneNodes.length);
  for (let pass = 0; pass < 4; pass += 1) {
    for (let index = count - 1; index >= 0; index -= 1) {
      const original = sourceNodes[index];
      const target = cloneNodes[index];
      if (!original || !target || target.hasAttribute("data-export-exclude")) continue;
      const style = getComputedStyle(original);
      const verticalClip = /^(auto|scroll|hidden|clip)$/.test(style.overflowY);
      const horizontalClip = /^(auto|scroll|hidden|clip)$/.test(style.overflowX);
      const needsMoreHeight = Math.max(original.scrollHeight, target.scrollHeight) > target.clientHeight + 2;
      const needsMoreWidth = Math.max(original.scrollWidth, target.scrollWidth) > target.clientWidth + 2;

      if (verticalClip && needsMoreHeight) {
        target.style.setProperty("overflow-y", "visible", "important");
        target.style.setProperty("max-height", "none", "important");
        target.style.setProperty("height", "auto", "important");
        target.style.setProperty("min-height", "0", "important");
        target.style.setProperty("flex-shrink", "0", "important");
      }
      if (horizontalClip && needsMoreWidth) {
        target.style.setProperty("overflow-x", "visible", "important");
        target.style.setProperty("max-width", "none", "important");
        target.style.setProperty("width", `${Math.max(original.scrollWidth, target.scrollWidth)}px`, "important");
        target.style.setProperty("flex-shrink", "0", "important");
      }
      if (style.position === "sticky" || style.position === "fixed") {
        target.style.setProperty("position", "static", "important");
        target.style.setProperty("inset", "auto", "important");
      }
    }
  }

  // One final pass clears overflow on ancestors that became clipping only after
  // a nested panel was expanded.
  for (let index = count - 1; index >= 0; index -= 1) {
    const original = sourceNodes[index];
    const target = cloneNodes[index];
    if (!original || !target || target.hasAttribute("data-export-exclude")) continue;
    if (target.scrollHeight > target.clientHeight + 2 && getComputedStyle(original).overflowY !== "visible") {
      target.style.setProperty("overflow-y", "visible", "important");
      target.style.setProperty("max-height", "none", "important");
      target.style.setProperty("height", "auto", "important");
    }
  }

  return { stage, root: clone };
}

/**
 * Exports the complete current screen as one JPG. A detached, off-screen clone
 * expands nested scroll panels so long pages and tables are not cropped to the
 * current viewport. The DOM the user sees is never changed.
 */
export async function capturePageJpeg(root = getExportRoot()): Promise<string> {
  if (!root || !root.isConnected) throw new Error("لم يتم العثور على محتوى الصفحة للتصدير.");
  await waitForPaint(80);
  await waitForFontsAndImages(root);
  const capture = createFullPageClone(root);

  try {
    await waitForFontsAndImages(capture.root);
    await waitForPaint(40);
    const width = Math.ceil(Math.max(capture.root.scrollWidth, capture.root.clientWidth));
    const height = Math.ceil(Math.max(capture.root.scrollHeight, capture.root.clientHeight));
    if (width < 2 || height < 2) throw new Error("أبعاد الصفحة غير صالحة للتصوير.");
    if (height > 28000 || width > 12000) {
      throw new Error("أبعاد الصفحة كبيرة جداً لصورة واحدة؛ استخدم الطباعة أو صدّر الأقسام على حدة.");
    }

    return await toJpeg(capture.root, {
      quality: 0.94,
      pixelRatio: 1,
      width,
      height,
      canvasWidth: width,
      canvasHeight: height,
      cacheBust: true,
      backgroundColor: getComputedStyle(root).backgroundColor || "#07111f",
      filter: (node) => !node.hasAttribute("data-export-exclude"),
      imagePlaceholder:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E",
    });
  } finally {
    capture.stage.remove();
  }
}

export function downloadJpeg(dataUrl: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = `${safeFilename(filename.replace(/\.jpg$/i, ""))}.jpg`;
  anchor.rel = "noopener";
  anchor.click();
}

export async function downloadJpegArchive(pages: JpegPage[], filename = "ejaz-pages"): Promise<string> {
  if (!pages.length) throw new Error("لا توجد صفحات جاهزة للتصدير.");
  const archive = new JSZip();
  for (const page of pages) {
    const base64 = page.dataUrl.split(",", 2)[1];
    if (!base64) throw new Error(`تعذّر تجهيز صورة الصفحة: ${page.name}`);
    archive.file(`${safeFilename(page.name)}.jpg`, base64, { base64: true });
  }

  const blob = await archive.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 5 },
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const archiveName = `${safeFilename(filename)}.zip`;
  anchor.href = url;
  anchor.download = archiveName;
  anchor.rel = "noopener";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return archiveName;
}

export function printPage(title?: string): void {
  const previousTitle = document.title;
  if (title?.trim()) document.title = title.trim();
  const restoreTitle = () => {
    document.title = previousTitle;
    window.removeEventListener("afterprint", restoreTitle);
  };
  window.addEventListener("afterprint", restoreTitle, { once: true });
  window.print();
  // Some embedded browsers do not dispatch afterprint when printing is cancelled.
  window.setTimeout(restoreTitle, 60_000);
}
