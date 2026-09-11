import type { AnswerShape } from "@sahne/protocol";

export function Shape({ shape, className }: { shape: AnswerShape; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true as const };
  switch (shape) {
    case "triangle": return <svg {...common}><path d="M12 3 22 20H2z" /></svg>;
    case "diamond": return <svg {...common}><path d="M12 2l10 10-10 10L2 12z" /></svg>;
    case "circle": return <svg {...common}><circle cx="12" cy="12" r="10" /></svg>;
    case "square": return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="3" /></svg>;
  }
}
