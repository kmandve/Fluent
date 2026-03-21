import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createStutterDetector,
  calibrateAmbientNoise,
  BLOCK_ENERGY_THRESHOLD_DEFAULT,
  BLOCK_CONFIRM_MS,
  TRANSCRIPT_STALL_MS,
  CONFIDENCE_THRESHOLD,
  COOLDOWN_MS,
} from './stutterDetector';

// Mock the sessionStore
vi.mock('../store/sessionStore', () => ({
  useSessionStore: {
    getState: vi.fn(() => ({
      addDetectionEvent: vi.fn(),
      interimText: '',
    })),
  },
}));

// Mock crypto.randomUUID
const mockUUID = '00000000-0000-0000-0000-000000000001';
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => mockUUID),
});

import { useSessionStore } from '../store/sessionStore';

// Helper to get the mocked addDetectionEvent
function getMockAddDetectionEvent() {
  return (useSessionStore.getState as ReturnType<typeof vi.fn>)().addDetectionEvent as ReturnType<typeof vi.fn>;
}

// Helper to simulate multiple ticks
function simulateTicks(
  detector: ReturnType<typeof createStutterDetector>,
  ticks: Array<{ energy: number; interimText: string; now: number }>
): Array<ReturnType<typeof detector.tick>> {
  return ticks.map(({ energy, interimText, now }) => detector.tick(energy, interimText, now));
}

// Baseline "now" for deterministic tests
const BASE_NOW = 1_000_000;

