"use client";
import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type Tone = "success" | "error" | "info";
type ToastItem = { id: string; message: string; tone: Tone };

const ToastCtx = createContext<{ notify: (message: string, tone?: Tone) => void }>({
  notify: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((message: string, tone: Tone = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setItems((prev) => [...prev.slice(-3), { id, message, tone }]);
    setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  return (
    <ToastCtx.Provider value={{ notify }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
      >
        {items.map((t) => {
          const styles =
            t.tone === "success"
              ? "border-bull/40 bg-surface-elevated text-emerald-200"
              : t.tone === "error"
              ? "border-bear/40 bg-surface-elevated text-red-200"
              : "border-accent/40 bg-surface-elevated text-slate-200";
          const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? AlertCircle : Info;
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-xs shadow-lg animate-slide-up ${styles}`}
            >
              <Icon size={15} className="mt-0.5 shrink-0" />
              <span className="flex-1 leading-relaxed">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="text-slate-400 hover:text-white"
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
