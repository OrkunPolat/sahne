// LiveSession'ın dış dünyaya yazdığı her şey bu arayüzden geçer; testlerde no-op enjekte edilir.
import type { AnswerValue, BracketPlay, Participant, SessionPhase } from "@sahne/protocol";

export interface RevealRow {
  participantId: string;
  answered: boolean;
  correct: boolean | null;
  pointsAwarded: number;
  score: number;
  streak: number;
}

export interface Persistence {
  addParticipant(sessionId: string, p: Participant, deviceId: string | null): Promise<void>;
  /** answerId: bellekte üretilen kimlik (qa slaydında soru kimliği olarak istemciye de gider). */
  saveAnswer(sessionId: string, slideId: string, participantId: string, answerId: string, value: AnswerValue, answeredAt: number, msTaken: number): Promise<void>;
  saveReveal(sessionId: string, slideId: string, rows: RevealRow[]): Promise<void>;
  setState(sessionId: string, state: SessionPhase, currentSlideIdx: number): Promise<void>;
  /** Oturum bitti: public_token + ended_at. */
  setEnded(sessionId: string, publicToken: string, endedAt: number): Promise<void>;
  /** Canlı bracket şampiyonu belirlenince: tournament_plays (source live) + stats. */
  recordTournamentPlay(tournamentId: string, play: BracketPlay): Promise<void>;
}

export const noopPersistence: Persistence = {
  addParticipant: async () => {},
  saveAnswer: async () => {},
  saveReveal: async () => {},
  setState: async () => {},
  setEnded: async () => {},
  recordTournamentPlay: async () => {},
};
