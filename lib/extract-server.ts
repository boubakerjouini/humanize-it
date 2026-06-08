// ===========================================================
// lib/extract-server.ts — Reliable server-side document extraction
//
// Runs in Node (workflow steps / API routes), not the browser. The old flow
// extracted PDFs client-side with pdfjs in "fake worker" mode, which broke on
// many real-world PDFs. Doing it server-side with the legacy pdfjs build +
// mammoth is far more robust and keeps large files off the client.
// ===========================================================

export type DocFileType = "pdf" | "docx" | "txt";

export interface ServerExtractResult {
  text: string;
  wordCount: number;
  pageCount?: number;
  fileType: DocFileType;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function fileTypeFromName(name: string): DocFileType {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "txt";
  throw new Error("Unsupported file type. Upload a PDF, DOCX, or TXT file.");
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// Minimal structural typing for the pdfjs pieces we touch — avoids `any`.
interface PdfTextItem {
  str?: string;
  transform?: number[];
}
interface PdfPage {
  getTextContent(): Promise<{ items: PdfTextItem[] }>;
}
interface PdfDocument {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
}

async function extractPdf(data: Uint8Array): Promise<{ text: string; pageCount: number }> {
  // Legacy build is the one that runs cleanly under Node without a DOM worker.
  const pdfjs = (await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  )) as unknown as {
    getDocument(args: { data: Uint8Array; useSystemFonts?: boolean; isEvalSupported?: boolean }): {
      promise: Promise<PdfDocument>;
    };
  };

  const pdf = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
  const pageCount = pdf.numPages;
  const pages: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    const chunks: string[] = [];
    for (const item of content.items) {
      if (typeof item.str !== "string") continue;
      const y = item.transform?.[5] ?? null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 5) chunks.push("\n");
      chunks.push(item.str);
      lastY = y;
    }
    pages.push(chunks.join(" ").replace(/ \n /g, "\n").trim());
  }

  return { text: pages.join("\n\n"), pageCount };
}

/**
 * Extract plain text from an uploaded document buffer. Throws a user-friendly
 * Error on unsupported / unreadable / image-only files.
 */
export async function extractFromBuffer(
  buffer: Buffer,
  fileName: string,
  maxBytes = 20 * 1024 * 1024
): Promise<ServerExtractResult> {
  if (buffer.byteLength > maxBytes) {
    throw new Error("File is too large. Maximum size is 20 MB.");
  }

  const fileType = fileTypeFromName(fileName);
  let text: string;
  let pageCount: number | undefined;

  switch (fileType) {
    case "txt":
      text = buffer.toString("utf8");
      break;
    case "docx":
      text = await extractDocx(buffer);
      break;
    case "pdf": {
      try {
        const result = await extractPdf(new Uint8Array(buffer));
        text = result.text;
        pageCount = result.pageCount;
      } catch (err) {
        const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
        if (msg.includes("password")) {
          throw new Error("This PDF is password-protected — remove the password first.");
        }
        if (msg.includes("invalid pdf") || msg.includes("missing pdf")) {
          throw new Error("Invalid PDF file — please check it isn't corrupted.");
        }
        throw new Error("Could not read this PDF. Try re-saving it or upload a DOCX instead.");
      }
      break;
    }
  }

  text = text.trim();
  if (!text || countWords(text) < 3) {
    if (fileType === "pdf") {
      throw new Error("This PDF appears to contain only images — paste the text instead.");
    }
    throw new Error("The document was empty after extraction.");
  }

  return { text, wordCount: countWords(text), pageCount, fileType };
}
