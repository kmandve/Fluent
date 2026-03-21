import { create } from 'zustand';

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

  setListening: (listening: boolean) => void;
  addFinalTranscript: (text: string) => void;
  setInterimText: (text: string) => void;
  setEnergyLevel: (level: number) => void;
  setErrorState: (state: SessionState['errorState']) => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  isListening: false,
  transcript: [],
  interimText: '',
  energyLevel: 0,
  errorState: 'none',

  setListening: (listening) => set({ isListening: listening }),
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
  resetSession: () =>
    set({
      isListening: false,
      transcript: [],
      interimText: '',
      energyLevel: 0,
      errorState: 'none',
    }),
}));
