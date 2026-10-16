"use client";

import { useRef, useState, type FormEvent } from "react";
import type { Icon } from "@phosphor-icons/react";
import { CopyIcon, DotsThreeIcon, EyeIcon, FileArchiveIcon, FileCsvIcon, FileDocIcon, FileIcon, FilePdfIcon, FileXlsIcon, FolderSimpleIcon, ImageIcon, ListIcon, PencilSimpleIcon, SquaresFourIcon, TrashIcon, UploadSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Card, ConfirmDialog, fieldClass, FilterSelect, FormField, OutlineButton, PageHeading, PageShell, PrimaryButton, SearchInput, UnderlineTabs } from "@/components/shared/campaign-ui";
import { byNumber, byText, DataTable, type Column } from "@/components/shared/data-table";
import { FormDialog } from "@/components/shared/form-kit";
import { RowMenu, type MenuAction } from "@/components/shared/row-menu";
import { EmptyState, ErrorState } from "@/components/shared/state-panels";
import { useCreateItem, useDeleteItems, useItems, useUpdateItem } from "@/hooks/use-workspace";
import { useStoredState } from "@/hooks/use-stored-state";
import { ApiError } from "@/lib/api/errors";
import { formatDate, formatDateTime, pluralize } from "@/lib/format";
import { CURRENT_USER } from "@/lib/mock-data/campaigns";
import type { AssetFile, FileKind } from "@/lib/types/workspace";
import { cn } from "@/lib/utils";

const MAX_FILE = 10 * 1024 * 1024;
const ACCEPT: Record<string, FileKind> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/gif": "image",
  "image/webp": "image",
  "image/svg+xml": "image",
  "application/pdf": "document",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "application/vnd.ms-excel": "document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
  "text/csv": "document",
  "text/plain": "document",
  "application/zip": "other",
  "application/x-zip-compressed": "other",
};
const EXT_MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv", txt: "text/plain", zip: "application/zip" };

export const fileSize = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const assetUrl = (f: AssetFile) => `https://assets.evoq.one/${f.id}/${encodeURIComponent(f.name)}`;

function typeIcon(f: Pick<AssetFile, "mime" | "kind">): { icon: Icon; fg: string; bg: string; label: string } {
  if (f.kind === "image") return { icon: ImageIcon, fg: "var(--campaign-action)", bg: "var(--campaign-tint)", label: "Image" };
  if (f.mime === "application/pdf") return { icon: FilePdfIcon, fg: "#D92D20", bg: "var(--danger-bg)", label: "PDF" };
  if (f.mime.includes("sheet") || f.mime.includes("excel")) return { icon: FileXlsIcon, fg: "var(--ch-sms-fg)", bg: "var(--ch-sms-bg)", label: "Spreadsheet" };
  if (f.mime === "text/csv") return { icon: FileCsvIcon, fg: "var(--ch-sms-fg)", bg: "var(--ch-sms-bg)", label: "CSV" };
  if (f.mime.includes("word") || f.mime === "application/msword") return { icon: FileDocIcon, fg: "var(--ch-journey-fg)", bg: "var(--ch-journey-bg)", label: "Document" };
  if (f.mime.includes("zip")) return { icon: FileArchiveIcon, fg: "var(--ch-email-fg)", bg: "var(--ch-email-bg)", label: "Archive" };
  return { icon: FileIcon, fg: "var(--neutral-fg)", bg: "var(--neutral-bg)", label: "File" };
}

/** A small JPEG thumbnail (≤ 480px) so previews don't fill browser storage. */
async function thumbnail(file: File): Promise<string | undefined> {
  if (file.type === "image/svg+xml") return file.size <= 200 * 1024 ? await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); }) : undefined;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 480 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return undefined;
  }
}

