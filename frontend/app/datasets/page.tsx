"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { WorkspaceOrPublic } from "@/components/WorkspaceOrPublic";
import { Badge, EmptyState, ErrorState, Notice, ProgressBar, SectionTitle, Skeleton } from "@/components/ui";
import { FadeIn } from "@/components/Motion";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import { apiDownload, apiGet, apiUploadWithProgress, fmtDate, sentimentColor } from "@/lib/api";

type Builtin = {
  id: string;
  name: string;
  source: string;
  license: string;
  role?: string;
  n: number;
  class_distribution: Record<string, number>;
  columns: string[];
  label_mapping: Record<string, string>;
  description: string;
};

type Preview = {
  dataset: string;
  total: number;
  filtered_total?: number;
  class_distribution: Record<string, number>;
  missing: Record<string, number>;
  duplicates: number;
  preview: any[];
};

type UserDataset = {
  id: string;
  name: string;
  source: string;
  license: string;
  record_count: number;
  class_distribution: string;
  columns: string;
  missing_report: string;
  duplicate_count: number;
  created_at: string;
};

const REFERENCED_CORPORA = [
  {
    name: "CMU-MOSEI (Multimodal Opinion Sentiment & Emotion Intensity)",
    source: "https://github.com/A2Zadeh/CMU-MultimodalSDK",
    usage: "Referenced only (not bundled) — general multimodal emotion resource, not financial sentiment.",
  },
  {
    name: "RAVDESS (Ryerson Audio-Visual Database of Emotional Speech and Song)",
    source: "https://zenodo.org/records/1188976",
    usage: "Referenced only (not bundled) — documented as future vocal-emotion extension.",
  },
];

const MAX_DS_BYTES = 50 * 1024 * 1024;

