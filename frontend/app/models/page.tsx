"use client";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Clock, Cpu, GitCompare, Info, Trophy } from "lucide-react";
import { WorkspaceOrPublic } from "@/components/WorkspaceOrPublic";
import { Badge, ErrorState, Notice, SectionTitle, Skeleton } from "@/components/ui";
import { EASE_OUT, FadeIn } from "@/components/Motion";
import { apiGet } from "@/lib/api";

type Result = {
  model: string;
  dataset: string;
  accuracy: number;
  precision_macro: number;
  recall_macro: number;
  f1_macro: number;
  train_time_s: number;
  inference_time_s: number;
  n_train: number;
  n_test: number;
  confusion_matrix: number[][];
  labels_order: string[];
  classification_report?: Record<string, { precision: number; recall: number; "f1-score": number; support: number }>;
};

type EvalData = {
  results: Result[];
  cross_domain: { experiment: string; model: string; accuracy: number; f1_macro: number }[];
  dataset_info: Record<string, { n: number; dist: Record<string, number>; source: string; license: string }>;
};

type ModelInfo = { best_model?: string; labels?: string[]; trained_on?: string; tfidf?: any };

const tooltipStyle = {
  background: "#0c121e",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  fontSize: 12,
  color: "#e2e8f0",
};
const LABEL_COLORS: Record<string, string> = { negative: "#ef4444", neutral: "#94a3b8", positive: "#10b981" };

