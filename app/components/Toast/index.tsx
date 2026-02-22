"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import styles from "./Toast.module.css";

type ToastType = "success" | "error" | "info" | "confirm";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  actions?: ToastAction[];
  autoConfirmMs?: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  showConfirm: (
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmLabel?: string,
    cancelLabel?: string,
    autoConfirmMs?: number,
  ) => void;
}

/** Confirm toast that optionally auto-confirms after a countdown. */
function ConfirmToastItem({ toast }: { toast: Toast }) {
  const { autoConfirmMs } = toast;
  const confirmAction = toast.actions?.[toast.actions.length - 1];

  useEffect(() => {
    if (!autoConfirmMs || !confirmAction) return;
    const timer = setTimeout(() => confirmAction.onClick(), autoConfirmMs);
    return () => clearTimeout(timer);
  }, []); // intentionally run once on mount

  return (
    <div className={styles.confirmWrapper}>
      <div className={styles.confirmRow}>
        <span className={styles.icon}>?</span>
        <span className={styles.message}>{toast.message}</span>
        {toast.actions && (
          <div className={styles.actions}>
            {toast.actions.map((action, idx) => (
              <button
                key={idx}
                className={styles.actionButton}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {autoConfirmMs && (
        <div className={styles.progressBarTrack}>
          <div
            className={styles.progressBarFill}
            style={{ animationDuration: `${autoConfirmMs}ms` }}
          />
        </div>
      )}
    </div>
  );
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const showConfirm = useCallback(
    (
      message: string,
      onConfirm: () => void,
      onCancel?: () => void,
      confirmLabel: string = "Clear",
      cancelLabel: string = "Cancel",
      autoConfirmMs?: number,
    ) => {
      const id = ++toastId;
      const confirmToast: Toast = {
        id,
        message,
        type: "confirm",
        autoConfirmMs,
        actions: [
          {
            label: cancelLabel,
            onClick: () => {
              onCancel?.();
              setToasts((prev) => prev.filter((toast) => toast.id !== id));
            },
          },
          {
            label: confirmLabel,
            onClick: () => {
              onConfirm();
              setToasts((prev) => prev.filter((toast) => toast.id !== id));
            },
          },
        ],
      };
      setToasts((prev) => [...prev, confirmToast]);
    },
    [],
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const getIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "info":
        return "ℹ";
      case "confirm":
        return "?";
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, showConfirm }}>
      {children}
      {toasts.length > 0 && (
        <div className={styles.toastContainer}>
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`${styles.toast} ${styles[toast.type]}`}
            >
              {toast.type === "confirm" ? (
                <ConfirmToastItem toast={toast} />
              ) : (
                <>
                  <span className={styles.icon}>{getIcon(toast.type)}</span>
                  <span className={styles.message}>{toast.message}</span>
                  {toast.actions ? (
                    <div className={styles.actions}>
                      {toast.actions.map((action, idx) => (
                        <button
                          key={idx}
                          className={styles.actionButton}
                          onClick={action.onClick}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      className={styles.closeButton}
                      onClick={() => removeToast(toast.id)}
                      aria-label="Close"
                    >
                      ×
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