export default function DatasetsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [builtin, setBuiltin] = useState<Builtin[]>([]);
  const [selected, setSelected] = useState("twitter_financial_news");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [userDs, setUserDs] = useState<UserDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [rowSearch, setRowSearch] = useState("");
  const [rowLabel, setRowLabel] = useState("all");

  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const b = await apiGet<Builtin[]>("/api/datasets/builtin");
      setBuiltin(b);
      if (user) {
        const u = await apiGet<UserDataset[]>("/api/datasets/user");
        setUserDs(u);
      } else {
        setUserDs([]);
      }
    } catch (e: any) {
      setError(e?.message || "Could not load datasets.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const loadPreview = useCallback(async (ds: string, q: string, lbl: string) => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const qs = new URLSearchParams({ dataset: ds, limit: "20" });
      if (q.trim()) qs.set("search", q.trim());
      if (lbl !== "all") qs.set("label", lbl);
      setPreview(await apiGet<Preview>(`/api/datasets/preview?${qs.toString()}`));
    } catch (e: any) {
      setPreviewError(e?.message || "Could not load dataset preview.");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !error) {
      loadPreview(selected, rowSearch, rowLabel);
    }
  }, [selected, rowSearch, rowLabel, loading, error, loadPreview]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadError(null);
    setUploadResult(null);

    const ext = "." + (f.name.split(".").pop() || "").toLowerCase();
    if (![".csv", ".json"].includes(ext)) {
      setUploadError(`Unsupported file extension '${ext}'. Please upload a .csv or .json dataset.`);
      e.target.value = "";
      return;
    }
    if (f.size === 0) {
      setUploadError("The selected dataset file is empty.");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_DS_BYTES) {
      setUploadError("File exceeds the 50 MB upload limit.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    setUploadPct(0);
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await apiUploadWithProgress("/api/datasets/upload", form, (pct) => setUploadPct(pct));
      setUploadResult(res);
      notify("Dataset uploaded and schema validated.", "success");
      await load();
    } catch (err: any) {
      setUploadError(err?.message || "Dataset upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <WorkspaceOrPublic
      title="Dataset Registry"
      subtitle="Training corpora, cross-domain evaluation datasets, live row filtering, and custom CSV/JSON upload"
    >
      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FadeIn className="space-y-8">
          <Notice>
            Built-in corpora are verified from their public repositories with original licences and class counts.
            Training datasets, cross-domain evaluation corpora, and referenced-only emotion resources are strictly separated.
          </Notice>

          {/* Built-in Datasets Selector */}
          <div className="grid gap-4 md:grid-cols-2">
            {builtin.map((d) => {
              const isTraining = d.id === "twitter_financial_news";
              const active = selected === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setSelected(d.id);
                    setRowSearch("");
                    setRowLabel("all");
                  }}
                  className={`rounded-xl border p-5 text-left transition-all ${
                    active
                      ? "border-accent/60 bg-surface-elevated/80 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]"
                      : "border-white/[0.08] bg-surface/60 hover:border-white/[0.2]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Database size={16} className="text-cyan-light" />
                      <h3 className="text-sm font-semibold text-white">{d.name}</h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={isTraining ? "green" : "cyan"}>
                        {isTraining ? "Training + In-domain Eval" : "Cross-domain Eval"}
                      </Badge>
                      <Badge tone="slate">
                        <ShieldCheck size={10} /> {d.license}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">{d.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="tabular font-mono font-semibold text-white">{d.n.toLocaleString()}</span> records
                    <span>·</span>
                    <span className="font-mono text-[11px]">{d.columns.join(", ")}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {Object.entries(d.class_distribution).map(([k, v]) => (
                      <span
                        key={k}
                        className="tabular rounded-md border border-white/[0.08] bg-navy-900 px-2 py-0.5 font-mono text-[11px]"
                        style={{ color: sentimentColor(k) }}
                      >
                        {k}: {v.toLocaleString()}
                      </span>
                    ))}
                  </div>
                  <a
                    href={d.source}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 inline-flex items-center gap-1 text-[11px] text-accent-light hover:underline"
                  >
                    Original source <ExternalLink size={10} />
                  </a>
                </button>
              );
            })}
          </div>

          {/* Live Dataset Inspector with Search & Label Filter */}
          <div className="border-t border-white/[0.08] pt-8">
            <SectionTitle
              title="Dataset inspection & row search"
              subtitle="Live quality metrics and searchable rows from processed CSV artifacts"
              action={
                <button
                  type="button"
                  onClick={() => apiDownload(`/api/datasets/download-processed?dataset=${selected}`, `${selected}_processed.csv`)}
                  className="btn-ghost !py-1.5 text-xs"
                >
                  <Download size={13} /> Download processed CSV
                </button>
              }
            />

            {previewError ? (
              <ErrorState message={previewError} onRetry={() => loadPreview(selected, rowSearch, rowLabel)} />
            ) : (
              <div className="space-y-6">
                {preview && (
                  <>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div className="border-l-2 border-accent/60 pl-3.5">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">Total Records</p>
                        <p className="tabular mt-0.5 font-mono text-xl font-semibold text-white">{preview.total.toLocaleString()}</p>
                      </div>
                      <div className="border-l-2 border-amber-400/60 pl-3.5">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">Duplicate Texts</p>
                        <p className="tabular mt-0.5 font-mono text-xl font-semibold text-amber-300">{preview.duplicates}</p>
                      </div>
                      <div className="border-l-2 border-cyan/60 pl-3.5">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">Missing Cells</p>
                        <p className="tabular mt-0.5 font-mono text-xl font-semibold text-slate-200">
                          {Object.values(preview.missing).reduce((a, b) => a + b, 0)}
                        </p>
                      </div>
                      <div className="border-l-2 border-bull/60 pl-3.5">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">Classes</p>
                        <p className="tabular mt-0.5 font-mono text-xl font-semibold text-slate-200">
                          {Object.keys(preview.class_distribution).length}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="label">Class balance</p>
                      {Object.entries(preview.class_distribution).map(([k, v]) => {
                        const pct = (v / preview.total) * 100;
                        return (
                          <div key={k} className="flex items-center gap-3">
                            <span className="w-16 text-xs capitalize text-slate-300">{k}</span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: sentimentColor(k) }} />
                            </div>
                            <span className="tabular w-28 text-right font-mono text-xs text-slate-300">
                              {v.toLocaleString()} ({pct.toFixed(1)}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Search & filter controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative min-w-[220px] flex-1">
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      className="input pl-9"
                      placeholder="Filter rows by text or cashtag (e.g. AAPL, guidance)…"
                      value={rowSearch}
                      onChange={(e) => setRowSearch(e.target.value)}
                    />
                  </div>
                  <select
                    aria-label="Filter by class label"
                    className="input w-44"
                    value={rowLabel}
                    onChange={(e) => setRowLabel(e.target.value)}
                  >
                    <option value="all">All classes</option>
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="negative">Negative</option>
                  </select>
                  {preview?.filtered_total != null && (
                    <span className="tabular font-mono text-xs text-slate-400">
                      {preview.filtered_total.toLocaleString()} matching row(s)
                    </span>
                  )}
                </div>

                {previewLoading ? (
                  <Skeleton className="h-56 w-full" />
                ) : preview && preview.preview.length > 0 ? (
                  <div className="overflow-x-auto border-y border-white/[0.08]">
                    <table className="w-full min-w-[600px]">
                      <thead>
                        <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-slate-400">
                          {Object.keys(preview.preview[0]).map((c) => (
                            <th key={c} className="th">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {preview.preview.map((row, i) => (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            {Object.keys(preview.preview[0]).map((c) => (
                              <td key={c} className="td max-w-[340px] truncate text-xs">
                                {c === "label_str" ? (
                                  <span style={{ color: sentimentColor(String(row[c])) }} className="font-semibold capitalize">
                                    {String(row[c])}
                                  </span>
                                ) : (
                                  String(row[c] ?? "—")
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title="No rows matched your filter"
                    description="Adjust the search text or class dropdown to inspect dataset records."
                  />
                )}
              </div>
            )}
          </div>

          {/* Referenced-only corpora */}
          <div className="border-t border-white/[0.08] pt-8">
            <SectionTitle
              title="Referenced datasets (not bundled)"
              subtitle="Cited for multimodal emotion design — never substituted for financial sentiment"
            />
            <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
              {REFERENCED_CORPORA.map((r) => (
                <div key={r.name} className="flex flex-col justify-between gap-2 py-3.5 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-xs font-semibold text-white">{r.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{r.usage}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Badge tone="slate">Referenced only</Badge>
                    <a href={r.source} target="_blank" rel="noreferrer" className="text-xs text-accent-light hover:underline">
                      Source <ExternalLink size={11} className="inline" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom CSV / JSON Upload */}
          <div className="border-t border-white/[0.08] pt-8">
            <SectionTitle title="Upload custom dataset" subtitle="CSV or JSON with a text column and optional label column (max 50 MB)" />
            {!user ? (
              <EmptyState
                title="Sign in to upload custom datasets"
                description="Uploaded CSV/JSON files and quality reports are stored privately under your researcher account."
                action={
                  <Link href="/login?next=/datasets" className="btn-primary text-xs">
                    Log in to upload
                  </Link>
                }
              />
            ) : (
              <div className="space-y-5">
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-white/[0.15] bg-white/[0.02] px-4 py-8 text-center transition-colors hover:border-accent/50">
                  <Upload size={18} className="text-cyan-light" />
                  <p className="text-sm font-medium text-slate-200">
                    {uploading ? `Uploading & inspecting (${uploadPct}%)…` : "Select a CSV or JSON file"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Automatically detects text/sentence/tweet and label/sentiment columns
                  </p>
                  <input type="file" accept=".csv,.json" className="hidden" onChange={onUpload} disabled={uploading} />
                </label>

                {uploading && (
                  <div className="space-y-1">
                    <ProgressBar value={uploadPct} color="#22d3ee" />
                  </div>
                )}

                {uploadError && <ErrorState message={uploadError} />}

                {uploadResult && (
                  <div className="rounded-xl border border-bull/30 bg-bull/[0.05] p-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-bull">
                      <CheckCircle2 size={14} /> Uploaded &amp; validated: {uploadResult.name}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <div><span className="text-slate-500">Records:</span> <span className="font-mono text-white">{uploadResult.records}</span></div>
                      <div><span className="text-slate-500">Text col:</span> <span className="font-mono text-white">{uploadResult.text_column}</span></div>
                      <div><span className="text-slate-500">Label col:</span> <span className="font-mono text-white">{uploadResult.label_column ?? "none"}</span></div>
                      <div><span className="text-slate-500">Duplicates:</span> <span className="font-mono text-white">{uploadResult.duplicates}</span></div>
                    </div>
                  </div>
                )}

                {userDs.length === 0 ? (
                  <EmptyState title="No custom uploads yet" description="Uploaded CSV/JSON datasets and quality reports appear here." icon={<FileSpreadsheet className="h-6 w-6" />} />
                ) : (
                  <div className="overflow-x-auto border-y border-white/[0.08]">
                    <table className="w-full min-w-[640px]">
                      <thead>
                        <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-slate-400">
                          <th className="th">Filename</th>
                          <th className="th">Records</th>
                          <th className="th">Class Distribution</th>
                          <th className="th">Duplicates</th>
                          <th className="th">Uploaded</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {userDs.map((d) => (
                          <tr key={d.id}>
                            <td className="td text-xs font-medium text-white">{d.name}</td>
                            <td className="tabular td font-mono text-xs">{d.record_count}</td>
                            <td className="td font-mono text-[11px] text-slate-400">{d.class_distribution}</td>
                            <td className="td text-xs">
                              {d.duplicate_count > 0 ? (
                                <span className="flex items-center gap-1 text-amber-300">
                                  <AlertTriangle size={12} /> {d.duplicate_count}
                                </span>
                              ) : (
                                "0"
                              )}
                            </td>
                            <td className="td text-xs text-slate-400">{fmtDate(d.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </FadeIn>
      )}
    </WorkspaceOrPublic>
  );
}
