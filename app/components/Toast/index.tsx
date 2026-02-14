"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
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
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  showConfirm: (
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmLabel?: string,
    cancelLabel?: string,
  ) => void;
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
    ) => {
      const id = ++toastId;
      const confirmToast: Toast = {
        id,
        message,
        type: "confirm",
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
