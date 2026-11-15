// PDF → slide images. pdf.js is loaded only when a PDF is imported.
export const MAX_PDF_PAGES = 60;
const RENDER_WIDTH = 1600; // pixels; JPEG keeps each slide around 100–300 KB

/**
 * Render each page of a PDF file to a JPEG data URL.
 * Returns { slides: [{ src, w, h }], total } where total is the PDF's page count.
 */
export async function pdfToSlides(file, { onProgress } = {}) {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await task.promise;
    const count = Math.min(pdf.numPages, MAX_PDF_PAGES);
    const slides = [];
    for (let i = 1; i <= count; i++) {
      onProgress?.(i, count);
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: RENDER_WIDTH / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport, background: "#ffffff" }).promise;
      slides.push({ src: canvas.toDataURL("image/jpeg", 0.82), w: canvas.width, h: canvas.height });
      page.cleanup();
    }
    return { slides, total: pdf.numPages };
  } finally {
    // Frees the document and its worker
    task.destroy();
  }
}

/** Friendly message for pdf.js failures. */
export function pdfErrorMessage(err) {
  if (err?.name === "PasswordException") return "That PDF is password-protected. Remove the password and try again.";
  if (err?.name === "InvalidPDFException") return "That file isn't a valid PDF.";
  return "Could not read that PDF.";
}
