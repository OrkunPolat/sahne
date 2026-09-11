// LiveSession'ın dış dünyaya yazdığı her şey bu arayüzden geçer; testlerde no-op enjekte edilir.
import type { AnswerValue, Participant, SessionPhase } from "@sahne/protocol";

export interface RevealRow {
  participantId: string;
  answered: boolean;
  correct: boolean | null;
  pointsAwarded: number;
  score: number;
  streak: number;
}

export interface Persistence {
  addParticipant(sessionId: string, p: Participant): Promise<void>;
  saveAnswer(sessionId: string, slideId: string, participantId: string, value: AnswerValue, answeredAt: number, msTaken: number): Promise<void>;
  saveReveal(sessionId: string, slideId: string, rows: RevealRow[]): Promise<void>;
  setState(sessionId: string, state: SessionPhase, currentSlideIdx: number): Promise<void>;
}

export const noopPersistence: Persistence = {
  addParticipant: async () => {},
  saveAnswer: async () => {},
  saveReveal: async () => {},
  setState: async () => {},
};
