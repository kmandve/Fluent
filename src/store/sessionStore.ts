import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { StutterEvent } from '../detection/types';
import type { PredictionResult } from '../prediction/types';

export interface TranscriptEntry {
  id: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export interface SessionState {
  isListening: boolean;
  transcript: TranscriptEntry[];
  interimText: string;
  energyLevel: number;
  errorState: 'none' | 'mic-denied' | 'unsupported';

  detectionEvents: StutterEvent[];
  lastDetection: StutterEvent | null;
  predictedWord: PredictionResult | null;

  // DAF state
  dafEnabled: boolean;
  dafDelayMs: number;

  // Session timing
  sessionStartTime: number | null;

  setListening: (listening: boolean) => void;
  addFinalTranscript: (text: string) => void;
  setInterimText: (text: string) => void;
  setEnergyLevel: (level: number) => void;
  setErrorState: (state: SessionState['errorState']) => void;
  addDetectionEvent: (event: StutterEvent) => void;
  clearDetectionEvents: () => void;
  setPredictedWord: (result: PredictionResult) => void;
  clearPredictedWord: () => void;
  resetSession: () => void;

  // DAF actions
  setDafEnabled: (enabled: boolean) => void;
  setDafDelayMs: (ms: number) => void;
  setSessionStartTime: (time: number | null) => void;
}

export const useSessionStore = create<SessionState>()(
  subscribeWithSelector((set) => ({
    isListening: false,
    transcript: [],
    interimText: '',
    energyLevel: 0,
    errorState: 'none',
    detectionEvents: [],
    lastDetection: null,
    predictedWord: null,

    // DAF defaults
    dafEnabled: false,
    dafDelayMs: 50,

    // Session timing
    sessionStartTime: null,

    setListening: (listening) =>
      set({
        isListening: listening,
        sessionStartTime: listening ? Date.now() : null,
      }),
    addFinalTranscript: (text) =>
      set((state) => ({
        transcript: [
          ...state.transcript.slice(-(49)),
          {
            id: crypto.randomUUID(),
            text,
            isFinal: true,
            timestamp: Date.now(),
          },
        ],
        interimText: '',
      })),
    setInterimText: (text) => set({ interimText: text }),
    setEnergyLevel: (level) => set({ energyLevel: level }),
    setErrorState: (errorState) => set({ errorState }),
    addDetectionEvent: (event) =>
      set((state) => ({
        detectionEvents: [...state.detectionEvents.slice(-19), event],
        lastDetection: event,
      })),
    clearDetectionEvents: () => set({ detectionEvents: [], lastDetection: null }),
    setPredictedWord: (result) => set({ predictedWord: result }),
    clearPredictedWord: () => set({ predictedWord: null }),
    resetSession: () =>
      set({
        isListening: false,
        transcript: [],
        interimText: '',
        energyLevel: 0,
        errorState: 'none',
        detectionEvents: [],
        lastDetection: null,
        predictedWord: null,
        dafEnabled: false,
        dafDelayMs: 50,
        sessionStartTime: null,
      }),

    // DAF actions
    setDafEnabled: (enabled) => set({ dafEnabled: enabled }),
    setDafDelayMs: (ms) => set({ dafDelayMs: ms }),
    setSessionStartTime: (time) => set({ sessionStartTime: time }),
  }))
);
