"use client";
import { useCallback, useEffect, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, PieChart, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, EmptyState, ErrorState, Notice, SectionTitle, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { RequireAuth } from "@/lib/auth";
import { apiDownload, apiGet, fmtDate, sentimentColor } from "@/lib/api";

type Report = { id: string; title: string; report_type: string; summary: string; created_at: string };
type EvalData = { results: any[]; dataset_info: Record<string, any> };
type Analysis = { id: string; modality: string; sentiment: string | null; created_at: string };

export default function ReportsPage() {
  const { notify } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [evalData, setEvalData] = useState<EvalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reportType, setReportType] = useState<"summary" | "models" | "ticker" | "multimodal">("summary");
  const [tickerFilter, setTickerFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, a, e] = await Promise.all([
        apiGet<Report[]>("/api/reports"),
        apiGet<Analysis[]>("/api/analyses"),
        apiGet<EvalData>("/api/models/results"),
      ]);
      setReports(r);
      setAnalyses(a);
      setEvalData(e);
    } catch (e: any) {
      setError(e?.message || "Could not load reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function genPdf() {
    if (reportType === "ticker" && !tickerFilter.trim()) {
      setActionError("Enter a ticker symbol (e.g. AAPL) for a ticker-filtered report.");
      return;
    }
    setBusy("pdf");
    setActionError(null);
    try {
      await apiDownload(
        "/api/reports/generate-pdf",
        `finsentinel_${reportType}_report.pdf`,
        "POST",
        { report_type: reportType, ticker: reportType === "ticker" ? tickerFilter.trim().toUpperCase() : null }
      );
      notify("PDF report generated and downloaded.", "success");
      await load();
    } catch (e: any) {
      setActionError(e?.message || "PDF generation failed.");
    } finally {
      setBusy(null);
    }
  }

  async function genCsv() {
    setBusy("csv");
    setActionError(null);
    try {
      await apiDownload("/api/reports/export-csv", "finsentinel_analyses.csv");
      notify("CSV export downloaded.", "success");
    } catch (e: any) {
      setActionError(e?.message || "CSV export failed.");
    } finally {
      setBusy(null);
    }
  }

  const bySentiment = analyses.reduce<Record<string, number>>((acc, a) => {
    if (a.sentiment) acc[a.sentiment] = (acc[a.sentiment] || 0) + 1;
    return acc;
  }, {});

  const twitterRows = evalData?.results.filter((r) => r.dataset === "twitter_financial_news") ?? [];
  const pbRows = evalData?.results.filter((r) => r.dataset === "financial_phrasebank") ?? [];

  return (
    <RequireAuth>
      <AppShell title="Reports & Exports" subtitle="Generate formatted PDF research reports and export UTF-8 CSV analysis logs">
        {loading ? (
          <Spinner label="Loading report workspace…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <div className="animate-fade-in space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* PDF Generator */}
              <Card className="flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <FileText size={18} className="text-bear" />
                    <h2 className="text-sm font-semibold text-white">Generate PDF Report</h2>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                    Creates a ReportLab PDF combining real model benchmarks and your saved analysis records.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="rep-type">Report template</label>
                      <select
                        id="rep-type"
                        className="input"
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value as any)}
                      >
                        <option value="summary">Analysis Summary Report</option>
                        <option value="models">Model Metrics Report</option>
                        <option value="ticker">Ticker Analysis Report</option>
                        <option value="multimodal">Multimodal Analysis Report</option>
                      </select>
                    </div>
                    {reportType === "ticker" && (
                      <div>
                        <label className="label" htmlFor="rep-ticker">Ticker symbol</label>
                        <input
                          id="rep-ticker"
                          className="input font-mono uppercase"
                          placeholder="AAPL"
                          value={tickerFilter}
                          onChange={(e) => setTickerFilter(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <button type="button" onClick={genPdf} disabled={busy !== null} className="btn-primary mt-5 w-full text-xs">
                  {busy === "pdf" ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Generating PDF…
                    </>
                  ) : (
                    <>
                      <Download size={14} /> Generate &amp; Download PDF
                    </>
                  )}
                </button>
              </Card>

              {/* CSV Export */}
              <Card className="flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet size={18} className="text-bull" />
                    <h2 className="text-sm font-semibold text-white">Export Analysis Records (CSV)</h2>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                    Downloads a UTF-8 CSV containing every persisted analysis in your workspace: ID, modality,
                    classifier used, platform, input text, extracted text, sentiment, confidence, engagement, tickers, and timestamp.
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded border border-slate-400/15 bg-navy-900 p-2.5">
                      <p className="text-[10px] uppercase text-slate-500">Total rows</p>
                      <p className="tabular font-mono text-sm font-semibold text-white">{analyses.length}</p>
                    </div>
                    <div className="rounded border border-slate-400/15 bg-navy-900 p-2.5">
                      <p className="text-[10px] uppercase text-slate-500">Bullish</p>
                      <p className="tabular font-mono text-sm font-semibold text-bull">{bySentiment["positive"] || 0}</p>
                    </div>
                    <div className="rounded border border-slate-400/15 bg-navy-900 p-2.5">
                      <p className="text-[10px] uppercase text-slate-500">Bearish</p>
                      <p className="tabular font-mono text-sm font-semibold text-bear">{bySentiment["negative"] || 0}</p>
                    </div>
                  </div>
                </div>

                <button type="button" onClick={genCsv} disabled={busy !== null} className="btn-ghost mt-5 w-full text-xs">
                  {busy === "csv" ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Exporting CSV…
                    </>
                  ) : (
                    <>
                      <Download size={14} /> Download CSV Export
                    </>
                  )}
                </button>
              </Card>
            </div>

            {actionError && <ErrorState message={actionError} />}

            {/* Benchmark Table Included in PDFs */}
            <Card>
              <SectionTitle title="Included model benchmarks" subtitle="Measured metrics attached to Summary and Model Reports" />
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full min-w-[540px]">
                  <thead>
                    <tr className="border-y border-slate-400/15 bg-navy-900/70">
                      <th className="th">Classifier</th>
                      <th className="th">Twitter Acc</th>
                      <th className="th">Twitter Macro-F1</th>
                      <th className="th">PhraseBank Acc</th>
                      <th className="th">PhraseBank Macro-F1</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400/10">
                    {twitterRows.map((t) => {
                      const p = pbRows.find((r) => r.model === t.model);
                      return (
                        <tr key={t.model}>
                          <td className="td text-xs font-medium text-white">{t.model}</td>
                          <td className="tabular td font-mono text-xs">{(t.accuracy * 100).toFixed(2)}%</td>
                          <td className="tabular td font-mono text-xs">{(t.f1_macro * 100).toFixed(2)}%</td>
                          <td className="tabular td font-mono text-xs">{p ? `${(p.accuracy * 100).toFixed(2)}%` : "—"}</td>
                          <td className="tabular td font-mono text-xs">{p ? `${(p.f1_macro * 100).toFixed(2)}%` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Generated Reports History */}
            <Card>
              <SectionTitle
                title="Generated report history"
                subtitle="Downloadable PDF snapshots stored for your account"
                action={
                  <button type="button" onClick={load} className="btn-ghost !py-1.5 text-xs">
                    <RefreshCw size={12} /> Refresh
                  </button>
                }
              />
              {reports.length === 0 ? (
                <EmptyState
                  title="No PDF reports generated yet"
                  description="Select a template above and click Generate & Download PDF to create your first report."
                  icon={<PieChart className="h-6 w-6" />}
                />
              ) : (
                <div className="divide-y divide-slate-400/10">
                  {reports.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="flex items-center gap-3">
                        <FileText size={16} className="shrink-0 text-bear" />
                        <div>
                          <p className="text-xs font-semibold text-white">{r.title}</p>
                          <p className="text-[11px] text-slate-400">
                            {r.summary} · {fmtDate(r.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone="blue">{r.report_type.toUpperCase()}</Badge>
                        <button
                          type="button"
                          onClick={() =>
                            apiDownload(`/api/reports/${r.id}/download`, `finsentinel_${r.report_type}_report.pdf`)
                              .catch((err) => notify(err?.message || "Could not download report.", "error"))
                          }
                          className="btn-ghost !px-2.5 !py-1 text-xs"
                        >
                          <Download size={12} /> Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Notice>
              Every exported report is generated dynamically from your database records and verified model evaluation JSON.
            </Notice>
          </div>
        )}
      </AppShell>
    </RequireAuth>
  );
}
