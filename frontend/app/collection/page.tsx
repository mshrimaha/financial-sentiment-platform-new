"use client";
import { useCallback, useEffect, useState } from "react";
import { Calculator, ClipboardList, Info, Plus, Save, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, EmptyState, ErrorState, Notice, SectionTitle, Spinner, Stat } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { RequireAuth } from "@/lib/auth";
import { apiGet, apiPost, fmtDate } from "@/lib/api";

type Record_ = {
  id: string;
  platform: string;
  text: string;
  ticker: string | null;
  timestamp: string | null;
  media_type: string;
  annotator1_label: string | null;
  annotator2_label: string | null;
  final_label: string | null;
  notes: string | null;
  created_at: string;
};
type Agreement = { kappa: number | null; n: number; note: string };

const LABELS = ["positive", "negative", "neutral"];

export default function CollectionPage() {
  const { notify } = useToast();
  const [records, setRecords] = useState<Record_[]>([]);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [methodologies, setMethodologies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    platform: "Reddit",
    text: "",
    ticker: "",
    timestamp: "",
    media_type: "text",
    annotator1_label: "",
    annotator2_label: "",
    final_label: "",
    notes: "",
  });

  const [method, setMethod] = useState({
    platform: "Reddit (authorised API) / X API / StockTwits (permitted access)",
    method: "Manual curation + permitted API export; upload fallback if API access is unavailable",
    date_range: "2026-01-01 to 2026-03-31 (proposed)",
    keywords: "#stocks, #investing, earnings, buy the dip, price target, bullish, bearish",
    tickers: "AAPL, TSLA, NVDA, MSFT, AMZN",
    sampling: "Stratified by ticker and month; target 1,500–3,000 labelled posts per class (pilot may be smaller)",
    inclusion: "Public posts explicitly about a listed stock or the market; English language; contains an opinion or reaction",
    exclusion: "Private messages, promotional spam, bot-generated duplicates, non-English content, unverifiable media",
    annotation_guidelines:
      "Label financial opinion only. Positive = expectation of price rise / positive fundamentals. Negative = expectation of decline. Neutral = factual or no directional view. Reactions/emoji are NOT labels. Two independent annotators; disagreements resolved by discussion, else excluded.",
    annotators: "Annotator A (finance background) + Annotator B (finance background); adjudicator for disagreements",
    kappa: "",
    ethics: "Only content permitted by platform terms; personal identifiers removed; ethics review completed prior to collection",
    storage: "Access-controlled storage with database metadata references and documented retention policy",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, a, m] = await Promise.all([
        apiGet<Record_[]>("/api/collection/records"),
        apiGet<Agreement>("/api/collection/agreement"),
        apiGet<any[]>("/api/collection/methodology"),
      ]);
      setRecords(r);
      setAgreement(a);
      setMethodologies(m);
    } catch (e: any) {
      setError(e?.message || "Could not load collection data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveRecord(e: React.FormEvent) {
    e.preventDefault();
    if (form.text.trim().length < 5) {
      notify("Enter at least 5 characters of collected content.", "error");
      return;
    }
    setSaving(true);
    try {
      await apiPost("/api/collection/records", {
        ...form,
        ticker: form.ticker || null,
        timestamp: form.timestamp || null,
        annotator1_label: form.annotator1_label || null,
        annotator2_label: form.annotator2_label || null,
        final_label: form.final_label || null,
        notes: form.notes || null,
      });
      setForm({ ...form, text: "", ticker: "", notes: "", annotator1_label: "", annotator2_label: "", final_label: "" });
      notify("Collected record saved.", "success");
      await load();
    } catch (e: any) {
      notify(e?.message || "Could not save record.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveMethodology(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost("/api/collection/methodology", {
        ...method,
        kappa: method.kappa ? parseFloat(method.kappa) : null,
      });
      notify("Methodology snapshot saved.", "success");
      await load();
    } catch (e: any) {
      notify(e?.message || "Could not save methodology.", "error");
    } finally {
      setSaving(false);
    }
  }

  const labelled = records.filter((r) => r.final_label).length;
  const doubly = records.filter((r) => r.annotator1_label && r.annotator2_label).length;

  return (
    <RequireAuth>
      <AppShell title="Primary Collection & Annotation" subtitle="Manual/permitted data collection workflow with dual-annotator Cohen's kappa">
        {loading ? (
          <Spinner label="Loading collection workspace…" />
        ) : error && records.length === 0 ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <div className="animate-fade-in space-y-6">
            <Notice tone="amber">
              <strong>No live social-media scraper is configured.</strong> Collection here is manual and ethical: you record
              permitted posts with two annotator labels and compute live inter-annotator agreement (Cohen&apos;s κ).
            </Notice>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Collected Records" value={records.length} hint="Stored in SQLite" icon={<ClipboardList size={15} />} />
              <Stat label="Adjudicated" value={labelled} hint="Final label assigned" icon={<ShieldCheck size={15} />} accent="text-bull" />
              <Stat label="Doubly Annotated" value={doubly} hint="Both annotators scored" icon={<Users size={15} />} accent="text-violet-light" />
              <Stat
                label="Cohen's κ"
                value={agreement?.kappa != null ? agreement.kappa.toFixed(3) : "—"}
                hint={agreement?.kappa != null ? `n=${agreement.n} doubly annotated` : "Needs ≥2 doubly-annotated records"}
                icon={<Calculator size={15} />}
                accent="text-accent-light"
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <Card>
                <SectionTitle title="Add collected post" subtitle="Record content with independent annotator labels" />
                <form onSubmit={saveRecord} className="space-y-3">
                  <div>
                    <label className="label" htmlFor="ctext">Post text / transcript</label>
                    <textarea
                      id="ctext"
                      rows={3}
                      className="input resize-none"
                      placeholder="Paste collected post or transcript…"
                      value={form.text}
                      onChange={(e) => setForm({ ...form, text: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label" htmlFor="cplat">Platform</label>
                      <select id="cplat" className="input" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                        {["Reddit", "X / Twitter", "StockTwits", "Public forum", "Participant submission", "Other"].map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor="cticker">Ticker</label>
                      <input id="cticker" className="input font-mono uppercase" placeholder="AAPL" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} />
                    </div>
                    <div>
                      <label className="label" htmlFor="cts">Timestamp</label>
                      <input id="cts" type="datetime-local" className="input" value={form.timestamp} onChange={(e) => setForm({ ...form, timestamp: e.target.value })} />
                    </div>
                    <div>
                      <label className="label" htmlFor="cmedia">Media type</label>
                      <select id="cmedia" className="input" value={form.media_type} onChange={(e) => setForm({ ...form, media_type: e.target.value })}>
                        {["text", "image", "sticker", "audio", "video"].map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label" htmlFor="a1">Annotator 1</label>
                      <select id="a1" className="input" value={form.annotator1_label} onChange={(e) => setForm({ ...form, annotator1_label: e.target.value })}>
                        <option value="">Not labelled</option>
                        {LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor="a2">Annotator 2</label>
                      <select id="a2" className="input" value={form.annotator2_label} onChange={(e) => setForm({ ...form, annotator2_label: e.target.value })}>
                        <option value="">Not labelled</option>
                        {LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="fin">Final adjudicated label</label>
                    <select id="fin" className="input" value={form.final_label} onChange={(e) => setForm({ ...form, final_label: e.target.value })}>
                      <option value="">Not resolved</option>
                      {LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="notes">Adjudication notes</label>
                    <input id="notes" className="input" placeholder="Disagreement notes or source reference" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                  <button type="submit" disabled={saving} className="btn-primary w-full text-xs">
                    {saving ? "Saving…" : <><Plus size={14} /> Add record</>}
                  </button>
                </form>
              </Card>

              <Card>
                <SectionTitle title="Collection protocol document" subtitle="10-step documented procedure saved to your workspace" />
                <form onSubmit={saveMethodology} className="space-y-3">
                  {(
                    [
                      ["platform", "Platform(s) & access method"],
                      ["method", "Collection method"],
                      ["date_range", "Date range"],
                      ["keywords", "Keywords & hashtags"],
                      ["tickers", "Stock tickers"],
                      ["sampling", "Sampling procedure"],
                      ["inclusion", "Inclusion criteria"],
                      ["exclusion", "Exclusion criteria"],
                      ["annotators", "Annotator information"],
                      ["ethics", "Privacy & ethics"],
                      ["storage", "Storage & documentation"],
                    ] as [keyof typeof method, string][]
                  ).map(([key, label]) => (
                    <div key={key}>
                      <label className="label" htmlFor={key}>{label}</label>
                      <textarea
                        id={key}
                        rows={2}
                        className="input resize-none text-xs"
                        value={method[key]}
                        onChange={(e) => setMethod({ ...method, [key]: e.target.value })}
                      />
                    </div>
                  ))}
                  <div>
                    <label className="label" htmlFor="guidelines">Annotation guidelines</label>
                    <textarea
                      id="guidelines"
                      rows={3}
                      className="input resize-none text-xs"
                      value={method.annotation_guidelines}
                      onChange={(e) => setMethod({ ...method, annotation_guidelines: e.target.value })}
                    />
                  </div>
                  <button type="submit" disabled={saving} className="btn-ghost w-full text-xs">
                    {saving ? "Saving…" : <><Save size={14} /> Save protocol snapshot</>}
                  </button>
                </form>
              </Card>
            </div>

            <Card>
              <SectionTitle
                title="Annotated records"
                subtitle={`${records.length} record(s)`}
                action={
                  agreement?.kappa != null ? (
                    <Badge tone="violet">Cohen&apos;s κ = {agreement.kappa.toFixed(3)} (n={agreement.n})</Badge>
                  ) : (
                    <Badge tone="amber">κ requires ≥2 doubly-annotated records</Badge>
                  )
                }
              />
              {records.length === 0 ? (
                <EmptyState title="No collected records yet" description="Add a post above to compute live Cohen's kappa agreement." icon={<ClipboardList className="h-6 w-6" />} />
              ) : (
                <div className="-mx-5 overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead>
                      <tr className="border-y border-slate-400/15 bg-navy-900/70">
                        <th className="th">Text</th>
                        <th className="th">Platform</th>
                        <th className="th">Ticker</th>
                        <th className="th">A1</th>
                        <th className="th">A2</th>
                        <th className="th">Agree</th>
                        <th className="th">Final</th>
                        <th className="th">Added</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-400/10">
                      {records.map((r) => (
                        <tr key={r.id} className="hover:bg-surface-elevated/40">
                          <td className="td max-w-[260px] truncate text-xs">{r.text}</td>
                          <td className="td text-xs text-slate-400">{r.platform}</td>
                          <td className="td font-mono text-xs">{r.ticker ? `$${r.ticker}` : "—"}</td>
                          <td className="td text-xs capitalize">{r.annotator1_label ?? "—"}</td>
                          <td className="td text-xs capitalize">{r.annotator2_label ?? "—"}</td>
                          <td className="td text-xs">
                            {r.annotator1_label && r.annotator2_label
                              ? r.annotator1_label === r.annotator2_label
                                ? <span className="text-bull">yes</span>
                                : <span className="text-bear">no</span>
                              : "—"}
                          </td>
                          <td className="td text-xs capitalize">{r.final_label ?? <span className="text-slate-500">unresolved</span>}</td>
                          <td className="td text-xs text-slate-400">{fmtDate(r.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-400">
                <Info size={13} className="mt-0.5 shrink-0" />
                Cohen&apos;s κ updates automatically from records where both annotators assigned a label.
              </p>
            </Card>

            {methodologies.length > 0 && (
              <Card>
                <SectionTitle title="Saved protocol snapshots" subtitle={`${methodologies.length} version(s)`} />
                <div className="space-y-2">
                  {methodologies.map((m) => (
                    <div key={m.id} className="rounded border border-slate-400/15 bg-navy-900 p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">{m.platform}</span>
                        <span className="text-slate-500">{fmtDate(m.created_at)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-400">{m.method} · {m.date_range}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </AppShell>
    </RequireAuth>
  );
}
