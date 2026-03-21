import { useRef, useCallback } from 'react';
import { createCaptureManager } from '../audio/captureManager';
import { createAcousticAnalyzer, type AcousticAnalyzer } from '../audio/acousticAnalyzer';
import { useSessionStore } from '../store/sessionStore';

export function useAudioPipeline() {
  const captureManagerRef = useRef(createCaptureManager());
  const analyzerRef = useRef<AcousticAnalyzer | null>(null);
  const energyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isListening = useSessionStore((s) => s.isListening);

  const start = useCallback(async () => {
    const manager = captureManagerRef.current;
    const stream = await manager.start();

    if (!stream) return; // getUserMedia failed, error state already set

    // Start acoustic energy track from the same getUserMedia stream
    const analyzer = createAcousticAnalyzer(stream);
    analyzerRef.current = analyzer;

    // Poll RMS at 100ms intervals, write to store
    energyIntervalRef.current = setInterval(() => {
      const rms = analyzer.getRMS();
      useSessionStore.getState().setEnergyLevel(rms);
    }, 100);

    useSessionStore.getState().setListening(true);
  }, []);

  const stop = useCallback(() => {
    // Stop energy polling
    if (energyIntervalRef.current) {
      clearInterval(energyIntervalRef.current);
      energyIntervalRef.current = null;
    }

    // Stop acoustic analyzer
    if (analyzerRef.current) {
      analyzerRef.current.stop();
      analyzerRef.current = null;
    }

    // Stop capture manager (stops recognition + mic tracks)
    captureManagerRef.current.stop();

    useSessionStore.getState().setListening(false);
    useSessionStore.getState().setEnergyLevel(0);
  }, []);

  return { start, stop, isListening };
}
