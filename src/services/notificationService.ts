export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

type ToastListener = (toasts: ToastMessage[]) => void;
type ConfirmListener = (options: ConfirmDialogOptions | null) => void;

class NotificationManager {
  private toasts: ToastMessage[] = [];
  private toastListeners: Set<ToastListener> = new Set();
  private confirmListener: ConfirmListener | null = null;

  subscribeToasts(listener: ToastListener) {
    this.toastListeners.add(listener);
    listener([...this.toasts]);
    return () => {
      this.toastListeners.delete(listener);
    };
  }

  setConfirmListener(listener: ConfirmListener | null) {
    this.confirmListener = listener;
  }

  show(type: ToastType, message: string, title?: string, duration = 4000) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastMessage = { id, type, message, title, duration };
    this.toasts = [...this.toasts, newToast];
    this.notifyToastListeners();

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }
    return id;
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notifyToastListeners();
  }

  private notifyToastListeners() {
    this.toastListeners.forEach(l => l([...this.toasts]));
  }

  confirm(options: ConfirmDialogOptions) {
    if (this.confirmListener) {
      this.confirmListener(options);
    } else {
      // Fallback if modal container is not yet mounted
      try {
        if (typeof window !== 'undefined' && 'confirm' in window && !window.frameElement) {
          if (window.confirm(`${options.title}\n\n${options.message}`)) {
            options.onConfirm();
          } else if (options.onCancel) {
            options.onCancel();
          }
          return;
        }
      } catch {
        // In iframe or sandboxed context, proceed with confirm
      }
      options.onConfirm();
    }
  }

  closeConfirm() {
    if (this.confirmListener) {
      this.confirmListener(null);
    }
  }
}

export const notifications = new NotificationManager();

export function notifySuccess(message: string, title?: string) {
  return notifications.show('success', message, title);
}

export function notifyError(message: string, title?: string) {
  return notifications.show('error', message, title, 6000);
}

export function notifyWarning(message: string, title?: string) {
  return notifications.show('warning', message, title, 5000);
}

export function notifyInfo(message: string, title?: string) {
  return notifications.show('info', message, title);
}

export function requestConfirm(options: ConfirmDialogOptions) {
  notifications.confirm(options);
}
