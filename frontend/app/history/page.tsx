"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Filter, History as HistoryIcon, Search, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, EmptyState, ErrorState, SectionTitle, Skeleton } from "@/components/ui";
import { FadeIn, EASE_OUT } from "@/components/Motion";
import { useToast } from "@/components/Toast";
import { RequireAuth } from "@/lib/auth";
import { apiDelete, apiGet, fmtDate, sentimentColor } from "@/lib/api";

type AnalysisRow = {
  id: string;
  modality: string;
  input_text: string | null;
  extracted_text: string | null;
  sentiment: string | null;
  confidence: number | null;
  engagement_score: number | null;
  tickers: string[];
  platform?: string | null;
  model_used?: string | null;
  status: string;
  created_at: string;
};

export default function HistoryPage() {
  const { notify } = useToast();
  const [items, setItems] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sentiment, setSentiment] = useState("all");
  const [modality, setModality] = useState("all");
  const [ticker, setTicker] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<AnalysisRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageSize = 15;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: "300", sort });
      if (search.trim()) qs.set("search", search.trim());
      if (sentiment !== "all") qs.set("sentiment", sentiment);
      if (modality !== "all") qs.set("modality", modality);
      if (ticker.trim()) qs.set("ticker", ticker.trim());
      if (dateFrom) qs.set("date_from", dateFrom);
      if (dateTo) qs.set("date_to", dateTo);
      const rows = await apiGet<AnalysisRow[]>(`/api/analyses?${qs.toString()}`);
      setItems(rows);
      setPage(1);
    } catch (e: any) {
      setError(e?.message || "Could not load analysis history.");
    } finally {
      setLoading(false);
    }
  }, [search, sentiment, modality, ticker, dateFrom, dateTo, sort]);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/analyses/${deleteTarget.id}`);
      setItems((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      notify("Analysis deleted.", "success");
      setDeleteTarget(null);
    } catch (e: any) {
      notify(e?.message || "Could not delete analysis.", "error");
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const paged = items.slice((page - 1) * pageSize, page * pageSize);

  return (
    <RequireAuth>
      <AppShell title="Analysis History" subtitle="Search, filter, inspect, and manage your persisted sentiment archive">
        <FadeIn className="space-y-6">
          {/* Open Filter Toolbar */}
          <div className="border-b border-white/[0.08] pb-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <Filter size={14} className="text-cyan-light" /> Filters &amp; Search
              </span>
              {(search || sentiment !== "all" || modality !== "all" || ticker || dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSentiment("all");
                    setModality("all");
                    setTicker("");
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Reset filters
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="lg:col-span-2">
                <label className="label" htmlFor="hist-search">Keyword search</label>
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="hist-search"
                    className="input pl-9"
                    placeholder="Search text, OCR output, explanation…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="hist-sent">Sentiment</label>
                <select id="hist-sent" className="input" value={sentiment} onChange={(e) => setSentiment(e.target.value)}>
                  <option value="all">All sentiments</option>
                  <option value="positive">Positive (Bullish)</option>
                  <option value="negative">Negative (Bearish)</option>
                  <option value="neutral">Neutral</option>
                  <option value="mixed">Mixed</option>
                  <option value="unclassified">Unclassified</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="hist-mod">Modality</label>
                <select id="hist-mod" className="input" value={modality} onChange={(e) => setModality(e.target.value)}>
                  <option value="all">All modalities</option>
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="audio">Audio</option>
                  <option value="video">Video</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="hist-ticker">Ticker</label>
                <input
                  id="hist-ticker"
                  className="input font-mono uppercase"
                  placeholder="AAPL"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="hist-sort">Sort</label>
                <select id="hist-sort" className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="confidence_desc">Highest confidence</option>
                </select>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div>
                <label className="label" htmlFor="hist-from">From date</label>
                <input id="hist-from" type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="hist-to">To date</label>
                <input id="hist-to" type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Results */}
          <div>
            <SectionTitle
              title="Saved analysis records"
              subtitle={`${items.length} matching record(s) owned by your account`}
            />
            {loading ? (
              <div className="space-y-2.5">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <ErrorState message={error} onRetry={load} />
            ) : items.length === 0 ? (
              <EmptyState
                title="No matching analyses"
                description="Try clearing filters or analyze new financial content to populate your archive."
                icon={<HistoryIcon className="h-6 w-6" />}
                action={
                  <Link href="/analyze" className="btn-primary text-xs">
                    Analyze content
                  </Link>
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto border-y border-white/[0.08]">
                  <table className="w-full min-w-[820px]">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-slate-400">
                        <th className="th">Modality</th>
                        <th className="th">Content / File</th>
                        <th className="th">Tickers</th>
                        <th className="th">Sentiment</th>
                        <th className="th">Confidence</th>
                        <th className="th">When</th>
                        <th className="th text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {paged.map((row) => (
                        <tr key={row.id} className="transition-colors hover:bg-white/[0.03]">
                          <td className="td">
                            <Badge tone="blue">{row.modality}</Badge>
                          </td>
                          <td className="td max-w-[300px]">
                            <Link href={`/history/${row.id}`} className="block truncate font-medium text-slate-200 hover:text-cyan-light">
                              {row.input_text || row.extracted_text || "(untitled)"}
                            </Link>
                          </td>
                          <td className="td">
                            {row.tickers?.length ? (
                              <div className="flex flex-wrap gap-1">
                                {row.tickers.slice(0, 3).map((t) => (
                                  <span key={t} className="rounded border border-white/[0.1] bg-navy-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                                    ${t}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">—</span>
                            )}
                          </td>
                          <td className="td">
                            {row.sentiment ? (
                              <span style={{ color: sentimentColor(row.sentiment) }} className="text-xs font-semibold capitalize">
                                {row.sentiment}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">unclassified</span>
                            )}
                          </td>
                          <td className="tabular td font-mono text-xs">
                            {row.confidence != null ? `${(row.confidence * 100).toFixed(1)}%` : "—"}
                          </td>
                          <td className="td text-xs text-slate-400">{fmtDate(row.created_at)}</td>
                          <td className="td text-right">
                            <div className="inline-flex items-center gap-1">
                              <Link
                                href={`/history/${row.id}`}
                                className="rounded p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white"
                                aria-label="View analysis details"
                                title="Inspect details"
                              >
                                <Eye size={14} />
                              </Link>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(row)}
                                className="rounded p-1.5 text-slate-400 hover:bg-bear/10 hover:text-red-300"
                                aria-label="Delete analysis"
                                title="Delete record"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Page {page} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="btn-ghost !px-3 !py-1 text-xs"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="btn-ghost !px-3 !py-1 text-xs"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </FadeIn>

        {/* Animated Delete confirmation modal */}
        <AnimatePresence>
          {deleteTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="del-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.18, ease: EASE_OUT }}
                className="panel w-full max-w-md p-6"
              >
                <div className="flex items-start justify-between">
                  <h3 id="del-title" className="text-base font-semibold text-white">
                    Delete analysis record?
                  </h3>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="text-slate-400 hover:text-white"
                    aria-label="Close modal"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  This permanently removes{" "}
                  <span className="text-slate-200">
                    &ldquo;{(deleteTarget.input_text || deleteTarget.id).slice(0, 80)}&rdquo;
                  </span>{" "}
                  from your account history.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" onClick={() => setDeleteTarget(null)} className="btn-ghost text-xs">
                    Cancel
                  </button>
                  <button type="button" onClick={confirmDelete} disabled={deleting} className="btn-danger text-xs">
                    {deleting ? "Deleting…" : "Delete record"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </AppShell>
    </RequireAuth>
  );
}
