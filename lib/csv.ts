/**
 * Small CSV helpers for contact import and export (RFC 4180: quoted fields,
 * doubled quotes, commas and newlines inside quotes). Comma, semicolon and
 * tab delimiters are detected from the header row.
 */
import type { ImportField } from "@/lib/types/audience";

export function detectDelimiter(firstLine: string): string {
  const counts = [",", ";", "\t"].map((d) => ({ d, n: firstLine.split(d).length - 1 }));
  return counts.sort((a, b) => b.n - a.n)[0].n > 0 ? counts[0].d : ",";
}

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const delim = detectDelimiter(src.split(/\r?\n/, 1)[0] ?? "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === "") quoted = true;
    else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Drop blank lines.
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const GUESSES: Record<ImportField, RegExp> = {
  email: /^(e-?mail|email address|contact email|mail)$/i,
  firstName: /^(first ?name|given ?name|first|fname)$/i,
  lastName: /^(last ?name|surname|family ?name|last|lname)$/i,
  phone: /^(phone|phone number|telephone|tel|work phone)$/i,
  mobile: /^(mobile|mobile number|cell|cell phone|mobile phone)$/i,
  company: /^(company|organisation|organization|company name|employer)$/i,
  tags: /^(tags?|labels?)$/i,
};

/** Best guess of which contact field each column holds ("" = don't import). */
export function guessMapping(headers: string[]): (ImportField | "")[] {
  const used = new Set<ImportField>();
  return headers.map((h) => {
    const name = h.trim();
    const hit = (Object.keys(GUESSES) as ImportField[]).find((f) => !used.has(f) && GUESSES[f].test(name));
    if (hit) used.add(hit);
    return hit ?? "";
  });
}

const cell = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n");

/** Save text as a file in the browser (nothing is uploaded). */
export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["﻿", text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
