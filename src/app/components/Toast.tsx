"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; type: ToastType; message: string; durationMs: number; blink?: boolean };

type ToastContextType = {
  showToast: (message: string, type?: ToastType, opts?: { durationMs?: number; blink?: boolean }) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info", opts?: { durationMs?: number; blink?: boolean }) => {
    const id = idRef.current++;
    const durationMs = typeof opts?.durationMs === "number" ? opts.durationMs : 6000;
    setToasts((prev) => [...prev, { id, message, type, durationMs, blink: opts?.blink }]);
    if (durationMs > 0) {
      window.setTimeout(() => remove(id), durationMs);
    }
    return id;
  }, [remove]);

  const value = useMemo(() => ({ showToast, dismiss: remove }), [showToast, remove]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur",
              t.type === "success" && "border-emerald-300/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
              t.type === "error" && "border-rose-300/30 bg-rose-500/10 text-rose-900 dark:text-rose-200",
              t.type === "info" && "border-black/10 bg-black/5 text-foreground dark:border-white/20 dark:bg-white/5",
            ].join(" ")}
            role="status"
            aria-live="polite"
          >
            <div className={["mt-0.5 flex-1 whitespace-pre-wrap", t.blink ? "animate-pulse" : ""].join(" ")}>{t.message}</div>
            <button
              onClick={() => remove(t.id)}
              className="rounded-md border px-2 py-0.5 text-xs opacity-70 hover:opacity-100"
            >
              閉じる
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}


