import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

let toastTrigger = null;

/**
 * Global helper to trigger a toast from anywhere without prop drilling.
 * @param {string} message - Text to display
 * @param {'success' | 'error' | 'warning' | 'info'} type - Toast type
 * @param {number} duration - Auto dismiss time in ms (default 3500)
 */
export function showPosToast(message, type = 'info', duration = 3500) {
  if (toastTrigger) {
    toastTrigger(message, type, duration);
  }
}

export function PosToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    toastTrigger = (message, type = 'info', duration = 3500) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, type }]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    };

    return () => {
      toastTrigger = null;
    };
  }, []);

  const handleRemove = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';
        const isWarning = t.type === 'warning';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl shadow-xl backdrop-blur-md border transition-all duration-300 animate-page-entrance ${
              isSuccess
                ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
                : isError
                ? 'bg-red-50/95 border-red-200 text-red-950'
                : isWarning
                ? 'bg-amber-50/95 border-amber-200 text-amber-950'
                : 'bg-white/95 border-[#D9E2EF] text-[#17365D]'
            }`}
            style={{
              boxShadow: '0 12px 30px -4px rgba(16, 35, 71, 0.12), 0 4px 12px -2px rgba(16, 35, 71, 0.08)',
            }}
          >
            <div className="shrink-0 mt-0.5">
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {isError && <AlertCircle className="w-4 h-4 text-red-600" />}
              {isWarning && <AlertTriangle className="w-4 h-4 text-amber-600" />}
              {!isSuccess && !isError && !isWarning && <Info className="w-4 h-4 text-[#F97316]" />}
            </div>

            <div className="flex-1 text-xs font-medium leading-relaxed select-text">
              {t.message}
            </div>

            <button
              onClick={() => handleRemove(t.id)}
              className="shrink-0 text-slate-400 hover:text-slate-700 transition p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default PosToastContainer;
