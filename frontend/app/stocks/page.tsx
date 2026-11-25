"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { AlertTriangle, Gauge, Hash, MessageSquare, Search, TrendingDown, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, EmptyState, ErrorState, Notice, SectionTitle, Spinner, Stat } from "@/components/ui";
import { RequireAuth } from "@/lib/auth";
import { apiGet, fmtDate, sentimentColor } from "@/lib/api";

type Ticker = { ticker: string; mentions: number };
type StockData = {
  ticker: string;
  user_posts: number;
  user_sentiment: Record<string, number>;
  user_modalities?: Record<string, number>;
  average_confidence?: number | null;
  builtin_dataset_posts: number;
  builtin_sentiment: Record<string, number>;
  builtin_samples?: { text: string; label_str: string }[];
  related: any[];
  disclaimer: string;
};

const QUICK_TICKERS = ["AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "SPY"];
const tooltipStyle = {
  background: "#101623",
  border: "1px solid rgba(148,163,184,0.2)",
  borderRadius: 6,
  fontSize: 12,
  color: "#e2e8f0",
};

function StocksInner() {
  const params = useSearchParams();
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [query, setQuery] = useState(params.get("ticker") || "");
  const [selected, setSelected] = useState(params.get("ticker") || "");
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Ticker[]>("/api/stocks")
      .then(setTickers)
      .catch((e: any) => setError(e?.message || "Could not load ticker list."))
      .finally(() => setListLoading(false));
  }, []);

  const load = useCallback(async (t: string) => {
    const clean = t.trim().toUpperCase().replace(/^\$/, "");
    if (!clean) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      setData(await apiGet<StockData>(`/api/stocks/${encodeURIComponent(clean)}`));
    } catch (e: any) {
      setError(e?.message || "Could not load ticker sentiment.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) load(selected);
  }, [selected, load]);

  const filtered = tickers.filter((t) => t.ticker.toLowerCase().includes(query.toLowerCase().replace(/^\$/, "")));

  const chartData = data
    ? ["positive", "neutral", "negative"].map((k) => ({
        name: k,
        user: data.user_sentiment[k] || 0,
        corpus: data.builtin_sentiment[k] || 0,
      }))
    : [];

  const modalityData = data?.user_modalities
    ? Object.entries(data.user_modalities).map(([name, count]) => ({ name, count }))
    : [];

  const trendMap = new Map<string, { date: string; positive: number; neutral: number; negative: number }>();
  (data?.related || []).forEach((r) => {
    const d = new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (!trendMap.has(d)) trendMap.set(d, { date: d, positive: 0, neutral: 0, negative: 0 });
    if (r.sentiment === "positive" || r.sentiment === "negative" || r.sentiment === "neutral") {
      (trendMap.get(d) as any)[r.sentiment] += 1;
    }
  });
  const trendData = Array.from(trendMap.values()).reverse();

  return (
    <AppShell title="Stock & Ticker Sentiment" subtitle="Aggregated sentiment from your analyses and the labelled Twitter financial corpus">
      {listLoading ? (
        <Spinner label="Loading ticker index…" />
      ) : (
        <div className="space-y-5">
          <Notice tone="amber">
            <span className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                FinSentinel does not connect to a live stock market price feed. Counts below reflect sentiment in your
                saved analyses and historical tweets from the Twitter Financial News dataset — never trading signals.
              </span>
            </span>
          </Notice>

          <div className="grid gap-5 lg:grid-cols-[290px_1fr]">
            {/* Sidebar ticker selector */}
            <Card className="h-fit">
              <SectionTitle title="Ticker Search" subtitle={`${tickers.length} cashtags in corpus`} />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const clean = query.trim().toUpperCase().replace(/^\$/, "");
                  if (clean) setSelected(clean);
                }}
                className="space-y-2"
              >
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    className="input pl-8 font-mono uppercase"
                    placeholder="AAPL, TSLA, NVDA…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn-primary w-full !py-1.5 text-xs">
                  Lookup {query.trim() ? `$${query.trim().toUpperCase().replace(/^\$/, "")}` : "ticker"}
                </button>
              </form>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {QUICK_TICKERS.map((qt) => (
                  <button
                    key={qt}
                    type="button"
                    onClick={() => {
                      setQuery(qt);
                      setSelected(qt);
                    }}
                    className={`rounded border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                      selected === qt
                        ? "border-accent bg-accent/15 text-white"
                        : "border-slate-400/20 bg-navy-900 text-slate-400 hover:text-white"
                    }`}
                  >
                    ${qt}
                  </button>
                ))}
              </div>

              <div className="mt-4 max-h-[380px] space-y-0.5 overflow-y-auto border-t border-slate-400/10 pt-3 pr-1">
                {filtered.length === 0 ? (
                  <p className="py-5 text-center text-xs text-slate-500">No corpus cashtags match &ldquo;{query}&rdquo;.</p>
                ) : (
                  filtered.map((t) => (
                    <button
                      key={t.ticker}
                      type="button"
                      onClick={() => {
                        setSelected(t.ticker);
                        setQuery(t.ticker);
                      }}
                      className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors ${
                        selected === t.ticker
                          ? "bg-accent/15 font-medium text-white"
                          : "text-slate-400 hover:bg-surface-elevated hover:text-slate-200"
                      }`}
                    >
                      <span className="font-mono">${t.ticker}</span>
                      <span className="tabular font-mono text-[11px] text-slate-500">{t.mentions}</span>
                    </button>
                  ))
                )}
              </div>
            </Card>

            {/* Ticker detail */}
            <div className="space-y-5">
              {!selected && (
                <Card>
                  <EmptyState
                    title="Select or search a ticker"
                    description="Choose a cashtag from the list or search symbols like AAPL, TSLA, NVDA, or MSFT to view sentiment metrics."
                    icon={<Hash className="h-6 w-6" />}
                  />
                </Card>
              )}
              {loading && (
                <Card>
                  <Spinner label={`Aggregating data for $${selected}…`} />
                </Card>
              )}
              {error && <ErrorState message={error} onRetry={() => load(selected)} />}

              {data && !loading && (
                <div className="animate-fade-in space-y-5">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <Stat label="Your Analyses" value={data.user_posts} hint={`Mentioning $${data.ticker}`} icon={<MessageSquare size={15} />} />
                    <Stat label="Positive" value={data.user_sentiment["positive"] || 0} hint="Bullish count" icon={<TrendingUp size={15} />} accent="text-bull" />
                    <Stat label="Negative" value={data.user_sentiment["negative"] || 0} hint="Bearish count" icon={<TrendingDown size={15} />} accent="text-bear" />
                    <Stat
                      label="Mean Conf."
                      value={data.average_confidence != null ? `${(data.average_confidence * 100).toFixed(1)}%` : "—"}
                      hint="Your analyses"
                      icon={<Gauge size={15} />}
                      accent="text-violet-light"
                    />
                    <Stat label="Corpus Tweets" value={data.builtin_dataset_posts} hint="Labelled reference" icon={<Hash size={15} />} />
                  </div>

                  {data.user_posts === 0 && data.builtin_dataset_posts === 0 ? (
                    <Card>
                      <EmptyState
                        title={`No sentiment data found for $${data.ticker}`}
                        description="Neither your saved analyses nor the training corpus contain mentions of this symbol yet."
                        action={
                          <Link href="/analyze" className="btn-primary text-xs">
                            Analyze a ${data.ticker} post
                          </Link>
                        }
                      />
                    </Card>
                  ) : (
                    <>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <Card>
                          <SectionTitle title={`$${data.ticker} sentiment distribution`} subtitle="Your analyses vs. labelled corpus" />
                          <div className="h-[230px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Legend iconType="square" wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                                <Bar dataKey="user" name="Your analyses" radius={[4, 4, 0, 0]}>
                                  {chartData.map((d) => (
                                    <Cell key={d.name} fill={sentimentColor(d.name)} />
                                  ))}
                                </Bar>
                                <Bar dataKey="corpus" name="Training corpus" fill="#334155" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </Card>

                        <Card>
                          <SectionTitle title="Modality & timeline" subtitle="Your ticker breakdown" />
                          {trendData.length >= 2 ? (
                            <div className="h-[230px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                                  <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                                  <Tooltip contentStyle={tooltipStyle} />
                                  <Line type="monotone" dataKey="positive" stroke="#10b981" strokeWidth={2} />
                                  <Line type="monotone" dataKey="neutral" stroke="#94a3b8" strokeWidth={2} />
                                  <Line type="monotone" dataKey="negative" stroke="#ef4444" strokeWidth={2} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          ) : modalityData.length > 0 ? (
                            <div className="space-y-3">
                              <p className="text-xs text-slate-400">
                                Modality breakdown across your {data.user_posts} analysis record(s) (time-trend chart activates once analyses span 2+ days):
                              </p>
                              <div className="space-y-2">
                                {modalityData.map((m) => (
                                  <div key={m.name} className="flex items-center justify-between rounded border border-slate-400/15 bg-navy-900 px-3 py-2 text-xs">
                                    <span className="capitalize text-slate-300">{m.name}</span>
                                    <span className="tabular font-mono font-semibold text-white">{m.count}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <EmptyState
                              title="No user analyses for this ticker yet"
                              description="Corpus statistics are available on the left; analyze a post with this ticker to track your own breakdown."
                            />
                          )}
                        </Card>
                      </div>

                      <Card>
                        <SectionTitle title="Your recent analyzed posts" subtitle={`Saved records tagged $${data.ticker}`} />
                        {data.related.length === 0 ? (
                          <EmptyState
                            title="No personal analyses for this ticker"
                            description="Run an analysis mentioning this cashtag to populate your feed."
                            action={
                              <Link href="/analyze" className="btn-primary text-xs">
                                Analyze ${data.ticker}
                              </Link>
                            }
                          />
                        ) : (
                          <ul className="divide-y divide-slate-400/10">
                            {data.related.map((r) => (
                              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                                <div className="min-w-0 flex-1">
                                  <Link href={`/history/${r.id}`} className="block truncate text-xs font-medium text-slate-200 hover:text-accent-light">
                                    {r.input_text || "(media upload)"}
                                  </Link>
                                  <p className="mt-0.5 text-[11px] text-slate-500">
                                    {fmtDate(r.created_at)} · {r.modality}
                                    {r.confidence != null ? ` · conf ${(Number(r.confidence) * 100).toFixed(1)}%` : ""}
                                  </p>
                                </div>
                                <Badge tone={r.sentiment === "positive" ? "green" : r.sentiment === "negative" ? "red" : "slate"}>
                                  {r.sentiment ?? "unclassified"}
                                </Badge>
                              </li>
                            ))}
                          </ul>
                        )}
                      </Card>

                      {data.builtin_samples && data.builtin_samples.length > 0 && (
                        <Card>
                          <SectionTitle title="Sample corpus mentions" subtitle="Labelled tweets from Twitter Financial News Sentiment" />
                          <ul className="divide-y divide-slate-400/10">
                            {data.builtin_samples.map((s, idx) => (
                              <li key={idx} className="flex items-start justify-between gap-3 py-2.5 text-xs">
                                <span className="text-slate-300">{s.text}</span>
                                <Badge tone={s.label_str === "positive" ? "green" : s.label_str === "negative" ? "red" : "slate"}>
                                  {s.label_str}
                                </Badge>
                              </li>
                            ))}
                          </ul>
                        </Card>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function StocksPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<AppShell title="Stock & Ticker Sentiment"><Spinner /></AppShell>}>
        <StocksInner />
      </Suspense>
    </RequireAuth>
  );
}
