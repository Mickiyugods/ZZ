"use client";

import * as React from "react";
import { cn } from "./utils";

interface Toast {
  id: number;
  message: string;
  type: "info" | "success" | "error";
}

const ToastContext = React.createContext<((message: string, type?: Toast["type"]) => void) | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const push = React.useCallback((message: string, type: Toast["type"] = "info") => {
    const id = nextId++;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : "status"}
            className={cn(
              "max-w-[320px] rounded-[var(--primitive-radius-control-sm,0.5rem)] border px-4 py-3 text-[13px] shadow-lg",
              "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]",
              t.type === "error" && "border-[var(--destructive)]",
              t.type === "success" && "border-[var(--primary)]",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
