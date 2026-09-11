export interface ToastData { id: number; text: string; kind: "error" | "info" }

export function Toast({ toast }: { toast: ToastData | null }) {
  if (!toast) return null;
  return (
    <div key={toast.id} className={`p-toast s-fade-in ${toast.kind === "error" ? "p-toast--error" : ""}`} role="status" aria-live="polite">
      {toast.text}
    </div>
  );
}
