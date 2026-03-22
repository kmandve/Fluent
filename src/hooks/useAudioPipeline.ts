import { useRef, useCallback, useEffect } from 'react';
import { createCaptureManager } from '../audio/captureManager';
import { createAcousticAnalyzer, type AcousticAnalyzer } from '../audio/acousticAnalyzer';
import { createDAFEngine, type DAFEngine } from '../audio/dafEngine';
import { useSessionStore } from '../store/sessionStore';
import { createStutterDetector, calibrateAmbientNoise } from '../detection/stutterDetector';

// VAD constants for speech-gated DAF
const VAD_RMS_THRESHOLD = 0.015;
const VAD_HANGOVER_MS = 2000;
const CUE_FREQ_ON = 880;
const CUE_FREQ_OFF = 440;
const CUE_DURATION_MS = 60;
const CUE_VOLUME = 0.08;

export function useAudioPipeline() {
  const captureManagerRef = useRef(createCaptureManager());
  const analyzerRef = useRef<AcousticAnalyzer | null>(null);
  const dafEngineRef = useRef<DAFEngine | null>(null);
  const energyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectorRef = useRef<ReturnType<typeof createStutterDetector> | null>(null);
  const isListening = useSessionStore((s) => s.isListening);

  // VAD state (kept in refs so the 100ms tick can access without re-renders)
  const vadActiveRef = useRef(false);
  const lastSpeechTimeRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play a short sine tone as audio cue
  const playCue = useCallback((freq: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = CUE_VOLUME;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + CUE_DURATION_MS / 1000);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }, []);

  const start = useCallback(async () => {
    const manager = captureManagerRef.current;
    const stream = await manager.start();

    if (!stream) return;

    const analyzer = createAcousticAnalyzer(stream);
    analyzerRef.current = analyzer;
    audioCtxRef.current = analyzer.getAudioContext();

    const detector = createStutterDetector();
    detectorRef.current = detector;

    const dafEngine = createDAFEngine(analyzer.getAudioContext(), analyzer.getSource());
    dafEngineRef.current = dafEngine;

    // Set delay from store but DON'T enable yet — VAD will enable when speech starts
    const { dafDelayMs } = useSessionStore.getState();
    dafEngine.setDelay(dafDelayMs);
    useSessionStore.getState().setDafEnabled(false);

    // Reset VAD state
    vadActiveRef.current = false;
    lastSpeechTimeRef.current = 0;

    calibrateAmbientNoise(analyzer.getRMS).then((threshold) => {
      console.debug('[useAudioPipeline] Ambient calibration complete, threshold:', threshold);
      detector.setThreshold(threshold);
    });

    // 100ms tick: energy polling + stutter detection + VAD-gated DAF
    energyIntervalRef.current = setInterval(() => {
      const rms = analyzer.getRMS();
      useSessionStore.getState().setEnergyLevel(rms);

      const { interimText } = useSessionStore.getState();
      detectorRef.current?.tick(rms, interimText, Date.now());

      // --- VAD: speech-gated DAF ---
      const now = Date.now();
      const isSpeech = rms > VAD_RMS_THRESHOLD;

      if (isSpeech) {
        lastSpeechTimeRef.current = now;

        // Activate DAF if not already active
        if (!vadActiveRef.current) {
          vadActiveRef.current = true;
          dafEngineRef.current?.enable();
          useSessionStore.getState().setDafEnabled(true);
          playCue(CUE_FREQ_ON);
          console.debug('[VAD] Speech detected — DAF ON');
        }
      } else if (vadActiveRef.current) {
        // Check hangover: deactivate after 2s of silence
        const silenceMs = now - lastSpeechTimeRef.current;
        if (silenceMs >= VAD_HANGOVER_MS) {
          vadActiveRef.current = false;
          dafEngineRef.current?.disable();
          useSessionStore.getState().setDafEnabled(false);
          playCue(CUE_FREQ_OFF);
          console.debug('[VAD] Silence for', silenceMs, 'ms — DAF OFF');
        }
      }
    }, 100);

    useSessionStore.getState().setListening(true);
  }, [playCue]);

  const stop = useCallback(() => {
    if (dafEngineRef.current) {
      dafEngineRef.current.destroy();
      dafEngineRef.current = null;
    }

    if (detectorRef.current) {
      detectorRef.current.reset();
      detectorRef.current = null;
    }

    if (energyIntervalRef.current) {
      clearInterval(energyIntervalRef.current);
      energyIntervalRef.current = null;
    }

    if (analyzerRef.current) {
      analyzerRef.current.stop();
      analyzerRef.current = null;
    }

    audioCtxRef.current = null;
    vadActiveRef.current = false;

    captureManagerRef.current.stop();

    useSessionStore.getState().setListening(false);
    useSessionStore.getState().setEnergyLevel(0);
    useSessionStore.getState().setDafEnabled(false);
  }, []);

  // Subscribe to delay slider changes and apply to engine in real-time
  useEffect(() => {
    const unsub = useSessionStore.subscribe(
      (s) => s.dafDelayMs,
      (dafDelayMs) => {
        dafEngineRef.current?.setDelay(dafDelayMs);
      }
    );
    return unsub;
  }, []);

  return {
    start,
    stop,
    isListening,
    captureManager: captureManagerRef.current,
    analyzer: analyzerRef.current,
  };
}
