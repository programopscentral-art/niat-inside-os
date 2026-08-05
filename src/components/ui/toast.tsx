'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: ToastKind; msg: string; }
interface Ctx { toast: (msg: string, kind?: ToastKind) => void; }

const ToastCtx = createContext<Ctx>({ toast: () => {} });
export const useToast = () => useContext(ToastCtx);

let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((msg: string, kind: ToastKind = 'info') => {
    const id = ++seq;
    setToasts((t) => [...t, { id, kind, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,360px)]">
        {toasts.map((t) => (
          <div key={t.id} className="card glass shadow-soft animate-fade-in flex items-start gap-3 p-3.5 text-sm">
            {t.kind === 'success' && <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />}
            {t.kind === 'error' && <AlertTriangle className="h-5 w-5 shrink-0 text-danger" />}
            {t.kind === 'info' && <Info className="h-5 w-5 shrink-0 text-primary" />}
            <span className="flex-1 leading-snug">{t.msg}</span>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-fg-muted hover:text-fg">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
