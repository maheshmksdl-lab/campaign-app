"use client";

import { useRef, useState } from "react";
import { ArrowLeftIcon, CheckCircleIcon, DownloadSimpleIcon, FileCsvIcon, UploadSimpleIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Badge, fieldClass, OutlineButton, PrimaryButton } from "@/components/shared/campaign-ui";
import { useCheckImport, useImportContacts, useLists } from "@/hooks/use-audience";
import type { ImportCheck } from "@/lib/api/contacts";
import { downloadText, guessMapping, parseCsv, toCsv } from "@/lib/csv";
import { formatNumber, pluralize } from "@/lib/format";
import { IMPORT_FIELDS, type ImportField, type ImportRow, type ImportSummary } from "@/lib/types/audience";
import { cn } from "@/lib/utils";

const FIELD_LABEL: Record<ImportField, string> = { email: "Contact Email", firstName: "First Name", lastName: "Last Name", phone: "Phone", mobile: "Mobile", company: "Company", tags: "Tags" };
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 20_000;

export const SAMPLE_CSV = toCsv([
  ["Email", "First Name", "Last Name", "Mobile", "Company", "Tags"],
  ["maya.patel@example.com", "Maya", "Patel", "+1 415 555 0134", "Brightwave", "newsletter, webinar"],
  ["leo.martin@example.com", "Leo", "Martin", "", "Quartz Software", "trial"],
  ["hana.ito@example.com", "Hana", "Ito", "+1 212 555 0198", "Helix Bio", ""],
]);

export const downloadSample = () => downloadText("contacts-sample.csv", SAMPLE_CSV);

type Step = "upload" | "map" | "review" | "done";
const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "map", label: "Map columns" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];

interface Parsed {
  fileName: string;
  headers: string[];
  rows: string[][];
}

export function ImportContactsDialog({ open, onOpenChange, initialMode = "file", onViewImported }: { open: boolean; onOpenChange: (o: boolean) => void; initialMode?: "file" | "paste"; onViewImported?: () => void }) {
  return open ? <ImportFlow onOpenChange={onOpenChange} initialMode={initialMode} onViewImported={onViewImported} /> : null;
}

