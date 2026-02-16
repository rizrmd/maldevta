import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from "lucide-react";
import { useUIStore } from "@/stores";

const toastVariants = cva(
  "pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all",
  {
    variants: {
      variant: {
        success: "border-emerald-200 bg-emerald-50 text-emerald-900",
        error: "border-red-200 bg-red-50 text-red-900",
        info: "border-blue-200 bg-blue-50 text-blue-900",
        warning: "border-amber-200 bg-amber-50 text-amber-900",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
);

interface ToastProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof toastVariants> {
  title: string;
  description?: string;
  onClose?: () => void;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant, title, description, onClose, ...props }, ref) => {
    const Icon = {
      success: CheckCircle,
      error: AlertCircle,
      info: Info,
      warning: AlertTriangle,
    }[variant ?? "info"];

    return (
      <div
        ref={ref}
        className={clsx(toastVariants({ variant }), className)}
        {...props}
      >
        <div className="flex gap-3">
          <Icon className="h-5 w-5 flex-shrink-0" />
          <div className="grid gap-1">
            <p className="text-sm font-semibold">{title}</p>
            {description && (
              <p className="text-sm opacity-90">{description}</p>
            )}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);
Toast.displayName = "Toast";

export function Toaster() {
  const toasts = useUIStore((state) => state.toasts);
  const removeToast = useUIStore((state) => state.removeToast);

  return (
    <div className="fixed bottom-0 right-0 z-50 flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
      {toasts.map((toast) => (
        <div key={toast.id} className="mb-2 animate-in slide-in-from-right-full">
          <Toast
            variant={toast.type}
            title={toast.title}
            description={toast.message}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}

export { Toast, type ToastProps };
