// src/components/Toaster.tsx
import React from 'react';
import { useToastContext, Toast } from '../contexts/ToastContext';
import clsx from 'clsx';

const ICONS: Record<string, JSX.Element> = {
  success: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M16 6L8.5 13.5 5 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M6 6l8 8M6 14L14 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  info: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M9 9h1v4H9zM9 7h1V8H9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="0" fill="none" />
    </svg>
  ),
  neutral: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="3" fill="currentColor" />
    </svg>
  ),
};

export default function Toaster(): JSX.Element {
  const { toasts, remove } = useToastContext();

  return (
    // container
    <div aria-live="polite" className="fixed top-4 right-4 z-50 flex w-96 max-w-full flex-col gap-3">
      {toasts.map((t: Toast) => {
        const key = t.id;
        const variant = t.variant ?? 'neutral';

        const borderColor =
          variant === 'success'
            ? 'border-green-400/20'
            : variant === 'error'
            ? 'border-red-400/20'
            : variant === 'info'
            ? 'border-blue-400/20'
            : 'border-white/6';

        const iconColor =
          variant === 'success' ? 'text-green-400' : variant === 'error' ? 'text-red-400' : variant === 'info' ? 'text-blue-300' : 'text-text';

        return (
          <div
            key={key}
            role="status"
            className={clsx(
              'glass-card flex items-start gap-3 p-3 shadow-md',
              'rounded-lg overflow-hidden',
              borderColor
            )}
            // ensure keyboard users can close easily
            tabIndex={0}
          >
            <div className={clsx('flex-shrink-0 mt-0.5', iconColor)}>{ICONS[variant]}</div>

            <div className="flex-1 min-w-0">
              {t.title ? <div className="text-sm font-semibold text-text">{t.title}</div> : null}
              {t.description ? <div className="text-xs subtle mt-1">{t.description}</div> : null}
            </div>

            <div className="flex flex-col items-end gap-1">
              <button
                onClick={() => remove(key)}
                className="text-subtle hover:text-text px-2 py-1 rounded-md"
                aria-label="Dismiss notification"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
