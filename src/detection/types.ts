export type StutterType = 'block' | 'repetition' | 'prolongation';
export type DetectorState = 'FLUENT' | 'ONSET_SILENCE' | 'BLOCK_CONFIRMED' | 'COOLDOWN';

export interface StutterEvent {
  id: string;
  type: StutterType;
  confidence: number;
  timestamp: number;
  silenceDurationMs?: number;
  repeatCount?: number;
  stallDurationMs?: number;
}

export interface DetectorContext {
  state: DetectorState;
  silenceStartMs: number | null;
  lastInterimText: string;
  lastInterimChangeMs: number;
  cooldownUntilMs: number;
  speechStartMs: number | null;
  wordCount: number;
}
