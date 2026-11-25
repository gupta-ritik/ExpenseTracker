import { getDocumentProxy } from "unpdf";

export const maxPdfBytes = 10 * 1024 * 1024;
export const maxPdfPages = 200;

export type Cell = { x: number; text: string };
export type Line = { y: number; cells: Cell[]; text: string };
export type Page = { number: number; lines: Line[]; text: string };

export class PdfPasswordError extends Error {
  constructor(readonly incorrect: boolean) {
    super(
      incorrect
        ? "The PDF password is incorrect."
        : "This PDF is password protected. Enter its password.",
    );
    this.name = "PdfPasswordError";
  }
}

export class PdfLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfLimitError";
  }
}

type TextItem = { str: string; transform: number[]; width: number };

/** Groups text items into lines by their y position and keeps x positions for column mapping. */
export function buildLines(items: TextItem[]): Line[] {
  const rows: { y: number; cells: (Cell & { end: number })[] }[] = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    let row = rows.find((candidate) => Math.abs(candidate.y - y) <= 2.5);
    if (!row) {
      row = { y, cells: [] };
      rows.push(row);
    }
    row.cells.push({ x, end: x + item.width, text: item.str.trim() });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const sorted = row.cells.sort((a, b) => a.x - b.x);
      const merged: (Cell & { end: number })[] = [];
      for (const cell of sorted) {
        const previous = merged.at(-1);
        // Glyph runs closer than a space belong to the same cell.
        if (previous && cell.x - previous.end < 3) {
          previous.text += (cell.x - previous.end > 1 ? " " : "") + cell.text;
          previous.end = cell.end;
        } else merged.push({ ...cell });
      }
      return {
        y: row.y,
        cells: merged.map(({ x, text }) => ({ x, text })),
        text: merged.map((cell) => cell.text).join("  "),
      };
    });
}

/** Reads a PDF fully in memory. The bytes and password are never stored. */
export async function extractPages(
  data: Uint8Array,
  password?: string,
): Promise<Page[]> {
  if (data.byteLength > maxPdfBytes)
    throw new PdfLimitError("Upload a PDF of up to 10 MB.");
  if (!/^%PDF-/.test(new TextDecoder().decode(data.slice(0, 8))))
    throw new PdfLimitError("This file is not a PDF.");
  let document: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    document = await getDocumentProxy(new Uint8Array(data), {
      password: password || undefined,
    });
  } catch (error) {
    const name = (error as { name?: string })?.name;
    const code = (error as { code?: number })?.code;
    if (name === "PasswordException") throw new PdfPasswordError(code === 2);
    throw new PdfLimitError("This PDF could not be read.");
  }
  try {
    if (document.numPages > maxPdfPages)
      throw new PdfLimitError("Upload a PDF of up to 200 pages.");
    const pages: Page[] = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const lines = buildLines(
        content.items.flatMap((item) =>
          "str" in item ? [item as TextItem] : [],
        ),
      );
      pages.push({
        number,
        lines,
        text: lines.map((line) => line.text).join("\n"),
      });
      page.cleanup();
    }
    return pages;
  } finally {
    const handle = document as unknown as {
      destroy?: () => Promise<void>;
      cleanup?: () => Promise<void>;
    };
    await (handle.destroy ?? handle.cleanup)?.call(document);
  }
}
