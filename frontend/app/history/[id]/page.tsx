"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, ErrorState, ProgressBar, SectionTitle, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { RequireAuth } from "@/lib/auth";
import { apiDelete, apiGet, fmtFullDate, sentimentColor } from "@/lib/api";

export default function AnalysisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { notify } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiGet(`/api/analyses/${encodeURIComponent(id)}`)
      .then(setData)
      .catch((e: any) => setError(e?.message || "Could not load analysis record."))
      .finally(() => setLoading(false));
  }, [id]);

  async function doDelete() {
    try {
      await apiDelete(`/api/analyses/${encodeURIComponent(id)}`);
      notify("Analysis deleted.", "success");
      router.replace("/history");
    } catch (e: any) {
      notify(e?.message || "Failed to delete record.", "error");
    }
  }

  return (
    <RequireAuth>
      <AppShell
        title="Analysis Report"
        subtitle={data ? `Record ${data.id}` : "Detailed multimodal analysis record"}
        actions={
          <Link href="/history" className="btn-ghost !px-3 !py-1.5 text-xs">
            <ArrowLeft size={13} /> Back to history
          </Link>
        }
      >
        {loading ? (
          <Spinner label="Loading analysis details…" />
        ) : error ? (
          <ErrorState message={error} />
        ) : data ? (
          <div className="space-y-5">
            <Card className="relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: sentimentColor(data.sentiment) }} />
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone="blue">{data.modality}</Badge>
                    <Badge tone={data.status === "completed" ? "green" : "amber"}>{data.status}</Badge>
                    {data.platform && <Badge tone="slate">{data.platform}</Badge>}
                  </div>
                  <p className="mt-3 text-2xl font-semibold capitalize" style={{ color: sentimentColor(data.sentiment) }}>
                    {data.sentiment || "Unclassified"}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-400">
                    Created {fmtFullDate(data.created_at)}
                    {data.model_used ? ` · Model: ${data.model_used}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!confirmDelete ? (
                    <button type="button" onClick={() => setConfirmDelete(true)} className="btn-danger text-xs">
                      <Trash2 size={14} /> Delete
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setConfirmDelete(false)} className="btn-ghost text-xs">
                        Cancel
                      </button>
                      <button type="button" onClick={doDelete} className="btn-danger text-xs">
                        Confirm delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {data.confidence != null && (
                <div className="mt-4 max-w-md space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Confidence score</span>
                    <span className="tabular font-mono">{(data.confidence * 100).toFixed(2)}%</span>
                  </div>
                  <ProgressBar value={data.confidence * 100} color={sentimentColor(data.sentiment)} />
                </div>
              )}

              <p className="mt-4 text-xs leading-relaxed text-slate-300">{data.explanation}</p>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <SectionTitle title="Input & Extracted Text" subtitle="Stored source content and extracted signals" />
                <div className="space-y-3">
                  <div>
                    <p className="label">Original input</p>
                    <p className="rounded border border-slate-400/10 bg-navy-900 p-3 text-xs leading-relaxed text-slate-200">
                      {data.input_text || "—"}
                    </p>
                  </div>
                  {data.extracted_text && data.extracted_text !== data.input_text && (
                    <div>
                      <p className="label">Extracted OCR / Transcript</p>
                      <p className="rounded border border-slate-400/10 bg-navy-900 p-3 text-xs leading-relaxed text-slate-200">
                        {data.extracted_text}
                      </p>
                    </div>
                  )}
                  {data.raw_metadata?.file_url && (
                    <div>
                      <p className="label">Uploaded media preview</p>
                      {data.modality === "image" && (
                        <img src={`/be${data.raw_metadata.file_url}`} alt="Uploaded media" className="max-h-56 w-full rounded bg-navy-900 object-contain" />
                      )}
                      {data.modality === "audio" && (
                        <audio controls src={`/be${data.raw_metadata.file_url}`} className="w-full" />
                      )}
                      {data.modality === "video" && (
                        <video controls src={`/be${data.raw_metadata.file_url}`} className="max-h-56 w-full rounded bg-navy-900" />
                      )}
                    </div>
                  )}
                </div>
              </Card>

              <Card>
                <SectionTitle title="Probabilities, Keywords & Tickers" subtitle="Model outputs and fusion state" />
                <div className="space-y-4">
                  <div>
                    <p className="label">Tickers</p>
                    {data.tickers?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {data.tickers.map((t: string) => (
                          <Link key={t} href={`/stocks?ticker=${t}`}>
                            <Badge tone="blue">${t}</Badge>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No tickers associated</p>
                    )}
                  </div>

                  {data.probabilities && Object.keys(data.probabilities).length > 0 && (
                    <div>
                      <p className="label">Class probabilities</p>
                      <div className="space-y-1.5">
                        {Object.entries(data.probabilities).map(([k, v]: any) => (
                          <div key={k} className="flex items-center gap-2">
                            <span className="w-16 text-xs capitalize text-slate-300">{k}</span>
                            <div className="flex-1">
                              <ProgressBar value={Number(v) * 100} color={sentimentColor(k)} />
                            </div>
                            <span className="tabular w-12 text-right font-mono text-xs text-slate-300">
                              {(Number(v) * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.keywords?.length > 0 && (
                    <div>
                      <p className="label">Matched TF-IDF terms</p>
                      <div className="flex flex-wrap gap-1.5">
                        {data.keywords.map((kw: any) => (
                          <span key={kw.term} className="rounded border border-slate-400/20 bg-navy-900 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                            {kw.term} ({Number(kw.weight).toFixed(2)})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.engagement_score != null && (
                    <div>
                      <p className="label">Engagement score (separate axis)</p>
                      <p className="font-mono text-sm text-violet-light">{data.engagement_score} / 100</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </AppShell>
    </RequireAuth>
  );
}
