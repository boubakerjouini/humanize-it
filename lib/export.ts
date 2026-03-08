import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, AlignmentType } from "docx";
import { jsPDF } from "jspdf";

interface ExportData {
  originalText: string;
  humanizedText: string;
  aiScore: number;
  humanizedScore: number | null;
  date: Date;
}

const BRAND = "HumanizeIt — humanizeit.app";

export async function exportDocx(data: ExportData): Promise<void> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: BRAND, bold: true, size: 28, color: "8b5cf6" })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Generated on ${data.date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, size: 18, color: "888888" })],
            spacing: { after: 300 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" } },
          }),

          // AI Score
          new Paragraph({
            children: [
              new TextRun({ text: "AI Detection Score: ", bold: true, size: 22 }),
              new TextRun({ text: `${Math.round(data.aiScore)}%`, bold: true, size: 22, color: data.aiScore >= 50 ? "EF4444" : "22C55E" }),
              ...(data.humanizedScore !== null
                ? [
                    new TextRun({ text: "  →  ", size: 22, color: "888888" }),
                    new TextRun({ text: `${Math.round(data.humanizedScore)}%`, bold: true, size: 22, color: data.humanizedScore < 30 ? "22C55E" : "F97316" }),
                  ]
                : []),
            ],
            spacing: { after: 300 },
          }),

          // Original Text
          new Paragraph({
            text: "Original Text",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 100 },
          }),
          ...data.originalText.split("\n").map(
            (line) =>
              new Paragraph({
                children: [new TextRun({ text: line || " ", size: 22 })],
                spacing: { after: 80 },
              })
          ),

          new Paragraph({ spacing: { before: 200, after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" } }, children: [] }),

          // Humanized Text
          new Paragraph({
            text: "Humanized Text",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 100 },
          }),
          ...data.humanizedText.split("\n").map(
            (line) =>
              new Paragraph({
                children: [new TextRun({ text: line || " ", size: 22 })],
                spacing: { after: 80 },
              })
          ),

          new Paragraph({ spacing: { before: 400 }, children: [] }),
          new Paragraph({
            children: [new TextRun({ text: BRAND, size: 16, color: "AAAAAA", italics: true })],
            alignment: AlignmentType.CENTER,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `humanized-${Date.now()}.docx`);
}

export function exportPdf(data: ExportData): void {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  const checkPage = (needed: number) => {
    if (y + needed > pdf.internal.pageSize.getHeight() - 20) {
      pdf.addPage();
      y = 20;
    }
  };

  // Header
  pdf.setFontSize(16);
  pdf.setTextColor(139, 92, 246);
  pdf.text(BRAND, margin, y);
  y += 8;

  pdf.setFontSize(9);
  pdf.setTextColor(136, 136, 136);
  pdf.text(
    `Generated on ${data.date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    margin,
    y
  );
  y += 4;

  // Divider
  pdf.setDrawColor(220, 220, 220);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Score
  pdf.setFontSize(12);
  pdf.setTextColor(0, 0, 0);
  pdf.text("AI Detection Score: ", margin, y);
  const scoreX = margin + pdf.getTextWidth("AI Detection Score: ");
  pdf.setTextColor(data.aiScore >= 50 ? 239 : 34, data.aiScore >= 50 ? 68 : 197, data.aiScore >= 50 ? 68 : 94);
  pdf.text(`${Math.round(data.aiScore)}%`, scoreX, y);

  if (data.humanizedScore !== null) {
    const arrowX = scoreX + pdf.getTextWidth(`${Math.round(data.aiScore)}%`) + 4;
    pdf.setTextColor(136, 136, 136);
    pdf.text("→", arrowX, y);
    const newX = arrowX + 6;
    pdf.setTextColor(data.humanizedScore < 30 ? 34 : 249, data.humanizedScore < 30 ? 197 : 115, data.humanizedScore < 30 ? 94 : 22);
    pdf.text(`${Math.round(data.humanizedScore)}%`, newX, y);
  }
  y += 14;

  // Original text section
  const renderSection = (title: string, content: string) => {
    checkPage(20);
    pdf.setFontSize(14);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont("helvetica", "bold");
    pdf.text(title, margin, y);
    y += 8;

    pdf.setFontSize(10);
    pdf.setTextColor(50, 50, 50);
    pdf.setFont("helvetica", "normal");
    const lines = pdf.splitTextToSize(content, maxWidth) as string[];
    for (const line of lines) {
      checkPage(6);
      pdf.text(line, margin, y);
      y += 5;
    }
    y += 8;
  };

  renderSection("Original Text", data.originalText);

  // Divider
  checkPage(10);
  pdf.setDrawColor(220, 220, 220);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 10;

  renderSection("Humanized Text", data.humanizedText);

  // Footer
  checkPage(15);
  y = pdf.internal.pageSize.getHeight() - 15;
  pdf.setFontSize(8);
  pdf.setTextColor(170, 170, 170);
  pdf.text(BRAND, pageWidth / 2, y, { align: "center" });

  pdf.save(`humanized-${Date.now()}.pdf`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
