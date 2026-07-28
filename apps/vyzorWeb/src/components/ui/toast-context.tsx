import { createContext } from "react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ShowToastParameters {
  message: string;
  type?: ToastType;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (parameters: ShowToastParameters) => void;
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);
