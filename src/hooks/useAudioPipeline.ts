import { useRef, useCallback } from 'react';
import { createCaptureManager } from '../audio/captureManager';
import { createAcousticAnalyzer, type AcousticAnalyzer } from '../audio/acousticAnalyzer';
import { useSessionStore } from '../store/sessionStore';
import { createStutterDetector, calibrateAmbientNoise } from '../detection/stutterDetector';

export function useAudioPipeline() {
  const captureManagerRef = useRef(createCaptureManager());
  const analyzerRef = useRef<AcousticAnalyzer | null>(null);
  const energyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectorRef = useRef<ReturnType<typeof createStutterDetector> | null>(null);
  const isListening = useSessionStore((s) => s.isListening);

  const start = useCallback(async () => {
    const manager = captureManagerRef.current;
    const stream = await manager.start();

    if (!stream) return; // getUserMedia failed, error state already set

    // Start acoustic energy track from the same getUserMedia stream
    const analyzer = createAcousticAnalyzer(stream);
    analyzerRef.current = analyzer;

    // Create stutter detector
    const detector = createStutterDetector();
    detectorRef.current = detector;

    // Run ambient noise calibration (non-blocking — detector works with default
    // threshold until calibration completes)
    calibrateAmbientNoise(analyzer.getRMS).then((threshold) => {
      console.debug('[useAudioPipeline] Ambient calibration complete, threshold:', threshold);
      detector.setThreshold(threshold);
    });

    // Poll RMS at 100ms intervals, write to store, and drive stutter detection
    energyIntervalRef.current = setInterval(() => {
      const rms = analyzer.getRMS();
      useSessionStore.getState().setEnergyLevel(rms);

      // Drive stutter detection on same 100ms tick
      const { interimText } = useSessionStore.getState();
      detectorRef.current?.tick(rms, interimText, Date.now());
    }, 100);

    useSessionStore.getState().setListening(true);
  }, []);

  const stop = useCallback(() => {
    // Reset stutter detector
    if (detectorRef.current) {
      detectorRef.current.reset();
      detectorRef.current = null;
    }

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

  return { start, stop, isListening, captureManager: captureManagerRef.current };
}
