import { useUIStore } from "@/stores/uiStore";

export type ToastProps = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

export function useToast() {
  const addToast = useUIStore((state) => state.addToast);

  const toast = (props: ToastProps) => {
    const { title, description, variant } = props;

    // Map shadcn variant to app toast type
    const type = variant === "destructive" ? "error" : "success";

    addToast({
      type,
      title: title || "Notification",
      message: description,
    });
  };

  return { toast };
}
