import { detectRepetition, detectProlongation } from './heuristics';
import { endsWithFiller } from './fillerWords';
import type { DetectorState, DetectorContext, StutterEvent } from './types';
import { useSessionStore } from '../store/sessionStore';

// ─── Threshold Constants ──────────────────────────────────────────────────────

export const BLOCK_ENERGY_THRESHOLD_DEFAULT = 0.02;
export const BLOCK_CONFIRM_MS = 600;
export const TRANSCRIPT_STALL_MS = 300;
export const CONFIDENCE_THRESHOLD = 0.75;
export const COOLDOWN_MS = 2000;
export const CALIBRATION_DURATION_MS = 2500;
export const CALIBRATION_SAMPLE_INTERVAL_MS = 100;

// ─── Ambient Calibration ─────────────────────────────────────────────────────

/**
 * Collect RMS samples for durationMs, compute the 95th percentile, multiply
 * by 1.5, and return the result capped at BLOCK_ENERGY_THRESHOLD_DEFAULT.
 *
 * This is non-blocking — call it on session start and let the detector use
 * the default threshold until the promise resolves.
 */
export function calibrateAmbientNoise(
  getRMS: () => number,
  durationMs = CALIBRATION_DURATION_MS,
  sampleIntervalMs = CALIBRATION_SAMPLE_INTERVAL_MS
): Promise<number> {
  return new Promise<number>((resolve) => {
    const samples: number[] = [];
    const handle = setInterval(() => {
      samples.push(getRMS());
    }, sampleIntervalMs);

    setTimeout(() => {
      clearInterval(handle);

      if (samples.length === 0) {
        resolve(BLOCK_ENERGY_THRESHOLD_DEFAULT);
        return;
      }

      // Sort ascending and pick p95
      const sorted = [...samples].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      const p95 = sorted[Math.min(p95Index, sorted.length - 1)];
      const computed = p95 * 1.5;

      // Use the higher of computed and default — ambient noise floor should raise the threshold, not lower it
      const threshold = Math.max(computed, BLOCK_ENERGY_THRESHOLD_DEFAULT);
      console.debug('[calibration] p95:', p95.toFixed(5), 'computed:', computed.toFixed(5), 'final threshold:', threshold.toFixed(5));
      resolve(threshold);
    }, durationMs);
  });
}

// ─── Detector Factory ─────────────────────────────────────────────────────────

/**
 * Create an FSM-based stutter detector.
 *
 * The detector fuses acoustic energy (RMS) and transcript signals to detect:
 *   1. Silent blocks  — primary demo feature
 *   2. Repetitions    — via heuristics.detectRepetition
 *   3. Prolongations  — via heuristics.detectProlongation
 *
 * Call `tick(energyLevel, interimText, Date.now())` every 100ms from the
 * audio pipeline interval.  Detection events are written to the Zustand store
 * AND returned so callers can inspect them in tests.
 */
