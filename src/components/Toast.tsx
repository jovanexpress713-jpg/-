import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { IconCheck } from "./Icons";

interface ToastItem {
  id: number;
  text: string;
  sub?: string;
}

const ToastCtx = createContext<(text: string, sub?: string) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((text: string, sub?: string) => {
    const id = Date.now() + Math.random();
    setItems((p) => [...p, { id, text, sub }]);
    window.setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 3400);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-7 left-1/2 z-[90] flex -translate-x-1/2 flex-col items-center gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className="animate-fade-up pointer-events-auto flex items-center gap-3 rounded-inner bg-surface-4 px-4 py-3"
            style={{
              boxShadow:
                "0 18px 40px -18px color-mix(in oklab, var(--color-brand) 45%, transparent), 0 0 0 1px var(--color-border-subtle)",
            }}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-on-brand">
              <IconCheck size={14} />
            </span>
            <div className="leading-tight">
              <div className="text-body font-medium text-text-primary">{t.text}</div>
              {t.sub && <div className="text-label text-text-muted">{t.sub}</div>}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
