// src/contexts/ToastContext.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ToastVariant = 'success' | 'error' | 'info' | 'neutral';

export type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number; // ms; if 0, do not auto-dismiss
};

type ToastContextValue = {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => string;
  remove: (id: string) => void;
  clear: () => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // generate id
  const genId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = genId();
    const toast: Toast = {
      id,
      title: t.title,
      description: t.description,
      variant: t.variant ?? 'neutral',
      duration: typeof t.duration === 'number' ? t.duration : 4500,
    };
    setToasts((s) => [toast, ...s]); // newest on top
    return id;
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((s) => s.filter((x) => x.id !== id));
  }, []);

  const clear = useCallback(() => {
    setToasts([]);
  }, []);

  // auto-remove toasts with duration > 0
  useEffect(() => {
    const timers: Array<{ id: string; t: number }> = [];
    toasts.forEach((t) => {
      if (t.duration && t.duration > 0) {
        const timer = window.setTimeout(() => {
          setToasts((s) => s.filter((x) => x.id !== t.id));
        }, t.duration);
        timers.push({ id: t.id, t: timer });
      }
    });
    return () => timers.forEach((x) => clearTimeout(x.t));
  }, [toasts]);

  const value = useMemo(() => ({ toasts, push, remove, clear }), [toasts, push, remove, clear]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export const useToastContext = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToastContext must be used within a ToastProvider');
  return ctx;
};

/** Convenience hook with small helpers */
export const useToast = () => {
  const { push, remove } = useToastContext();

  const success = useCallback(
    (title: string, description?: string, duration?: number) => push({ title, description, variant: 'success', duration }),
    [push]
  );
  const error = useCallback(
    (title: string, description?: string, duration?: number) => push({ title, description, variant: 'error', duration }),
    [push]
  );
  const info = useCallback(
    (title: string, description?: string, duration?: number) => push({ title, description, variant: 'info', duration }),
    [push]
  );
  const neutral = useCallback(
    (title: string, description?: string, duration?: number) => push({ title, description, variant: 'neutral', duration }),
    [push]
  );

  return { push, remove, success, error, info, neutral };
};
