import { z } from "zod";
import { AnswerValue, Slide, Tally } from "./slides";
import { LeaderboardEntry, Participant, SessionSnapshot, SlidePhase } from "./session";

/* ---------- Client → Server ---------- */

export const HostJoin = z.object({ t: z.literal("host:join"), code: z.string(), hostSecret: z.string() });
export const HostNext = z.object({ t: z.literal("host:next") });
export const HostPrev = z.object({ t: z.literal("host:prev") });
export const HostLock = z.object({ t: z.literal("host:lock") });
export const HostReveal = z.object({ t: z.literal("host:reveal") });
export const HostStart = z.object({ t: z.literal("host:start") });
export const HostEnd = z.object({ t: z.literal("host:end") });
export const HostKick = z.object({ t: z.literal("host:kick"), participantId: z.string() });

export const PlayerJoin = z.object({ t: z.literal("player:join"), code: z.string(), nickname: z.string().min(1).max(20) });
export const PlayerResume = z.object({ t: z.literal("player:resume"), code: z.string(), token: z.string() });
export const PlayerAnswer = z.object({ t: z.literal("player:answer"), slideId: z.string(), value: AnswerValue });

export const ClientMessage = z.discriminatedUnion("t", [
  HostJoin, HostNext, HostPrev, HostLock, HostReveal, HostStart, HostEnd, HostKick,
  PlayerJoin, PlayerResume, PlayerAnswer,
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

/* ---------- Server → Client ---------- */

export const StateSnapshot = z.object({ t: z.literal("state:snapshot"), snapshot: SessionSnapshot });
export const PlayerJoined = z.object({
  t: z.literal("player:joined"),
  participantId: z.string(),
  token: z.string(),
  nickname: z.string(),
  avatarSeed: z.string(),
});
export const ParticipantsUpdate = z.object({ t: z.literal("participants:update"), participants: z.array(Participant) });
export const SlideOpen = z.object({
  t: z.literal("slide:open"),
  slide: Slide,
  idx: z.number().int(),
  startedAt: z.number(),
  serverNow: z.number(),
});
export const SlidePhaseChange = z.object({ t: z.literal("slide:phase"), phase: SlidePhase });
export const SlideTally = z.object({ t: z.literal("slide:tally"), slideId: z.string(), tally: Tally, answeredCount: z.number() });
export const AnswerAck = z.object({ t: z.literal("answer:ack"), slideId: z.string() });
/** Reveal: host'a tam liste; katılımcıya kendi özeti. */
export const SlideReveal = z.object({
  t: z.literal("slide:reveal"),
  slideId: z.string(),
  tally: Tally,
  correct: z.union([z.array(z.string()), z.boolean(), z.null()]),
  leaderboard: z.array(LeaderboardEntry),
  you: z
    .object({ correct: z.boolean().nullable(), pointsAwarded: z.number(), score: z.number(), rank: z.number(), rankDelta: z.number(), streak: z.number() })
    .optional(),
});
export const SessionEnded = z.object({ t: z.literal("session:ended"), podium: z.array(LeaderboardEntry) });
export const ErrorMessage = z.object({
  t: z.literal("error"),
  code: z.enum(["bad_code", "bad_secret", "nickname_taken", "session_full", "session_ended", "not_open", "already_answered", "invalid", "kicked"]),
  message: z.string().optional(),
});

export const ServerMessage = z.discriminatedUnion("t", [
  StateSnapshot, PlayerJoined, ParticipantsUpdate, SlideOpen, SlidePhaseChange, SlideTally, AnswerAck, SlideReveal, SessionEnded, ErrorMessage,
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

export const MAX_PARTICIPANTS = 50;
