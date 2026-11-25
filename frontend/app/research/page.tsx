"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Brain, CheckCircle2, ExternalLink, FileText, GitCompare, Layers } from "lucide-react";
import { WorkspaceOrPublic } from "@/components/WorkspaceOrPublic";
import { Badge, Card, ErrorState, Notice, SectionTitle, Spinner } from "@/components/ui";
import { apiGet } from "@/lib/api";

type Article = {
  title: string;
  authors: string;
  year: number;
  venue: string;
  dataset: string;
  modality: string;
  methodology: string;
  algorithms: string;
  metrics: string;
  findings: string;
  limitations: string;
  differs: string;
  link: string;
  verified: boolean;
};

const COMPARISON = [
  {
    approach: "Classical ML on financial text",
    example: "TF-IDF + Naive Bayes / LogReg / Linear SVM / Random Forest",
    strengths: "Fast, interpretable, trains in seconds, strong baseline on small corpora.",
    limits: "No long-range context, no sarcasm, no non-text modalities.",
    ours: "Implemented as the reproducible baseline with measured metrics.",
    icon: FileText,
  },
  {
    approach: "Financial transformer models",
    example: "FinBERT (Araci, 2019)",
    strengths: "Contextual embeddings, stronger phrasing and negation handling.",
    limits: "Compute-heavy, requires GPU for fine-tuning and heavier inference.",
    ours: "Documented as future work — no invented FinBERT scores reported.",
    icon: Brain,
  },
  {
    approach: "Multimodal sentiment & emotion",
    example: "CMU-MOSEI-style language + visual + acoustic fusion",
    strengths: "Captures emotion across channels; late fusion handles missing modalities.",
    limits: "General emotion rather than financial market stance.",
    ours: "Adopts late-fusion architecture while keeping financial sentiment, emotion, and engagement separate.",
    icon: Layers,
  },
  {
    approach: "FinSentinel multimodal architecture",
    example: "This platform",
    strengths: "Explicit axis separation, per-modality confidence, honest fallbacks, primary-collection tooling.",
    limits: "OCR/Whisper depend on optional local installs; no live social API.",
    ours: "Active implementation",
    icon: GitCompare,
  },
];

export default function ResearchPage() {
  const [arts, setArts] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Article[]>("/api/research/articles")
      .then(setArts)
      .catch((e: any) => setError(e?.message || "Could not load research articles."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <WorkspaceOrPublic
      title="Literature & Approach Comparison"
      subtitle="Verified peer-reviewed and arXiv references with DOI links"
    >
      {loading ? (
        <Spinner label="Loading research registry…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className="animate-fade-in space-y-6">
          <Notice tone="amber">
            <span className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                Every article below is verified against its DOI or arXiv record. Unverified placeholder citations from
                earlier drafts are excluded.
              </span>
            </span>
          </Notice>

          <Card>
            <SectionTitle title="Approach comparison matrix" subtitle="Classical NLP, transformers, multimodal emotion, and FinSentinel" />
            <div className="grid gap-3 lg:grid-cols-2">
              {COMPARISON.map(({ approach, example, strengths, limits, ours, icon: Icon }) => (
                <div
                  key={approach}
                  className={`rounded-md border p-4 ${
                    approach.includes("FinSentinel") ? "border-accent/40 bg-accent/[0.05]" : "border-slate-400/15 bg-navy-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={15} className={approach.includes("FinSentinel") ? "text-accent-light" : "text-slate-400"} />
                    <h3 className="text-sm font-semibold text-white">{approach}</h3>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{example}</p>
                  <div className="mt-2.5 space-y-1 text-xs leading-relaxed">
                    <p><span className="font-medium text-bull">Strengths:</span> <span className="text-slate-300">{strengths}</span></p>
                    <p><span className="font-medium text-bear">Limits:</span> <span className="text-slate-400">{limits}</span></p>
                    <p><span className="font-medium text-accent-light">This project:</span> <span className="text-slate-300">{ours}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle title="Verified literature" subtitle={`${arts.length} primary references`} />
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="border-y border-slate-400/15 bg-navy-900/70">
                    <th className="th">Paper</th>
                    <th className="th">Year</th>
                    <th className="th">Dataset</th>
                    <th className="th">Algorithms</th>
                    <th className="th">Findings</th>
                    <th className="th">How FinSentinel Differs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-400/10">
                  {arts.map((a) => (
                    <tr key={a.title} className="align-top hover:bg-surface-elevated/40">
                      <td className="td max-w-[260px]">
                        <a href={a.link} target="_blank" rel="noreferrer" className="group inline-flex items-start gap-1 text-xs font-semibold text-white hover:text-accent-light">
                          <span>{a.title}</span>
                          <ExternalLink size={11} className="mt-0.5 shrink-0 opacity-60 group-hover:opacity-100" />
                        </a>
                        <p className="mt-0.5 text-[11px] text-slate-400">{a.authors}</p>
                        <p className="text-[11px] text-slate-500">{a.venue}</p>
                        <div className="mt-1.5">
                          <Badge tone="green"><CheckCircle2 size={10} /> verified</Badge>
                        </div>
                      </td>
                      <td className="tabular td font-mono text-xs">{a.year}</td>
                      <td className="td max-w-[180px] text-xs text-slate-300">{a.dataset}</td>
                      <td className="td max-w-[180px] text-xs text-slate-300">{a.algorithms}</td>
                      <td className="td max-w-[220px] text-xs text-slate-400">{a.findings}</td>
                      <td className="td max-w-[220px] text-xs text-slate-300">{a.differs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </WorkspaceOrPublic>
  );
}