export function createStutterDetector(options?: { blockEnergyThreshold?: number }) {
  let blockEnergyThreshold = options?.blockEnergyThreshold ?? BLOCK_ENERGY_THRESHOLD_DEFAULT;

  // Internal FSM context
  const ctx: DetectorContext = {
    state: 'FLUENT',
    silenceStartMs: null,
    lastInterimText: '',
    lastInterimChangeMs: Date.now(),
    cooldownUntilMs: 0,
  };

  // ─── helpers ────────────────────────────────────────────────────────────────

  function fireEvent(
    partial: Omit<StutterEvent, 'id' | 'timestamp'>,
    now: number
  ): StutterEvent {
    const event: StutterEvent = {
      id: crypto.randomUUID(),
      timestamp: now,
      ...partial,
    };
    useSessionStore.getState().addDetectionEvent(event);
    return event;
  }

  function enterCooldown(now: number): void {
    ctx.cooldownUntilMs = now + COOLDOWN_MS;
    ctx.state = 'COOLDOWN';
    ctx.silenceStartMs = null;
  }

  // ─── tick ────────────────────────────────────────────────────────────────────

  function tick(energyLevel: number, interimText: string, now: number): StutterEvent | null {
    // 1. Track interim text changes — save previous text BEFORE updating
    const previousInterimText = ctx.lastInterimText;
    const textChanged = interimText !== ctx.lastInterimText;
    if (textChanged) {
      ctx.lastInterimText = interimText;
      ctx.lastInterimChangeMs = now;
    }

    // 2. Cooldown guard
    if (now < ctx.cooldownUntilMs) {
      return null;
    }

    // 3. Exit cooldown when it has expired
    if (ctx.state === 'COOLDOWN') {
      ctx.state = 'FLUENT';
    }

    // 4. Empty transcript handling
    if (interimText === '') {
      // If we're already tracking a block (ONSET_SILENCE), keep tracking —
      // the empty interim might mean recognition restarted during the block.
      // Only suppress if we're in FLUENT state (normal sentence end).
      if (ctx.state === 'FLUENT') {
        return null;
      }
      // In ONSET_SILENCE: don't reset — the block is still happening
      // Fall through to block FSM which will confirm or reject based on timing
    }

    // 6. Repetition check (takes priority over block — repetitions can coexist with moderate energy)
    const repetitionResult = detectRepetition(interimText);
    if (repetitionResult.detected && repetitionResult.confidence >= CONFIDENCE_THRESHOLD) {
      const event = fireEvent(
        {
          type: 'repetition',
          confidence: repetitionResult.confidence,
          repeatCount: repetitionResult.repeatCount,
        },
        now
      );
      enterCooldown(now);
      return event;
    }

    // 7. Prolongation check — use previousInterimText (before this tick's update)
    //    so the stall comparison is meaningful
    const prolongationResult = detectProlongation(
      energyLevel,
      interimText,
      previousInterimText,
      ctx.lastInterimChangeMs,
      now
    );
    if (prolongationResult.detected && prolongationResult.confidence >= CONFIDENCE_THRESHOLD) {
      const event = fireEvent(
        {
          type: 'prolongation',
          confidence: prolongationResult.confidence,
          stallDurationMs: prolongationResult.stallDurationMs,
        },
        now
      );
      enterCooldown(now);
      return event;
    }

    // 8. Block detection FSM
    // Guard: filler word at end of transcript → suppress
    if (endsWithFiller(interimText)) {
      if (ctx.state === 'ONSET_SILENCE') {
        ctx.state = 'FLUENT';
        ctx.silenceStartMs = null;
      }
      return null;
    }

    // Guard: if energy is above prolongation floor, user is making sound — not a silent block
    if (energyLevel > blockEnergyThreshold) {
      if (ctx.state === 'ONSET_SILENCE') {
        ctx.state = 'FLUENT';
        ctx.silenceStartMs = null;
      }
      return null;
    }

    // Debug: log state transitions (remove for production)
    if (ctx.state !== 'FLUENT') {
      console.debug('[detector]', ctx.state, 'energy:', energyLevel.toFixed(4), 'threshold:', blockEnergyThreshold.toFixed(4), 'interim:', interimText.slice(-20));
    }

    switch (ctx.state) {
      case 'FLUENT': {
        // Only enter ONSET_SILENCE if there was recent speech activity
        // (lastInterimChangeMs was set at some point during this session)
        const hadRecentSpeech = ctx.lastInterimChangeMs > 0;
        const transcriptStalled = now - ctx.lastInterimChangeMs > TRANSCRIPT_STALL_MS;
        if (energyLevel < blockEnergyThreshold && transcriptStalled && hadRecentSpeech) {
          ctx.state = 'ONSET_SILENCE';
          ctx.silenceStartMs = now;
        }
        return null;
      }

      case 'ONSET_SILENCE': {
        const silenceDurationMs = ctx.silenceStartMs !== null ? now - ctx.silenceStartMs : 0;
        if (silenceDurationMs >= BLOCK_CONFIRM_MS) {
          // Compute confidence: base 0.65 + duration bonus + energy bonus
          const durationBonus = (silenceDurationMs / 2000) * 0.25;
          const energyRatio = Math.max(0, 1 - energyLevel / blockEnergyThreshold);
          const confidence = Math.min(0.95, 0.65 + durationBonus + energyRatio * 0.15);

          if (confidence >= CONFIDENCE_THRESHOLD) {
            const event = fireEvent(
              {
                type: 'block',
                confidence,
                silenceDurationMs,
              },
              now
            );
            enterCooldown(now);
            return event;
          }
        }
        return null;
      }

      case 'BLOCK_CONFIRMED': {
        // Should not linger here — immediately enter cooldown
        enterCooldown(now);
        return null;
      }

      default:
        return null;
    }
  }

  // ─── public API ─────────────────────────────────────────────────────────────

  return {
    tick,
    getState(): DetectorState {
      return ctx.state;
    },
    setThreshold(threshold: number): void {
      blockEnergyThreshold = threshold;
    },
    reset(): void {
      ctx.state = 'FLUENT';
      ctx.silenceStartMs = null;
      ctx.lastInterimText = '';
      ctx.lastInterimChangeMs = Date.now();
      ctx.cooldownUntilMs = 0;
    },
  };
}
