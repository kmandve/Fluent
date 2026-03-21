export interface PredictionResult {
  word: string;
  source: 'local' | 'llm' | 'local-fallback';
  latencyMs: number;
  triggeredByEventId: string;
}

export interface LocalPrediction {
  word: string;
  confidence: number;
}
