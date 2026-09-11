import type { SessionPhase, SlidePhase } from "@sahne/protocol";

export type HostAction = "start" | "next" | "prev" | "lock" | "reveal" | "end";

export interface FlowState { phase: SessionPhase; slidePhase: SlidePhase | null; idx: number; total: number }

/**
 * Oturum akış makinesi. Saf: yeni durum döner, geçersizse null.
 * lobby -start-> live(idx 0, open)
 * open -lock-> locked -reveal-> revealed -next-> (idx+1, open) | -end-> ended
 * next: open/locked'dan da geçilebilir (host atlarsa) → doğrudan bir sonraki slayta.
 * prev: bir önceki slayta, revealed olarak (tekrar cevap alınmaz).
 */
export function transition(s: FlowState, action: HostAction): FlowState | null {
  if (s.phase === "ended") return null;
  if (s.phase === "lobby") {
    if (action === "start" && s.total > 0) return { ...s, phase: "live", idx: 0, slidePhase: "open" };
    if (action === "end") return { ...s, phase: "ended", slidePhase: null };
    return null;
  }
  switch (action) {
    case "lock": return s.slidePhase === "open" ? { ...s, slidePhase: "locked" } : null;
    case "reveal": return s.slidePhase === "open" || s.slidePhase === "locked" ? { ...s, slidePhase: "revealed" } : null;
    case "next": return s.idx + 1 < s.total ? { ...s, idx: s.idx + 1, slidePhase: "open" } : { ...s, phase: "ended", slidePhase: null };
    case "prev": return s.idx > 0 ? { ...s, idx: s.idx - 1, slidePhase: "revealed" } : null;
    case "end": return { ...s, phase: "ended", slidePhase: null };
    case "start": return null;
  }
}
