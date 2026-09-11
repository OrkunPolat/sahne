// PUT /api/sessions/:id/slides: bracket slaytlarını doğrula ve items'ı turnuvadan doldur (host'un items'ı yok sayılır).
import type { Slide } from "@sahne/protocol";
import { isPowerOfTwo, maxBracketSize } from "@sahne/engine";
import { getTournamentById } from "../db/tournaments";
import { HttpError } from "./util";

export async function fillBracketSlides(slides: Slide[]): Promise<Slide[]> {
  const out: Slide[] = [];
  const cache = new Map<string, Awaited<ReturnType<typeof getTournamentById>>>();
  for (const s of slides) {
    if (s.type !== "bracket") { out.push(s); continue; }
    let t = cache.get(s.tournamentId);
    if (t === undefined) { t = await getTournamentById(s.tournamentId); cache.set(s.tournamentId, t); }
    if (!t) throw new HttpError(422, "validation", `slide ${s.id}: tournament ${s.tournamentId} not found`);
    const max = maxBracketSize(t.items.length);
    if (!isPowerOfTwo(s.size) || s.size < 4 || s.size > max) throw new HttpError(422, "validation", `slide ${s.id}: size must be a power of two between 4 and ${max}`);
    out.push({ ...s, items: t.items });
  }
  return out;
}