describe('createStutterDetector', () => {
  let addDetectionEventMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup mock to return fresh spy
    addDetectionEventMock = vi.fn();
    (useSessionStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      addDetectionEvent: addDetectionEventMock,
      interimText: '',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('block detection', () => {
    it('fires after 400ms sustained silence with stalled transcript', () => {
      const detector = createStutterDetector();
      const interimText = 'I want to say';

      // First tick: set lastInterimText = interimText (no stall yet, energy below threshold)
      // We need to prime the lastInterimChangeMs with an earlier time
      // Tick at BASE_NOW to prime state (energy is fine, interimText set)
      detector.tick(0.1, interimText, BASE_NOW);

      // Now simulate silence+stall: energy drops below threshold
      // Move forward enough that transcript has been stalled for TRANSCRIPT_STALL_MS
      // and then keep low energy for BLOCK_CONFIRM_MS
      // First transition FLUENT -> ONSET_SILENCE needs:
      //   energy < threshold AND stall >= TRANSCRIPT_STALL_MS
      const stalledAt = BASE_NOW + TRANSCRIPT_STALL_MS + 10; // > 200ms after last text change
      // At stalledAt: low energy, same interimText -> should enter ONSET_SILENCE
      detector.tick(0.005, interimText, stalledAt);

      // Now tick after BLOCK_CONFIRM_MS (400ms) in silence -> should fire block
      const confirmedAt = stalledAt + BLOCK_CONFIRM_MS + 10;
      const event = detector.tick(0.005, interimText, confirmedAt);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('block');
      expect(event?.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
      expect(addDetectionEventMock).toHaveBeenCalledOnce();
    });

    it('does NOT fire at 200ms (below BLOCK_CONFIRM_MS)', () => {
      const detector = createStutterDetector();
      const interimText = 'I want to say';

      // Prime state
      detector.tick(0.1, interimText, BASE_NOW);

      // Enter ONSET_SILENCE
      const stalledAt = BASE_NOW + TRANSCRIPT_STALL_MS + 10;
      detector.tick(0.005, interimText, stalledAt);

      // Tick at only 200ms into silence (less than BLOCK_CONFIRM_MS=400ms)
      const tooEarlyAt = stalledAt + 200;
      const event = detector.tick(0.005, interimText, tooEarlyAt);

      expect(event).toBeNull();
      expect(addDetectionEventMock).not.toHaveBeenCalled();
    });

    it('resets to FLUENT when energy rises during ONSET_SILENCE', () => {
      const detector = createStutterDetector();
      const interimText = 'I want to say';

      // Prime state
      detector.tick(0.1, interimText, BASE_NOW);

      // Enter ONSET_SILENCE
      const stalledAt = BASE_NOW + TRANSCRIPT_STALL_MS + 10;
      detector.tick(0.005, interimText, stalledAt);
      expect(detector.getState()).toBe('ONSET_SILENCE');

      // Energy rises (noise spike) — should reset to FLUENT
      const spikeAt = stalledAt + 200;
      const event = detector.tick(0.05, interimText, spikeAt);

      expect(event).toBeNull();
      expect(detector.getState()).toBe('FLUENT');
      expect(addDetectionEventMock).not.toHaveBeenCalled();
    });

    it('suppressed when interimText ends with filler word', () => {
      const detector = createStutterDetector();
      const interimText = 'I want to um';

      // Prime state
      detector.tick(0.1, interimText, BASE_NOW);

      // Even with silence + stall, filler at end prevents detection
      const stalledAt = BASE_NOW + TRANSCRIPT_STALL_MS + 10;
      detector.tick(0.005, interimText, stalledAt);

      const confirmedAt = stalledAt + BLOCK_CONFIRM_MS + 10;
      const event = detector.tick(0.005, interimText, confirmedAt);

      expect(event).toBeNull();
      expect(addDetectionEventMock).not.toHaveBeenCalled();
    });

    it('suppressed on empty-to-empty transcript (recognition restart)', () => {
      const detector = createStutterDetector();

      // Both current and last are empty — should never enter ONSET_SILENCE
      const results = simulateTicks(detector, [
        { energy: 0.005, interimText: '', now: BASE_NOW },
        { energy: 0.005, interimText: '', now: BASE_NOW + TRANSCRIPT_STALL_MS + 10 },
        { energy: 0.005, interimText: '', now: BASE_NOW + TRANSCRIPT_STALL_MS + BLOCK_CONFIRM_MS + 10 },
      ]);

      expect(results.every((e) => e === null)).toBe(true);
      expect(detector.getState()).toBe('FLUENT');
      expect(addDetectionEventMock).not.toHaveBeenCalled();
    });
  });

  describe('cooldown', () => {
    it('no events fire during 1500ms cooldown window', () => {
      const detector = createStutterDetector();
      const interimText = 'I want to say';

      // Prime and trigger block event
      detector.tick(0.1, interimText, BASE_NOW);
      const stalledAt = BASE_NOW + TRANSCRIPT_STALL_MS + 10;
      detector.tick(0.005, interimText, stalledAt);
      const confirmedAt = stalledAt + BLOCK_CONFIRM_MS + 10;
      const firstEvent = detector.tick(0.005, interimText, confirmedAt);
      expect(firstEvent).not.toBeNull();

      // Now tick during cooldown — should return null
      const duringCooldown = confirmedAt + 500;
      const secondEvent = detector.tick(0.005, interimText, duringCooldown);
      expect(secondEvent).toBeNull();

      const duringCooldown2 = confirmedAt + COOLDOWN_MS - 100;
      const thirdEvent = detector.tick(0.005, interimText, duringCooldown2);
      expect(thirdEvent).toBeNull();

      // Total events: only the first one
      expect(addDetectionEventMock).toHaveBeenCalledOnce();
    });

    it('transitions back to FLUENT after cooldown expires', () => {
      const detector = createStutterDetector();
      const interimText = 'I want to say';

      // Trigger a block event
      detector.tick(0.1, interimText, BASE_NOW);
      const stalledAt = BASE_NOW + TRANSCRIPT_STALL_MS + 10;
      detector.tick(0.005, interimText, stalledAt);
      const confirmedAt = stalledAt + BLOCK_CONFIRM_MS + 10;
      detector.tick(0.005, interimText, confirmedAt);

      // Tick after cooldown expires
      const afterCooldown = confirmedAt + COOLDOWN_MS + 10;
      detector.tick(0.1, interimText, afterCooldown);

      expect(detector.getState()).toBe('FLUENT');
    });
  });

  describe('repetition detection', () => {
    it('fires when detectRepetition returns confidence >= 0.72', () => {
      const detector = createStutterDetector();

      // "b b b" should have confidence 0.75 >= 0.72 threshold
      const event = detector.tick(0.05, 'b b b', BASE_NOW);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('repetition');
      expect(event?.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
      expect(addDetectionEventMock).toHaveBeenCalledOnce();
    });

    it('does NOT fire for repetitions below confidence threshold', () => {
      const detector = createStutterDetector();

      // A single-word transcript has no repetitions
      const event = detector.tick(0.05, 'hello', BASE_NOW);

      expect(event?.type).not.toBe('repetition');
    });
  });

  describe('prolongation detection', () => {
    it('fires when detectProlongation returns confidence >= 0.72', () => {
      const detector = createStutterDetector();
      const interimText = 'sss';

      // Prime the lastInterimText and lastInterimChangeMs
      detector.tick(0.05, interimText, BASE_NOW);

      // Same text, same energy, stalled for 600ms (above PROLONGATION_STALL_MS=400)
      const event = detector.tick(0.05, interimText, BASE_NOW + 600);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('prolongation');
      expect(event?.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
      expect(addDetectionEventMock).toHaveBeenCalledOnce();
    });

    it('does NOT fire if energy is too low for prolongation', () => {
      const detector = createStutterDetector();
      const interimText = 'sss';

      // Low energy — prolognation should not trigger
      detector.tick(0.005, interimText, BASE_NOW);
      const event = detector.tick(0.005, interimText, BASE_NOW + 600);

      // If anything fires, it should NOT be a prolongation
      if (event !== null) {
        expect(event.type).not.toBe('prolongation');
      }
    });
  });

  describe('event timestamp', () => {
    it('detection event timestamp matches the "now" parameter', () => {
      const detector = createStutterDetector();

      // Trigger repetition at a known time
      const eventNow = BASE_NOW + 999;
      const event = detector.tick(0.05, 'b b b', eventNow);

      expect(event).not.toBeNull();
      expect(event?.timestamp).toBe(eventNow);
    });
  });

  describe('setThreshold and reset', () => {
    it('setThreshold changes the energy threshold for block detection', () => {
      const detector = createStutterDetector({ blockEnergyThreshold: 0.1 });
      const interimText = 'I want to say';

      // With threshold=0.1, energy=0.05 should be below threshold -> can detect block
      detector.tick(0.1, interimText, BASE_NOW);
      const stalledAt = BASE_NOW + TRANSCRIPT_STALL_MS + 10;
      detector.tick(0.05, interimText, stalledAt);
      const confirmedAt = stalledAt + BLOCK_CONFIRM_MS + 10;
      const event = detector.tick(0.05, interimText, confirmedAt);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('block');
    });

    it('reset() returns detector to FLUENT state', () => {
      const detector = createStutterDetector();
      const interimText = 'I want to say';

      // Enter ONSET_SILENCE
      detector.tick(0.1, interimText, BASE_NOW);
      const stalledAt = BASE_NOW + TRANSCRIPT_STALL_MS + 10;
      detector.tick(0.005, interimText, stalledAt);
      expect(detector.getState()).toBe('ONSET_SILENCE');

      detector.reset();

      expect(detector.getState()).toBe('FLUENT');
    });
  });

  describe('calibrateAmbientNoise', () => {
    it('returns a number for the computed threshold', async () => {
      vi.useFakeTimers();
      let sampleCount = 0;
      const getRMS = vi.fn(() => {
        sampleCount++;
        return 0.003 + Math.random() * 0.002; // values ~0.003-0.005
      });

      const calibratePromise = calibrateAmbientNoise(getRMS, 500, 100);
      // Advance timers by 500ms + some buffer
      await vi.advanceTimersByTimeAsync(600);
      const threshold = await calibratePromise;

      expect(typeof threshold).toBe('number');
      expect(threshold).toBeGreaterThan(0);
      vi.useRealTimers();
    });

    it('caps threshold at BLOCK_ENERGY_THRESHOLD_DEFAULT', async () => {
      vi.useFakeTimers();
      // Very loud environment — p95 * 1.5 would be high, but cap at default
      const getRMS = vi.fn(() => 0.1); // very loud

      const calibratePromise = calibrateAmbientNoise(getRMS, 500, 100);
      await vi.advanceTimersByTimeAsync(600);
      const threshold = await calibratePromise;

      // Should be capped at BLOCK_ENERGY_THRESHOLD_DEFAULT
      expect(threshold).toBeLessThanOrEqual(BLOCK_ENERGY_THRESHOLD_DEFAULT);
      vi.useRealTimers();
    });
  });
});
