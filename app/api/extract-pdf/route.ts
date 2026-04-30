import { NextRequest } from "next/server";

// Force Node.js runtime
export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_CHARS = 100000;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return new Response(
        JSON.stringify({ error: "No file uploaded." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return new Response(
        JSON.stringify({ error: "Only PDF files are supported." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: "File is too large. Maximum size is 10MB." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Dynamic import to avoid build-time issues
    const PDFParser = (await import("pdf2json")).default;

    // pdf2json uses an event-based API; wrap it in a promise
    const text = await new Promise<string>((resolve, reject) => {
      const pdfParser = new PDFParser(null, true); // true = raw text mode

      pdfParser.on("pdfParser_dataError", (errData) => {
        const errMsg = (errData as { parserError?: string }).parserError || "Unknown PDF parsing error";
        reject(new Error(errMsg));
      });

      pdfParser.on("pdfParser_dataReady", () => {
        const rawText = pdfParser.getRawTextContent();
        resolve(rawText);
      });

      pdfParser.parseBuffer(buffer);
    });

    const trimmed = text.trim();

// Strip out pdf2json's page break markers to see how much real text there is
const realTextOnly = trimmed
  .replace(/-+\s*Page \(\d+\) Break\s*-+/g, "")
  .trim();

if (realTextOnly.length < 100) {
  return new Response(
    JSON.stringify({
      error: "This PDF appears to be image-based (scanned or made of slide images), not text. We can't extract text from images. Try copy-pasting your deck text into the 'Type pitch' tab instead.",
    }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}

    const finalText = trimmed.length > MAX_CHARS
      ? trimmed.slice(0, MAX_CHARS) + "\n\n[...truncated due to length]"
      : trimmed;

    return new Response(
      JSON.stringify({ text: finalText, characters: finalText.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("PDF extract error:", err);
    return new Response(
      JSON.stringify({
        error: "Failed to process PDF. The file may be corrupted or password-protected.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}