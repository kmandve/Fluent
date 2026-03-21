import { detectRepetition, detectProlongation } from './heuristics';
import { endsWithFiller } from './fillerWords';
import type { DetectorState, DetectorContext, StutterEvent } from './types';
import { useSessionStore } from '../store/sessionStore';

// ─── Threshold Constants ──────────────────────────────────────────────────────

export const BLOCK_ENERGY_THRESHOLD_DEFAULT = 0.015;
export const BLOCK_CONFIRM_MS = 400;
export const TRANSCRIPT_STALL_MS = 200;
export const CONFIDENCE_THRESHOLD = 0.72;
export const COOLDOWN_MS = 1500;
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

      // Cap: never exceed the default threshold (avoids overly permissive thresholds)
      resolve(Math.min(computed, BLOCK_ENERGY_THRESHOLD_DEFAULT));
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

    // 4. Sentence-end guard: if interim text just went empty while previous had content,
    //    that's a finalized sentence — not a block. Reset FSM state.
    if (interimText === '' && previousInterimText !== '') {
      if (ctx.state === 'ONSET_SILENCE') {
        ctx.state = 'FLUENT';
        ctx.silenceStartMs = null;
      }
      return null;
    }

    // 5. Guard: empty-to-empty transcript (recognition restart, no speech yet)
    if (interimText === '' && previousInterimText === '') {
      return null;
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

    switch (ctx.state) {
      case 'FLUENT': {
        const transcriptStalled = now - ctx.lastInterimChangeMs > TRANSCRIPT_STALL_MS;
        if (energyLevel < blockEnergyThreshold && transcriptStalled && interimText !== '') {
          ctx.state = 'ONSET_SILENCE';
          ctx.silenceStartMs = now;
        }
        return null;
      }

      case 'ONSET_SILENCE': {
        const silenceDurationMs = ctx.silenceStartMs !== null ? now - ctx.silenceStartMs : 0;
        if (silenceDurationMs >= BLOCK_CONFIRM_MS) {
          // Compute confidence: base 0.60 + duration bonus + energy bonus
          const durationBonus = (silenceDurationMs / 2000) * 0.2;
          const energyRatio = Math.max(0, 1 - energyLevel / blockEnergyThreshold);
          const confidence = Math.min(0.95, 0.60 + durationBonus + energyRatio * 0.15);

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