export function FilesView() {
  const { data, isError, refetch } = useItems("files");
  const create = useCreateItem("files");
  const del = useDeleteItems("files");
  const [view, setView] = useStoredState<"grid" | "list">("evoq-campaigns:files-view", "grid");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"" | FileKind>("");
  const [sort, setSort] = useState("newest");
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [previewing, setPreviewing] = useState<AssetFile | null>(null);
  const [renaming, setRenaming] = useState<AssetFile | null>(null);
  const [deleting, setDeleting] = useState<AssetFile | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (list: FileList | File[]) => {
    const files = Array.from(list);
    if (!files.length) return;
    const rejected: string[] = [];
    setUploading(files.length);
    let ok = 0;
    for (const f of files) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      const mime = f.type || EXT_MIME[ext] || "";
      const kindOf = ACCEPT[mime];
      if (!kindOf) {
        rejected.push(`${f.name} (type not supported)`);
        continue;
      }
      if (f.size > MAX_FILE) {
        rejected.push(`${f.name} (over 10 MB)`);
        continue;
      }
      if (f.size === 0) {
        rejected.push(`${f.name} (empty file)`);
        continue;
      }
      try {
        await create.mutateAsync({ name: f.name, kind: kindOf, mime, size: f.size, uploadedBy: CURRENT_USER.name, preview: kindOf === "image" ? await thumbnail(f) : undefined });
        ok++;
      } catch (e) {
        rejected.push(`${f.name} (${(e as Error).message})`);
      }
    }
    setUploading(0);
    if (ok) toast.success(`${pluralize(ok, "file")} added`, { description: "Kept in this browser only — nothing is uploaded to a server." });
    if (rejected.length) toast.error(`${pluralize(rejected.length, "file")} not added`, { description: rejected.slice(0, 3).join(" · ") + (rejected.length > 3 ? " …" : "") });
  };

  const copyRef = async (f: AssetFile) => {
    try {
      await navigator.clipboard.writeText(assetUrl(f));
      toast.success("Asset link copied", { description: "Demo link — it doesn't point to a real server." });
    } catch {
      toast.info("Copy this link", { description: assetUrl(f) });
    }
  };

  const term = q.trim().toLowerCase();
  const sorters: Record<string, (a: AssetFile, b: AssetFile) => number> = {
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
    name: (a, b) => a.name.localeCompare(b.name),
    size: (a, b) => b.size - a.size,
  };
  const searched = data?.filter((f) => !term || f.name.toLowerCase().includes(term));
  const rows = searched?.filter((f) => !kind || f.kind === kind).sort(sorters[sort]);
  const used = (data ?? []).reduce((n, f) => n + f.size, 0);

  const actions = (f: AssetFile): MenuAction[] => [
    { label: "Preview", icon: EyeIcon, onSelect: () => setPreviewing(f) },
    { label: "Rename", icon: PencilSimpleIcon, onSelect: () => setRenaming(f) },
    { label: "Copy asset link", icon: CopyIcon, onSelect: () => copyRef(f) },
    { label: "Delete", icon: TrashIcon, destructive: true, separatorBefore: true, onSelect: () => setDeleting(f) },
  ];

  const columns: Column<AssetFile>[] = [
    {
      key: "name",
      label: "File name",
      sort: byText((f) => f.name),
      render: (f) => {
        const t = typeIcon(f);
        return (
          <span className="flex items-center gap-3">
            {f.preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local data URI preview
              <img src={f.preview} alt="" className="size-9 shrink-0 rounded-md border border-line object-cover" />
            ) : (
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md" style={{ color: t.fg, backgroundColor: t.bg }} aria-hidden>
                <t.icon size={18} />
              </span>
            )}
            <span className="max-w-[300px] truncate font-medium text-ink">{f.name}</span>
          </span>
        );
      },
    },
    { key: "type", label: "Type", render: (f) => typeIcon(f).label },
    { key: "size", label: "Size", align: "right", sort: byNumber((f) => f.size), render: (f) => fileSize(f.size) },
    { key: "by", label: "Uploaded by", render: (f) => f.uploadedBy, hideBelow: "md" },
    { key: "date", label: "Upload date", sort: byText((f) => f.createdAt), render: (f) => <span className="whitespace-nowrap">{formatDate(f.createdAt)}</span> },
  ];

  return (
    <PageShell>
      <PageHeading
        crumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Files" }]}
        title="Files"
        description={`Images and documents for your emails and campaigns · ${fileSize(used)} used. Files stay in this browser.`}
        actions={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Search files…" label="Search files" className="w-full sm:w-[240px]" />
            <input
              ref={input}
              type="file"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              accept={Object.keys(EXT_MIME).map((e) => `.${e}`).join(",")}
              onChange={(e) => {
                if (e.target.files) void upload(e.target.files);
                e.target.value = "";
              }}
            />
            <PrimaryButton icon={UploadSimpleIcon} onClick={() => input.current?.click()} disabled={uploading > 0}>
              {uploading ? `Adding ${pluralize(uploading, "file")}…` : "Upload Files"}
            </PrimaryButton>
          </>
        }
      />

      <UnderlineTabs
        label="File type"
        idPrefix="files"
        className="mt-5"
        value={kind}
        onChange={setKind}
        tabs={[
          { value: "" as const, label: "All files" },
          { value: "image" as const, label: "Images" },
          { value: "document" as const, label: "Documents" },
          { value: "other" as const, label: "Other" },
        ].map((t) => ({ ...t, count: searched ? searched.filter((f) => !t.value || f.kind === t.value).length : undefined }))}
      />

      <Card
        className={cn("mt-4 transition-colors", drag && "border-campaign-action bg-campaign-surface")}
        label="Files"
      >
        <div
          id="files-panel"
          role="tabpanel"
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void upload(e.dataTransfer.files);
          }}
        >
          <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3 sm:px-5">
            <p className="text-[12.5px] text-ink-muted">Drag files here to add them · images, PDF, Word, Excel, CSV, ZIP · up to 10 MB each</p>
            <div className="ml-auto flex items-center gap-2">
              <FilterSelect label="Sort files" value={sort} onChange={(v) => setSort(v || "newest")} options={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "name", label: "Name (A–Z)" }, { value: "size", label: "Largest first" }]} highlight={false} className="w-[150px]" />
              <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label="View">
                {(["grid", "list"] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={view === v} aria-label={v === "grid" ? "Grid view" : "List view"} onClick={() => setView(v)} className={cn("inline-flex size-8 items-center justify-center rounded-md transition-colors", view === v ? "bg-campaign-tint text-campaign-primary" : "text-ink-muted hover:text-ink")}>
                    {v === "grid" ? <SquaresFourIcon size={16} aria-hidden /> : <ListIcon size={16} aria-hidden />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isError ? (
            <ErrorState action={<OutlineButton onClick={() => refetch()}>Try again</OutlineButton>} />
          ) : rows && rows.length === 0 ? (
            <EmptyState
              icon={FolderSimpleIcon}
              title={term || kind ? "No files match" : "No files yet"}
              hint={term || kind ? "Try another search or file type." : "Upload images and documents to use in your emails."}
              action={!term && !kind && <PrimaryButton icon={UploadSimpleIcon} onClick={() => input.current?.click()}>Upload Files</PrimaryButton>}
            />
          ) : view === "list" ? (
            <DataTable rows={rows} columns={columns} rowKey={(f) => f.id} rowLabel={(f) => f.name} onRowClick={setPreviewing} actions={actions} noun="files" caption="Files" minWidth={720} empty={null} />
          ) : (
            <ul className="grid grid-cols-2 gap-3 px-4 pb-5 sm:grid-cols-3 sm:px-5 lg:grid-cols-4 2xl:grid-cols-6" aria-label="Files">
              {(rows ?? Array.from({ length: 8 }, () => null)).map((f, i) =>
                f ? (
                  <li key={f.id} className="group relative overflow-hidden rounded-xl border border-line bg-white transition hover:-translate-y-0.5 hover:border-campaign-soft hover:shadow-pop">
                    <button type="button" onClick={() => setPreviewing(f)} className="block w-full text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-action" aria-label={`Preview ${f.name}`}>
                      <FileArt f={f} className="h-[120px]" />
                      <span className="block px-3 pt-2.5 pb-3">
                        <span className="block truncate text-[13px] font-medium text-ink" title={f.name}>
                          {f.name}
                        </span>
                        <span className="block text-[12px] text-ink-muted">
                          {typeIcon(f).label} · {fileSize(f.size)} · {formatDate(f.createdAt)}
                        </span>
                      </span>
                    </button>
                    <div className="absolute top-2 right-2">
                      <RowMenu
                        label={`Actions for ${f.name}`}
                        actions={actions(f)}
                        trigger={
                          <button type="button" aria-label={`Actions for ${f.name}`} className="inline-flex size-8 items-center justify-center rounded-lg bg-white/95 text-ink-body opacity-0 shadow-card transition group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100">
                            <DotsThreeIcon size={18} weight="bold" aria-hidden />
                          </button>
                        }
                      />
                    </div>
                  </li>
                ) : (
                  <li key={i} className="h-[180px] animate-pulse rounded-xl bg-campaign-muted" />
                ),
              )}
            </ul>
          )}
        </div>
      </Card>

      <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="sm:max-w-2xl">
          {previewing && (
            <>
              <DialogTitle className="truncate pr-8 text-[16px] font-semibold text-campaign-depth">{previewing.name}</DialogTitle>
              <DialogDescription className="text-[12.5px] text-ink-muted">
                {typeIcon(previewing).label} · {fileSize(previewing.size)} · uploaded {formatDateTime(previewing.createdAt)} by {previewing.uploadedBy}
              </DialogDescription>
              <FileArt f={previewing} className="mt-2 h-[340px] rounded-xl border border-line" large />
              {previewing.kind !== "image" && <p className="text-[12.5px] text-ink-muted">A preview isn&apos;t available for this file type in the demo.</p>}
              <div className="flex flex-wrap justify-end gap-2">
                <OutlineButton icon={CopyIcon} onClick={() => copyRef(previewing)}>
                  Copy asset link
                </OutlineButton>
                <OutlineButton icon={PencilSimpleIcon} onClick={() => (setRenaming(previewing), setPreviewing(null))}>
                  Rename
                </OutlineButton>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <RenameDialog file={renaming} onOpenChange={(o) => !o && setRenaming(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this file?"
        description={<>{deleting?.name} is removed from the library. Emails that already use it keep their copy.</>}
        confirmLabel="Delete file"
        pending={del.isPending}
        onConfirm={() => deleting && del.mutate([deleting.id], { onSuccess: () => (toast.success("File deleted"), setDeleting(null)) })}
      />
    </PageShell>
  );
}

function FileArt({ f, className, large }: { f: AssetFile; className?: string; large?: boolean }) {
  const t = typeIcon(f);
  if (f.preview)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local data URI preview
      <img src={f.preview} alt={large ? f.name : ""} className={cn("block w-full bg-campaign-surface object-cover", large && "object-contain", className)} />
    );
  return (
    <span className={cn("flex w-full items-center justify-center bg-campaign-surface", className)} aria-hidden>
      <span className={cn("inline-flex items-center justify-center rounded-2xl", large ? "size-24" : "size-14")} style={{ color: t.fg, backgroundColor: t.bg }}>
        <t.icon size={large ? 44 : 28} />
      </span>
    </span>
  );
}

function RenameDialog({ file, onOpenChange }: { file: AssetFile | null; onOpenChange: (o: boolean) => void }) {
  return file ? <RenameForm key={file.id} file={file} onOpenChange={onOpenChange} /> : null;
}

function RenameForm({ file, onOpenChange }: { file: AssetFile; onOpenChange: (o: boolean) => void }) {
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const [stem, setStem] = useState(ext ? file.name.slice(0, -ext.length) : file.name);
  const [error, setError] = useState("");
  const update = useUpdateItem("files");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = stem.trim();
    if (!clean) return setError("Enter a file name");
    if (/[\\/:*?"<>|]/.test(clean)) return setError("File names can't contain \\ / : * ? \" < > |");
    update.mutate(
      { id: file.id, patch: { name: `${clean}${ext}` }, note: `Renamed to ${clean}${ext}` },
      {
        onSuccess: () => {
          toast.success("File renamed");
          onOpenChange(false);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't rename"),
      },
    );
  };
  return (
    <FormDialog open onOpenChange={onOpenChange} title="Rename file" onSubmit={submit} submitLabel="Rename" saving={update.isPending}>
      <FormField label="File name" htmlFor="rename-file" error={error} required className="sm:col-span-2" hint={ext ? `The ${ext} extension is kept.` : undefined}>
        <div className="flex items-center gap-2">
          <input id="rename-file" value={stem} onChange={(e) => (setError(""), setStem(e.target.value))} autoFocus maxLength={120} aria-invalid={error ? true : undefined} className={fieldClass} />
          {ext && <span className="text-[13px] text-ink-muted">{ext}</span>}
        </div>
      </FormField>
    </FormDialog>
  );
}
