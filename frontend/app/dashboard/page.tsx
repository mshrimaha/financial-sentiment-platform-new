"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Database,
  Gauge,
  Image as ImageIcon,
  MessageSquare,
  RefreshCw,
  ScanSearch,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, EmptyState, ErrorState, Notice, SectionTitle, Skeleton, Stat } from "@/components/ui";
import { AnimatedCounter, FadeIn } from "@/components/Motion";
import { RequireAuth } from "@/lib/auth";
import { apiGet, fmtDate, sentimentColor } from "@/lib/api";

type Stats = {
  total_analyses: number;
  average_confidence: number | null;
  sentiment_counts: Record<string, number>;
  modality_counts: Record<string, number>;
  media_counts: Record<string, number>;
  top_tickers: [string, number][];
  dataset_sentiment_distribution: Record<string, number>;
  note: string;
};

type Analysis = {
  id: string;
  modality: string;
  input_text: string | null;
  sentiment: string | null;
  confidence: number | null;
  engagement_score: number | null;
  created_at: string;
  status: string;
};

type EvalRow = {
  model: string;
  dataset: string;
  accuracy: number;
  f1_macro: number;
};

const tooltipStyle = {
  background: "#0c121e",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  fontSize: 12,
  color: "#e2e8f0",
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [evalRows, setEvalRows] = useState<EvalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, a, m] = await Promise.all([
        apiGet<Stats>("/api/dashboard/stats"),
        apiGet<Analysis[]>("/api/analyses?limit=100"),
        apiGet<{ results: EvalRow[] }>("/api/models/results").catch(() => ({ results: [] })),
      ]);
      setStats(s);
      setAnalyses(a);
      setEvalRows((m.results || []).filter((r) => r.dataset === "twitter_financial_news"));
    } catch (e: any) {
      setError(e?.message || "Could not load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sentimentData = stats
    ? ["positive", "neutral", "negative", "mixed"]
        .map((k) => ({ name: k, value: stats.sentiment_counts[k] || 0 }))
        .filter((d) => d.value > 0)
    : [];

  const modalityData = stats
    ? Object.entries(stats.modality_counts).map(([k, v]) => ({ name: k, count: v }))
    : [];

  const datasetData = stats
    ? ["positive", "neutral", "negative"].map((k) => ({
        name: k,
        value: stats.dataset_sentiment_distribution[k] || 0,
      }))
    : [];

  const trendMap = new Map<string, { date: string; positive: number; neutral: number; negative: number }>();
  analyses.forEach((a) => {
    const d = new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (!trendMap.has(d)) trendMap.set(d, { date: d, positive: 0, neutral: 0, negative: 0 });
    if (a.sentiment === "positive" || a.sentiment === "negative" || a.sentiment === "neutral") {
      (trendMap.get(d) as any)[a.sentiment] += 1;
    }
  });
  const trendData = Array.from(trendMap.values()).reverse();

  const total = stats?.total_analyses ?? 0;
  const pos = stats?.sentiment_counts["positive"] ?? 0;
  const neg = stats?.sentiment_counts["negative"] ?? 0;
  const neu = stats?.sentiment_counts["neutral"] ?? 0;

  return (
    <RequireAuth>
      <AppShell
        title="Overview"
        subtitle="Workspace metrics computed from your persisted analyses and trained model benchmarks"
        actions={
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="btn-ghost !px-3 !py-1.5 text-xs"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        }
      >
        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <FadeIn className="space-y-8">
            {/* Quick Actions Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div className="flex flex-wrap gap-2">
                <Link href="/analyze?tab=text" className="btn-primary !py-1.5 text-xs">
                  <ScanSearch size={13} /> Analyze Text
                </Link>
                <Link href="/analyze?tab=image" className="btn-ghost !py-1.5 text-xs">
                  <ImageIcon size={13} /> OCR Image
                </Link>
                <Link href="/models" className="btn-ghost !py-1.5 text-xs">
                  <BarChart3 size={13} /> Model Benchmarks
                </Link>
                <Link href="/datasets" className="btn-ghost !py-1.5 text-xs">
                  <Database size={13} /> Explore Datasets
                </Link>
              </div>
              <span className="text-[11px] text-slate-500">Scoped to your authenticated account</span>
            </div>

            {/* Open Inline KPI Row */}
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-5">
              <Stat
                label="Total Analyses"
                value={<AnimatedCounter value={total} />}
                hint="All modalities combined"
                icon={<Activity size={15} />}
              />
              <Stat
                label="Bullish (Positive)"
                value={<AnimatedCounter value={pos} />}
                hint={`${total ? ((pos / total) * 100).toFixed(1) : "0.0"}% share`}
                icon={<TrendingUp size={15} />}
                accent="text-bull"
              />
              <Stat
                label="Bearish (Negative)"
                value={<AnimatedCounter value={neg} />}
                hint={`${total ? ((neg / total) * 100).toFixed(1) : "0.0"}% share`}
                icon={<TrendingDown size={15} />}
                accent="text-bear"
              />
              <Stat
                label="Neutral"
                value={<AnimatedCounter value={neu} />}
                hint={`${total ? ((neu / total) * 100).toFixed(1) : "0.0"}% share`}
                icon={<MessageSquare size={15} />}
                accent="text-slate-400"
              />
              <Stat
                label="Mean Confidence"
                value={
                  stats?.average_confidence != null ? (
                    <AnimatedCounter value={stats.average_confidence * 100} decimals={1} suffix="%" />
                  ) : (
                    "—"
                  )
                }
                hint={stats?.average_confidence != null ? "Classified records" : "No predictions yet"}
                icon={<Gauge size={15} />}
                accent="text-cyan-light"
              />
            </div>

            <Notice>
              {stats?.note} Reactions and emojis are tracked on separate engagement/emotion axes and do not vote on sentiment.
            </Notice>

            {/* Primary Charts */}
            <div className="grid gap-8 border-t border-white/[0.08] pt-7 lg:grid-cols-3">
              <div>
                <SectionTitle title="Sentiment distribution" subtitle="Your analysed records" />
                {sentimentData.length === 0 ? (
                  <EmptyState
                    title="No sentiment records yet"
                    description="Analyze text, images, audio, or video to populate this chart."
                    action={
                      <Link href="/analyze" className="btn-primary text-xs">
                        <ScanSearch size={14} /> Open Analyzer
                      </Link>
                    }
                  />
                ) : (
                  <div className="h-[235px] rounded-xl border border-white/[0.07] bg-surface/50 p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sentimentData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={52}
                          outerRadius={80}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {sentimentData.map((d) => (
                            <Cell key={d.name} fill={sentimentColor(d.name)} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div>
                <SectionTitle title="Modality distribution" subtitle="Breakdown by input type" />
                {modalityData.length === 0 ? (
                  <EmptyState
                    title="No modalities recorded"
                    description="Text, image, audio, and video counts appear here."
                  />
                ) : (
                  <div className="h-[235px] rounded-xl border border-white/[0.07] bg-surface/50 p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={modalityData} layout="vertical" margin={{ top: 6, right: 16, left: 4, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" width={64} tick={{ fill: "#cbd5e1", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                        <Bar dataKey="count" name="Analyses" fill="#3b82f6" radius={[0, 5, 5, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div>
                <SectionTitle title="Most analyzed tickers" subtitle="Cashtags &amp; explicit symbols" />
                {!stats?.top_tickers?.length ? (
                  <EmptyState
                    title="No tickers tracked yet"
                    description="Include $AAPL or specify a ticker symbol during analysis."
                  />
                ) : (
                  <ul className="divide-y divide-white/[0.06] border-y border-white/[0.07]">
                    {stats.top_tickers.map(([ticker, count], idx) => {
                      const max = stats.top_tickers[0][1] || 1;
                      return (
                        <li key={ticker}>
                          <Link
                            href={`/stocks?ticker=${encodeURIComponent(ticker)}`}
                            className="group flex items-center gap-3 py-2.5 transition-colors hover:bg-white/[0.02]"
                          >
                            <span className="tabular w-4 font-mono text-[11px] text-slate-500">{idx + 1}</span>
                            <span className="w-16 font-mono text-xs font-semibold text-white">${ticker}</span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                              <div className="h-full rounded-full bg-cyan-light" style={{ width: `${(count / max) * 100}%` }} />
                            </div>
                            <span className="tabular w-8 text-right font-mono text-xs text-slate-300">{count}</span>
                            <ArrowUpRight size={13} className="text-slate-600 group-hover:text-cyan-light" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Trend & Corpus Baseline */}
            <div className="grid gap-8 border-t border-white/[0.08] pt-7 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SectionTitle title="Analysis trends over time" subtitle="Daily counts grouped by predicted sentiment" />
                {trendData.length === 0 ? (
                  <EmptyState
                    title="No timeline data yet"
                    description="Trends appear automatically as you analyze content across one or more days."
                  />
                ) : (
                  <div className="h-[240px] rounded-xl border border-white/[0.07] bg-surface/50 p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                        <Line type="monotone" dataKey="positive" name="Positive" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="neutral" name="Neutral" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="negative" name="Negative" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div>
                <SectionTitle title="Training corpus baseline" subtitle="Twitter Financial News (11,931)" />
                <div className="h-[240px] rounded-xl border border-white/[0.07] bg-surface/50 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={datasetData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                      <Bar dataKey="value" name="Tweets" radius={[4, 4, 0, 0]}>
                        {datasetData.map((d) => (
                          <Cell key={d.name} fill={sentimentColor(d.name)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Available Models Strip */}
            {evalRows.length > 0 && (
              <div className="border-t border-white/[0.08] pt-7">
                <SectionTitle
                  title="Available trained classifiers"
                  subtitle="Measured 80:20 evaluation on Twitter Financial News Sentiment"
                  action={
                    <Link href="/models" className="text-xs font-medium text-accent-light hover:underline">
                      Compare all models →
                    </Link>
                  }
                />
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {evalRows.map((m) => (
                    <div key={m.model} className="border-l-2 border-accent/40 pl-3.5">
                      <p className="text-xs font-semibold text-white">{m.model}</p>
                      <p className="mt-1 font-mono text-xs text-slate-300">
                        Acc {(m.accuracy * 100).toFixed(2)}% · <span className="text-cyan-light">F1 {(m.f1_macro * 100).toFixed(2)}%</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Analyses Table */}
            <div className="border-t border-white/[0.08] pt-7">
              <SectionTitle
                title="Recent activity"
                subtitle="Click any record to inspect its full multimodal breakdown"
                action={
                  <Link href="/history" className="btn-ghost !py-1.5 text-xs">
                    Open full history
                  </Link>
                }
              />
              {analyses.length === 0 ? (
                <EmptyState
                  title="No analyses recorded yet"
                  description="Run your first financial text or media analysis to see saved records here."
                  action={
                    <Link href="/analyze" className="btn-primary text-xs">
                      <ScanSearch size={14} /> Analyze content
                    </Link>
                  }
                />
              ) : (
                <div className="overflow-x-auto border-y border-white/[0.08]">
                  <table className="w-full min-w-[680px]">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-slate-400">
                        <th className="th">Modality</th>
                        <th className="th">Content / File</th>
                        <th className="th">Sentiment</th>
                        <th className="th">Confidence</th>
                        <th className="th">Engagement</th>
                        <th className="th">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {analyses.slice(0, 8).map((a) => (
                        <tr key={a.id} className="transition-colors hover:bg-white/[0.03]">
                          <td className="td">
                            <Badge tone="blue">{a.modality}</Badge>
                          </td>
                          <td className="td max-w-[300px] truncate">
                            <Link href={`/history/${a.id}`} className="font-medium text-slate-200 hover:text-cyan-light">
                              {a.input_text || "(untitled)"}
                            </Link>
                          </td>
                          <td className="td">
                            {a.sentiment ? (
                              <span style={{ color: sentimentColor(a.sentiment) }} className="text-xs font-semibold capitalize">
                                {a.sentiment}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">unclassified</span>
                            )}
                          </td>
                          <td className="tabular td font-mono text-xs">
                            {a.confidence != null ? `${(a.confidence * 100).toFixed(1)}%` : "—"}
                          </td>
                          <td className="tabular td font-mono text-xs">
                            {a.engagement_score != null ? a.engagement_score.toFixed(0) : "—"}
                          </td>
                          <td className="td text-xs text-slate-400">{fmtDate(a.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </FadeIn>
        )}
      </AppShell>
    </RequireAuth>
  );
}
