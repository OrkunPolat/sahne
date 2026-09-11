// PDF → düz metin (pdf-parse v2 / pdfjs). Şifreli veya bozuk dosyada 422.
import { PDFParse } from "pdf-parse";
import { HttpError } from "./util";

export async function extractPdfText(buf: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buf });
  try {
    const r = await parser.getText();
    return r.text ?? "";
  } catch (e) {
    throw new HttpError(422, "bad_pdf", `Could not read PDF: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    await parser.destroy().catch(() => {});
  }
}