function ImportFlow({ onOpenChange, initialMode, onViewImported }: { onOpenChange: (o: boolean) => void; initialMode: "file" | "paste"; onViewImported?: () => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [mode, setMode] = useState(initialMode);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<(ImportField | "")[]>([]);
  const [check, setCheck] = useState<ImportCheck | null>(null);
  const [listChoice, setListChoice] = useState("");
  const [newList, setNewList] = useState("");
  const [tags, setTags] = useState("");
  const [duplicates, setDuplicates] = useState<"skip" | "update">("skip");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const checkM = useCheckImport();
  const importM = useImportContacts();
  const { data: lists } = useLists();

  const load = (text: string, fileName: string) => {
    const rows = parseCsv(text);
    if (rows.length < 2) return setError("The file needs a header row and at least one contact.");
    if (rows.length - 1 > MAX_ROWS) return setError(`Import up to ${formatNumber(MAX_ROWS)} contacts at a time.`);
    const headers = rows[0].map((h, i) => h.trim() || `Column ${i + 1}`);
    const width = headers.length;
    setError("");
    setParsed({ fileName, headers, rows: rows.slice(1).map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? "").trim())) });
    setMapping(guessMapping(headers));
    setStep("map");
  };

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    if (!/\.csv$/i.test(f.name) && f.type !== "text/csv") return setError(`${f.name} isn't a CSV file. Save your spreadsheet as CSV and try again.`);
    if (f.size > MAX_BYTES) return setError("The file is larger than 5 MB.");
    load(await f.text(), f.name);
  };

  const rowsForImport = (): ImportRow[] =>
    (parsed?.rows ?? []).map((r) => {
      const out: ImportRow = {};
      mapping.forEach((f, i) => {
        if (f && r[i]) out[f] = r[i];
      });
      return out;
    });

  const emailMapped = mapping.filter((m) => m === "email").length === 1;

  const toReview = async () => {
    if (!emailMapped) return setError("Map one column to Contact Email — it's required to import contacts.");
    setError("");
    setCheck(await checkM.mutateAsync(rowsForImport()));
    setStep("review");
  };

  const runImport = () => {
    if (listChoice === "__new" && newList.trim().length < 2) return setError("Enter a name for the new list (at least 2 characters).");
    setError("");
    importM.mutate(
      { rows: rowsForImport(), options: { listId: listChoice && listChoice !== "__new" ? listChoice : undefined, newListName: listChoice === "__new" ? newList.trim() : undefined, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), duplicates } },
      {
        onSuccess: (s) => {
          setSummary(s);
          setStep("done");
          toast.success("Import complete", { description: `${formatNumber(s.imported)} added · ${formatNumber(s.updated)} updated · saved in this browser only` });
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(760px,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="border-b border-line-soft px-5 pt-5 pb-4 pr-12">
          <DialogTitle className="text-[17px] font-semibold text-ink">Import contacts</DialogTitle>
          <DialogDescription className="mt-0.5 text-[13px] text-ink-muted">Add contacts from a CSV file. Everything is processed in your browser — nothing is uploaded.</DialogDescription>
          <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]" aria-label="Import steps">
            {STEPS.map((s, i) => (
              <li key={s.key} className="flex items-center gap-2" aria-current={i === stepIndex ? "step" : undefined}>
                <span className={cn("inline-flex size-5 items-center justify-center rounded-full text-[11px] font-semibold", i < stepIndex ? "bg-[var(--success)] text-white" : i === stepIndex ? "bg-brand text-white" : "bg-[#EEECF3] text-ink-muted")}>{i < stepIndex ? "✓" : i + 1}</span>
                <span className={i === stepIndex ? "font-medium text-ink" : "text-ink-muted"}>{s.label}</span>
                {i < STEPS.length - 1 && <span className="h-px w-6 bg-line" aria-hidden />}
              </li>
            ))}
          </ol>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
          {error && (
            <p role="alert" className="mb-3 flex items-start gap-2 rounded-lg bg-[var(--danger-bg)] px-3 py-2 text-[12.5px] font-medium text-[#B42318]">
              <WarningIcon size={15} aria-hidden className="mt-px shrink-0" />
              {error}
            </p>
          )}

          {step === "upload" && (
            <>
              <div className="mb-3 flex rounded-lg border border-line p-0.5 text-[12.5px] sm:w-fit" role="tablist" aria-label="Import source">
                {(["file", "paste"] as const).map((m) => (
                  <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("flex-1 rounded-md px-3 py-1.5 transition-colors", mode === m ? "bg-brand-surface font-medium text-brand" : "text-ink-muted hover:text-ink")}>
                    {m === "file" ? "Upload a CSV file" : "Copy & paste"}
                  </button>
                ))}
              </div>
              {mode === "file" ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDrag(true);
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    void readFile(e.dataTransfer.files[0]);
                  }}
                  className={cn("flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors", drag ? "border-brand bg-brand-surface" : "border-line bg-campaign-muted")}
                >
                  <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-white text-campaign-action shadow-card">
                    <FileCsvIcon size={24} aria-hidden />
                  </span>
                  <p className="mt-3 text-[14px] font-medium text-ink">Drag a CSV file here</p>
                  <p className="mt-1 text-[12.5px] text-ink-muted">or choose one from your computer · up to 5 MB and {formatNumber(MAX_ROWS)} contacts</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    onChange={(e) => {
                      void readFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <PrimaryButton icon={UploadSimpleIcon} className="mt-4" onClick={() => fileRef.current?.click()}>
                    Choose file
                  </PrimaryButton>
                </div>
              ) : (
                <div className="grid gap-1.5">
                  <label htmlFor="import-paste" className="text-field-label text-ink-body">
                    Paste rows with a header line (comma, semicolon or tab separated)
                  </label>
                  <textarea id="import-paste" value={pasted} onChange={(e) => setPasted(e.target.value)} rows={9} placeholder={SAMPLE_CSV} className={cn(fieldClass, "h-auto resize-y py-2 font-mono text-[12px] leading-5")} />
                  <PrimaryButton className="mt-1 w-fit" onClick={() => load(pasted, "Pasted contacts")} disabled={!pasted.trim()}>
                    Continue
                  </PrimaryButton>
                </div>
              )}
              <p className="mt-4 text-[12.5px] text-ink-muted">
                The first row must be column names, and one column must hold email addresses.{" "}
                <button type="button" onClick={downloadSample} className="inline-flex items-center gap-1 rounded font-medium text-brand hover:text-brand-press">
                  <DownloadSimpleIcon size={13} aria-hidden /> Download a sample CSV
                </button>
              </p>
            </>
          )}

          {step === "map" && parsed && (
            <>
              <p className="mb-3 text-[13px] text-ink-body">
                <span className="font-medium text-ink">{parsed.fileName}</span> · {pluralize(parsed.rows.length, "row")} · {pluralize(parsed.headers.length, "column")}. Choose the contact field for each column.
              </p>
              <div className="overflow-x-auto rounded-lg border border-line scrollbar-thin">
                <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
                  <thead>
                    <tr className="bg-campaign-muted text-left text-ink-muted">
                      <th className="px-3 py-2 font-medium">Column in file</th>
                      <th className="px-3 py-2 font-medium">Sample values</th>
                      <th className="w-[200px] px-3 py-2 font-medium">Import as</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.headers.map((h, i) => (
                      <tr key={`${h}-${i}`} className="border-t border-line-soft">
                        <td className="px-3 py-2 font-medium text-ink">{h}</td>
                        <td className="max-w-[260px] truncate px-3 py-2 text-ink-muted">
                          {parsed.rows
                            .slice(0, 3)
                            .map((r) => r[i])
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </td>
                        <td className="px-3 py-1.5">
                          <select
                            aria-label={`Import ${h} as`}
                            value={mapping[i] ?? ""}
                            onChange={(e) => {
                              const v = e.target.value as ImportField | "";
                              setError("");
                              setMapping(mapping.map((m, j) => (j === i ? v : v && m === v ? "" : m)));
                            }}
                            className={cn(fieldClass, "h-8 text-[12.5px]", mapping[i] === "email" && "border-brand-soft bg-brand-surface")}
                          >
                            <option value="">Don&apos;t import</option>
                            {IMPORT_FIELDS.map((f) => (
                              <option key={f} value={f}>
                                {FIELD_LABEL[f]}
                                {f === "email" ? " (required)" : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[12px] text-ink-muted">Each contact field can be used once. Tags can be separated by commas.</p>
            </>
          )}

          {step === "review" && check && parsed && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { k: "new", label: "New contacts", tone: "var(--success)" },
                  { k: "existing", label: "Already contacts", tone: "var(--info)" },
                  { k: "duplicate", label: "Repeated in file", tone: "var(--warning)" },
                  { k: "invalid", label: "Invalid or missing email", tone: "#B42318" },
                ].map((x) => (
                  <div key={x.k} className="rounded-lg border border-line px-3 py-2.5">
                    <p className="text-[20px] leading-7 font-semibold tabular-nums" style={{ color: x.tone }}>
                      {formatNumber(check.counts[x.k as keyof ImportCheck["counts"]])}
                    </p>
                    <p className="text-[12px] text-ink-muted">{x.label}</p>
                  </div>
                ))}
              </div>

              <p className="mt-4 mb-2 text-[12.5px] font-medium text-ink">Preview (first {Math.min(8, parsed.rows.length)} rows)</p>
              <div className="overflow-x-auto rounded-lg border border-line scrollbar-thin">
                <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
                  <thead>
                    <tr className="bg-campaign-muted text-left text-ink-muted">
                      {mapping.map((m, i) => m && <th key={i} className="px-3 py-2 font-medium whitespace-nowrap">{FIELD_LABEL[m]}</th>)}
                      <th className="px-3 py-2 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 8).map((r, ri) => {
                      const st = check.rows[ri];
                      const tone = { new: ["var(--success)", "var(--success-bg)", "New"], existing: ["var(--info)", "var(--info-bg)", duplicates === "update" ? "Update" : "Skip"], duplicate: ["var(--warning)", "var(--warning-bg)", "Skip"], invalid: ["#B42318", "var(--danger-bg)", "Skip"] }[st.status];
                      return (
                        <tr key={ri} className="border-t border-line-soft">
                          {mapping.map((m, i) => m && <td key={i} className="max-w-[200px] truncate px-3 py-2 text-ink-body">{r[i] || <span className="text-ink-faint">—</span>}</td>)}
                          <td className="px-3 py-2 whitespace-nowrap">
                            <Badge fg={tone[0]} bg={tone[1]}>
                              {tone[2]}
                            </Badge>
                            {st.reason && <span className="ml-1.5 text-[11.5px] text-ink-muted">{st.reason}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label htmlFor="import-list" className="text-field-label text-ink-body">
                    Add to list
                  </label>
                  <select id="import-list" value={listChoice} onChange={(e) => setListChoice(e.target.value)} className={fieldClass}>
                    <option value="">Don&apos;t add to a list</option>
                    <option value="__new">+ Create a new list…</option>
                    {(lists ?? []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  {listChoice === "__new" && <input value={newList} onChange={(e) => setNewList(e.target.value)} placeholder="New list name" aria-label="New list name" maxLength={80} className={fieldClass} />}
                </div>
                <div className="grid content-start gap-1.5">
                  <label htmlFor="import-tags" className="text-field-label text-ink-body">
                    Tag every imported contact
                  </label>
                  <input id="import-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. trade-show, 2025" className={fieldClass} />
                </div>
                <fieldset className="grid gap-1.5 sm:col-span-2">
                  <legend className="mb-1 text-field-label text-ink-body">Contacts that already exist ({formatNumber(check.counts.existing)})</legend>
                  <div className="flex flex-wrap gap-4 text-[13px] text-ink-body">
                    {(["skip", "update"] as const).map((d) => (
                      <label key={d} className="inline-flex items-center gap-2">
                        <input type="radio" name="duplicates" checked={duplicates === d} onChange={() => setDuplicates(d)} className="accent-[var(--campaign-action)]" />
                        {d === "skip" ? "Skip them" : "Update them with values from the file"}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </>
          )}

          {step === "done" && summary && (
            <div className="flex flex-col items-center px-4 py-8 text-center">
              <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--success-bg)] text-[var(--success)]">
                <CheckCircleIcon size={26} weight="fill" aria-hidden />
              </span>
              <p className="mt-3 text-[16px] font-semibold text-ink">Import complete</p>
              <p className="mt-1 max-w-md text-[13px] text-ink-muted">
                {formatNumber(summary.imported)} added, {formatNumber(summary.updated)} updated, {formatNumber(summary.skipped)} skipped and {formatNumber(summary.invalid)} invalid. New contacts are subscribed and appear under Reachable Contacts.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft bg-campaign-muted px-5 py-3">
          {(step === "map" || step === "review") && (
            <OutlineButton icon={ArrowLeftIcon} className="mr-auto"               onClick={() => {
                setError("");
                setStep(step === "review" ? "map" : "upload");
              }}
            >
              Back
            </OutlineButton>
          )}
          {step !== "done" && <OutlineButton onClick={() => onOpenChange(false)}>Cancel</OutlineButton>}
          {step === "map" && (
            <PrimaryButton onClick={toReview} disabled={checkM.isPending}>
              {checkM.isPending ? "Checking…" : "Review import"}
            </PrimaryButton>
          )}
          {step === "review" && check && (
            <PrimaryButton onClick={runImport} disabled={importM.isPending || check.counts.new + (duplicates === "update" ? check.counts.existing : 0) === 0}>
              {importM.isPending ? "Importing…" : `Import ${pluralize(check.counts.new + (duplicates === "update" ? check.counts.existing : 0), "contact")}`}
            </PrimaryButton>
          )}
          {step === "done" && (
            <>
              <OutlineButton onClick={() => onOpenChange(false)}>Close</OutlineButton>
              <PrimaryButton
                onClick={() => {
                  onViewImported?.();
                  onOpenChange(false);
                }}
              >
                View contacts
              </PrimaryButton>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
