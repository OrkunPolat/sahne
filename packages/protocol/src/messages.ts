import { z } from "zod";
import { AnswerValue, Slide, Tally } from "./slides";
import { BracketState } from "./tournament";
import { FastestEntry, LeaderboardEntry, Participant, SessionSnapshot, SlidePhase, TeamStanding } from "./session";

/* ---------- Client → Server ---------- */

export const HostJoin = z.object({ t: z.literal("host:join"), code: z.string(), hostSecret: z.string() });
export const HostNext = z.object({ t: z.literal("host:next") });
export const HostPrev = z.object({ t: z.literal("host:prev") });
export const HostLock = z.object({ t: z.literal("host:lock") });
export const HostReveal = z.object({ t: z.literal("host:reveal") });
export const HostStart = z.object({ t: z.literal("host:start") });
export const HostEnd = z.object({ t: z.literal("host:end") });
export const HostKick = z.object({ t: z.literal("host:kick"), participantId: z.string() });

export const PlayerJoin = z.object({
  t: z.literal("player:join"),
  code: z.string(),
  nickname: z.string().min(1).max(20),
  /** Cihaz kimliği (localStorage, rastgele). Seri tablosu ve "aynı cihaz" eşlemesi için. */
  deviceId: z.string().max(40).optional(),
  /** Takım modu açıksa katılımcının seçtiği takım; yoksa sunucu atar. */
  teamId: z.string().optional(),
});
export const PlayerResume = z.object({ t: z.literal("player:resume"), code: z.string(), token: z.string() });
export const PlayerAnswer = z.object({ t: z.literal("player:answer"), slideId: z.string(), value: AnswerValue });
export const REACTION_EMOJIS = ["👏", "🔥", "😂", "❤️", "🤔", "❓"] as const;
export const Reaction = z.enum(REACTION_EMOJIS);
export type Reaction = z.infer<typeof Reaction>;
/** Herhangi bir anda gönderilebilir; sunucu kişi başı saniyede 2 ile sınırlar. */
export const PlayerReact = z.object({ t: z.literal("player:react"), emoji: Reaction });
/** qa slaydında bir soruyu oylama (toggle). */
export const PlayerUpvote = z.object({ t: z.literal("player:upvote"), slideId: z.string(), questionId: z.string() });

export const ClientMessage = z.discriminatedUnion("t", [
  HostJoin, HostNext, HostPrev, HostLock, HostReveal, HostStart, HostEnd, HostKick,
  PlayerJoin, PlayerResume, PlayerAnswer, PlayerReact, PlayerUpvote,
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
  teamId: z.string().nullable().default(null),
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
  /** Puanlı slaytta en hızlı 3 doğru cevap. */
  fastest: z.array(FastestEntry).default([]),
  /** Takım modu açıksa takım sıralaması. */
  teams: z.array(TeamStanding).default([]),
  you: z
    .object({ correct: z.boolean().nullable(), pointsAwarded: z.number(), score: z.number(), rank: z.number(), rankDelta: z.number(), streak: z.number() })
    .optional(),
});
export const SessionEnded = z.object({
  t: z.literal("session:ended"),
  podium: z.array(LeaderboardEntry),
  teams: z.array(TeamStanding).default([]),
  /** Herkese açık sonuç sayfası: HOST_URL/r/<publicToken>. */
  publicToken: z.string().nullable().default(null),
});
/** Bracket slaydında her eşleşme değişiminde herkese. */
export const BracketStateMsg = z.object({ t: z.literal("bracket:state"), state: BracketState });
/** Herkese yayınlanır (host ekranında uçar). */
export const ReactionBroadcast = z.object({ t: z.literal("reaction"), emoji: Reaction, participantId: z.string() });
export const ErrorMessage = z.object({
  t: z.literal("error"),
  code: z.enum(["bad_code", "bad_secret", "nickname_taken", "session_full", "session_ended", "not_open", "already_answered", "invalid", "kicked", "rate_limited", "bad_team"]),
  message: z.string().optional(),
});

export const ServerMessage = z.discriminatedUnion("t", [
  StateSnapshot, PlayerJoined, ParticipantsUpdate, SlideOpen, SlidePhaseChange, SlideTally, AnswerAck, SlideReveal, SessionEnded, ErrorMessage, ReactionBroadcast, BracketStateMsg,
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

export const MAX_PARTICIPANTS = 50;