export default function ModelsPage() {
  const [data, setData] = useState<EvalData | null>(null);
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataset, setDataset] = useState<"twitter_financial_news" | "financial_phrasebank">("twitter_financial_news");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, i] = await Promise.all([
        apiGet<EvalData>("/api/models/results"),
        apiGet<ModelInfo>("/api/models/info"),
      ]);
      setData(d);
      setInfo(i);
    } catch (e: any) {
      setError(e?.message || "Could not load evaluation results.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.results.filter((r) => r.dataset === dataset) ?? [];
  const best = rows.length ? rows.reduce((a, b) => (b.f1_macro > a.f1_macro ? b : a)) : null;
  const activeModel = rows.find((r) => r.model === (selectedModel ?? best?.model)) ?? null;

  const chartData = rows.map((r) => ({
    name: r.model
      .replace("Multinomial Naive Bayes", "Naive Bayes")
      .replace("Logistic Regression", "LogReg")
      .replace("Random Forest", "RandForest"),
    Accuracy: +(r.accuracy * 100).toFixed(2),
    "Macro F1": +(r.f1_macro * 100).toFixed(2),
    Precision: +(r.precision_macro * 100).toFixed(2),
    Recall: +(r.recall_macro * 100).toFixed(2),
  }));

  const timeData = rows.map((r) => ({
    name: r.model.replace("Multinomial Naive Bayes", "Naive Bayes"),
    seconds: r.train_time_s,
  }));

  return (
    <WorkspaceOrPublic
      title="Model Results & Benchmarks"
      subtitle="Measured evaluation metrics from scikit-learn training runs on genuine financial corpora"
    >
      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data ? null : (
        <FadeIn className="space-y-8">
          <Notice tone="amber">
            <strong>Genuine evaluation output:</strong> Metrics are served directly from{" "}
            <code className="font-mono">evaluation_results.json</code> produced by{" "}
            <code className="font-mono">scripts/train_models.py</code> (stratified 80:20 split, random_state=42,
            TF-IDF unigram+bigram, min_df=2).
          </Notice>

          {/* Segmented Dataset Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
            <div className="relative inline-flex rounded-lg border border-white/[0.1] bg-navy-900 p-1">
              {(["twitter_financial_news", "financial_phrasebank"] as const).map((d) => {
                const active = dataset === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDataset(d);
                      setSelectedModel(null);
                    }}
                    className={`relative z-10 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      active ? "text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="models-ds-tab"
                        className="absolute inset-0 -z-10 rounded-md bg-accent"
                        transition={{ type: "spring", stiffness: 360, damping: 30 }}
                      />
                    )}
                    {d === "twitter_financial_news"
                      ? `Twitter Financial News (${data.dataset_info[d]?.n.toLocaleString()})`
                      : `Financial PhraseBank (${data.dataset_info[d]?.n.toLocaleString()})`}
                  </button>
                );
              })}
            </div>
            {info?.best_model && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <Cpu size={14} className="text-cyan-light" /> Active default classifier:{" "}
                <strong className="text-white">{info.best_model}</strong>
              </span>
            )}
          </div>

          {/* Open Headline KPI Strip for Best Model */}
          <AnimatePresence mode="wait">
            <motion.div
              key={dataset}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="space-y-8"
            >
              {best && (
                <div className="grid items-center gap-6 border-b border-white/[0.08] pb-6 lg:grid-cols-[1.2fr_1fr]">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-bull/35 bg-bull/10 text-bull">
                      <Trophy size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Top Macro-F1 Classifier · {best.n_train.toLocaleString()} train / {best.n_test.toLocaleString()} test
                      </p>
                      <p className="text-xl font-semibold text-white">{best.model}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      ["Accuracy", best.accuracy],
                      ["Macro F1", best.f1_macro],
                      ["Precision", best.precision_macro],
                      ["Recall", best.recall_macro],
                    ].map(([label, val]: any) => (
                      <div key={label} className="border-l border-white/[0.08] pl-3">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
                        <p className="tabular mt-0.5 font-mono text-lg font-semibold text-white">
                          {(val * 100).toFixed(2)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Structured Evaluation Table */}
              <div>
                <SectionTitle
                  title="Classifier comparison"
                  subtitle="Click any row to inspect its confusion matrix and per-class report below"
                />
                <div className="overflow-x-auto border-y border-white/[0.08]">
                  <table className="w-full min-w-[820px]">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-slate-400">
                        <th className="th">Classifier</th>
                        <th className="th">Accuracy</th>
                        <th className="th">Macro Precision</th>
                        <th className="th">Macro Recall</th>
                        <th className="th">Macro F1</th>
                        <th className="th">Train Time</th>
                        <th className="th">Test Inference</th>
                        <th className="th text-right">Matrix</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {rows.map((r) => {
                        const selected = activeModel?.model === r.model;
                        return (
                          <tr
                            key={r.model}
                            onClick={() => setSelectedModel(r.model)}
                            className={`cursor-pointer transition-colors hover:bg-white/[0.03] ${
                              selected ? "bg-accent/[0.08]" : ""
                            }`}
                          >
                            <td className="td font-medium text-white">
                              <span className="flex items-center gap-2">
                                {r.model}
                                {r.model === best?.model && <Badge tone="green">Best F1</Badge>}
                              </span>
                            </td>
                            <td className="tabular td font-mono text-xs">{(r.accuracy * 100).toFixed(2)}%</td>
                            <td className="tabular td font-mono text-xs">{(r.precision_macro * 100).toFixed(2)}%</td>
                            <td className="tabular td font-mono text-xs">{(r.recall_macro * 100).toFixed(2)}%</td>
                            <td className="tabular td font-mono text-xs font-semibold text-cyan-light">
                              {(r.f1_macro * 100).toFixed(2)}%
                            </td>
                            <td className="tabular td font-mono text-xs text-slate-400">
                              {r.train_time_s < 0.01 ? "<0.01s" : `${r.train_time_s.toFixed(2)}s`}
                            </td>
                            <td className="tabular td font-mono text-xs text-slate-400">
                              {(r.inference_time_s * 1000).toFixed(2)}ms
                            </td>
                            <td className="td text-right">
                              <span className="text-xs font-medium text-accent-light">
                                {selected ? "Active" : "Inspect"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Charts */}
              <div className="grid gap-8 lg:grid-cols-2">
                <div>
                  <SectionTitle title="Metric comparison (%)" subtitle="Accuracy, Macro F1, Precision, and Recall" />
                  <div className="h-[280px] rounded-xl border border-white/[0.07] bg-surface/50 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                        <Bar dataKey="Accuracy" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Macro F1" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Precision" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Recall" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <SectionTitle title="Training time (seconds)" subtitle="CPU fit duration across classifiers" />
                  <div className="h-[280px] rounded-xl border border-white/[0.07] bg-surface/50 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timeData} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                        <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" width={92} tick={{ fill: "#cbd5e1", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="seconds" name="Train time (s)" fill="#7c6cf6" radius={[0, 6, 6, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Clock size={12} /> Linear SVM trains in ~0.11s while delivering the highest Macro-F1.
                  </p>
                </div>
              </div>

              {/* Confusion Matrix & Classification Report */}
              {activeModel && (
                <div className="grid gap-8 border-t border-white/[0.08] pt-8 lg:grid-cols-2">
                  <div>
                    <SectionTitle
                      title={`Confusion matrix — ${activeModel.model}`}
                      subtitle="Rows = true class · Columns = predicted class"
                    />
                    <div className="overflow-x-auto">
                      <table className="border-separate border-spacing-1.5">
                        <thead>
                          <tr>
                            <th className="px-2 py-1 text-[10px] uppercase text-slate-500">True ↓ / Pred →</th>
                            {activeModel.labels_order.map((l) => (
                              <th key={l} className="px-3 py-1 text-[11px] font-semibold uppercase" style={{ color: LABEL_COLORS[l] }}>
                                {l}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeModel.confusion_matrix.map((row, i) => {
                            const rowSum = row.reduce((a, b) => a + b, 0) || 1;
                            return (
                              <tr key={i}>
                                <td className="px-2 py-1 text-[11px] font-semibold uppercase" style={{ color: LABEL_COLORS[activeModel.labels_order[i]] }}>
                                  {activeModel.labels_order[i]}
                                </td>
                                {row.map((v, j) => {
                                  const intensity = v / rowSum;
                                  return (
                                    <td
                                      key={j}
                                      className="tabular rounded-md px-4 py-2.5 text-center font-mono text-xs text-white"
                                      style={{
                                        backgroundColor:
                                          i === j
                                            ? `rgba(16,185,129,${0.14 + intensity * 0.48})`
                                            : `rgba(239,68,68,${0.06 + intensity * 0.42})`,
                                        minWidth: 76,
                                      }}
                                    >
                                      {v.toLocaleString()}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-400">
                      <Info size={13} className="mt-0.5 shrink-0" /> Macro-F1 treats Bearish, Neutral, and Bullish equally despite the 64.9% Neutral skew.
                    </p>
                  </div>

                  <div>
                    <SectionTitle
                      title={`Classification report — ${activeModel.model}`}
                      subtitle="Per-class precision, recall, F1-score, and support"
                    />
                    {activeModel.classification_report ? (
                      <div className="overflow-x-auto border-y border-white/[0.08]">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-white/[0.08] text-[11px] uppercase text-slate-400">
                              <th className="py-2.5">Class</th>
                              <th className="py-2.5 text-right">Precision</th>
                              <th className="py-2.5 text-right">Recall</th>
                              <th className="py-2.5 text-right">F1-Score</th>
                              <th className="py-2.5 text-right">Support</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.06]">
                            {["negative", "neutral", "positive", "macro avg", "weighted avg"].map((cls) => {
                              const row = activeModel.classification_report?.[cls];
                              if (!row) return null;
                              return (
                                <tr key={cls}>
                                  <td className="py-2.5 font-medium capitalize text-slate-200">{cls}</td>
                                  <td className="tabular py-2.5 text-right font-mono text-slate-300">{(row.precision * 100).toFixed(2)}%</td>
                                  <td className="tabular py-2.5 text-right font-mono text-slate-300">{(row.recall * 100).toFixed(2)}%</td>
                                  <td className="tabular py-2.5 text-right font-mono font-semibold text-white">{(row["f1-score"] * 100).toFixed(2)}%</td>
                                  <td className="tabular py-2.5 text-right font-mono text-slate-400">{row.support}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Classification report unavailable.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Cross-domain transfer */}
              <div className="border-t border-white/[0.08] pt-8">
                <SectionTitle
                  title="Cross-domain generalization"
                  subtitle="Train on tweets, evaluate on formal news sentences (and reverse) using Logistic Regression"
                />
                <div className="grid gap-6 sm:grid-cols-2">
                  {data.cross_domain.map((c) => (
                    <div key={c.experiment} className="border-l-2 border-cyan/50 pl-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                        {c.experiment === "train_twitter_test_phrasebank" ? "Twitter → Financial PhraseBank" : "Financial PhraseBank → Twitter"}
                      </p>
                      <div className="mt-2 flex gap-8">
                        <div>
                          <p className="text-[10px] uppercase text-slate-500">Accuracy</p>
                          <p className="tabular font-mono text-lg font-semibold text-white">{(c.accuracy * 100).toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-slate-500">Macro F1</p>
                          <p className="tabular font-mono text-lg font-semibold text-cyan-light">{(c.f1_macro * 100).toFixed(2)}%</p>
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-400">
                        Quantifies lexical domain shift between social tweets and formal financial news.
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 flex items-start gap-1.5 text-xs text-slate-400">
                  <GitCompare size={14} className="mt-0.5 shrink-0" />
                  FinBERT transformer fine-tuning is documented as future work and not simulated in this benchmark.
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </FadeIn>
      )}
    </WorkspaceOrPublic>
  );
}
