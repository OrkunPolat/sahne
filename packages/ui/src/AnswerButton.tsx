import { ANSWER_SHAPES } from "@sahne/protocol";
import { Shape } from "./shapes";

export type AnswerState = "idle" | "selected" | "dim" | "correct";

export function AnswerButton({
  index, label, state = "idle", disabled, onClick, big,
}: { index: number; label: string; state?: AnswerState; disabled?: boolean; onClick?: () => void; big?: boolean }) {
  const shape = ANSWER_SHAPES[index % 4]!;
  const cls = ["s-answer", `s-answer--${(index % 4) + 1}`, state !== "idle" ? `s-answer--${state}` : ""].join(" ");
  return (
    <button type="button" className={cls} disabled={disabled} onClick={onClick} style={big ? { minHeight: 120, fontSize: "1.5rem" } : undefined}>
      <Shape shape={shape} className="s-answer__shape" />
      <span>{label}</span>
    </button>
  );
}
