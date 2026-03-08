export type ExtractResult = {
  text: string;
  wordCount: number;
  pageCount?: number;
  fileName: string;
  fileType: "pdf" | "docx" | "txt";
};

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function getFileType(file: File): "pdf" | "docx" | "txt" {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".txt")) return "txt";
  throw new Error("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
}

async function extractFromTxt(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read text file."));
    reader.readAsText(file);
  });
}

async function extractFromDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractFromPdf(file: File): Promise<{ text: string; pageCount: number }> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;
  const pages: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item) => "str" in item)
      .map((item) => (item as { str: string }).str)
      .join(" ");
    pages.push(pageText);
  }

  const text = pages.join("\n\n");
  return { text, pageCount };
}

export async function extractTextFromFile(file: File): Promise<ExtractResult> {
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("File is too large. Maximum size is 20 MB.");
  }

  const fileType = getFileType(file);
  let text: string;
  let pageCount: number | undefined;

  switch (fileType) {
    case "txt":
      text = await extractFromTxt(file);
      break;
    case "docx":
      text = await extractFromDocx(file);
      break;
    case "pdf": {
      try {
        const result = await extractFromPdf(file);
        text = result.text;
        pageCount = result.pageCount;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("password")) {
          throw new Error("This PDF is password-protected — remove the password first.");
        }
        throw new Error("Failed to read PDF. It may be corrupted or contain only images.");
      }
      break;
    }
  }

  text = text.trim();

  if (!text || countWords(text) < 3) {
    if (fileType === "pdf") {
      throw new Error("This PDF contains only images — paste your text instead.");
    }
    throw new Error("Document is empty after extraction.");
  }

  return {
    text,
    wordCount: countWords(text),
    pageCount,
    fileName: file.name,
    fileType,
  };
}
