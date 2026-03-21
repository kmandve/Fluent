import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createStutterDetector,
  calibrateAmbientNoise,
  BLOCK_ENERGY_THRESHOLD_DEFAULT,
  BLOCK_CONFIRM_MS,
  TRANSCRIPT_STALL_MS,
  CONFIDENCE_THRESHOLD,
  COOLDOWN_MS,
  MIN_SPEECH_BEFORE_BLOCK_MS,
} from './stutterDetector';

// Mock the sessionStore
vi.mock('../store/sessionStore', () => ({
  useSessionStore: {
    getState: vi.fn(() => ({
      addDetectionEvent: vi.fn(),
      interimText: '',
    })),
    subscribe: vi.fn(),
  },
}));

const mockUUID = '00000000-0000-0000-0000-000000000001';
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => mockUUID),
});

import { useSessionStore } from '../store/sessionStore';

function getMockAddDetectionEvent() {
  return (useSessionStore.getState as ReturnType<typeof vi.fn>)().addDetectionEvent as ReturnType<typeof vi.fn>;
}

const BASE_NOW = 1_000_000;

/**
 * Simulate realistic speech before a block — user says words over MIN_SPEECH_BEFORE_BLOCK_MS.
 * Returns the timestamp after speech activity is established.
 */
function simulateSpeechActivity(
  detector: ReturnType<typeof createStutterDetector>,
  startTime: number
): number {
  // User starts speaking word by word over 1.2 seconds
  detector.tick(0.1, 'I', startTime);
  detector.tick(0.1, 'I want', startTime + 300);
  detector.tick(0.1, 'I want to', startTime + 600);
  detector.tick(0.1, 'I want to say', startTime + 900);
  detector.tick(0.1, 'I want to say something', startTime + 1200);
  return startTime + 1200; // return time after speech is established
}

describe('createStutterDetector', () => {
  let addDetectionEventMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
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
    it('fires after sustained silence when user was actively speaking', () => {
      const detector = createStutterDetector();
      const speechEnd = simulateSpeechActivity(detector, BASE_NOW);
      const interimText = 'I want to say something';

      // Transcript stalls, energy drops
      const stalledAt = speechEnd + TRANSCRIPT_STALL_MS + 10;
      detector.tick(0.005, interimText, stalledAt);

      // Confirm block after BLOCK_CONFIRM_MS
      const confirmedAt = stalledAt + BLOCK_CONFIRM_MS + 10;
      const event = detector.tick(0.005, interimText, confirmedAt);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('block');
      expect(event?.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    });

    it('does NOT fire if user only said one word', () => {
      const detector = createStutterDetector();

      // Only one word spoken
      detector.tick(0.1, 'hello', BASE_NOW);

      // Long silence
      const stalledAt = BASE_NOW + MIN_SPEECH_BEFORE_BLOCK_MS + TRANSCRIPT_STALL_MS + 100;
      detector.tick(0.005, 'hello', stalledAt);

      const confirmedAt = stalledAt + BLOCK_CONFIRM_MS + 10;
      const event = detector.tick(0.005, 'hello', confirmedAt);

      expect(event).toBeNull();
    });

    it('does NOT fire before BLOCK_CONFIRM_MS', () => {
      const detector = createStutterDetector();
      const speechEnd = simulateSpeechActivity(detector, BASE_NOW);
      const interimText = 'I want to say something';

      const stalledAt = speechEnd + TRANSCRIPT_STALL_MS + 10;
      detector.tick(0.005, interimText, stalledAt);

      // Too early
      const tooEarlyAt = stalledAt + 200;
      const event = detector.tick(0.005, interimText, tooEarlyAt);

      expect(event).toBeNull();
    });

    it('resets to FLUENT when energy rises during ONSET_SILENCE', () => {
      const detector = createStutterDetector();
      const speechEnd = simulateSpeechActivity(detector, BASE_NOW);
      const interimText = 'I want to say something';

      const stalledAt = speechEnd + TRANSCRIPT_STALL_MS + 10;
      detector.tick(0.005, interimText, stalledAt);
      expect(detector.getState()).toBe('ONSET_SILENCE');

      // Energy spike
      detector.tick(0.05, interimText, stalledAt + 200);
      expect(detector.getState()).toBe('FLUENT');
    });

    it('suppressed when interimText ends with filler word', () => {
      const detector = createStutterDetector();
      const speechEnd = simulateSpeechActivity(detector, BASE_NOW);

      // Change to filler ending
      detector.tick(0.1, 'I want to um', speechEnd + 100);

      const stalledAt = speechEnd + 100 + TRANSCRIPT_STALL_MS + 10;
      detector.tick(0.005, 'I want to um', stalledAt);

      const confirmedAt = stalledAt + BLOCK_CONFIRM_MS + 10;
      const event = detector.tick(0.005, 'I want to um', confirmedAt);

      expect(event).toBeNull();
    });

    it('suppressed on empty-to-empty transcript', () => {
      const detector = createStutterDetector();

      detector.tick(0.005, '', BASE_NOW);
      detector.tick(0.005, '', BASE_NOW + TRANSCRIPT_STALL_MS + 10);
      detector.tick(0.005, '', BASE_NOW + TRANSCRIPT_STALL_MS + BLOCK_CONFIRM_MS + 10);

      expect(detector.getState()).toBe('FLUENT');
      expect(addDetectionEventMock).not.toHaveBeenCalled();
    });
  });

  describe('cooldown', () => {
    it('no events fire during cooldown window', () => {
      const detector = createStutterDetector();
      const speechEnd = simulateSpeechActivity(detector, BASE_NOW);
      const interimText = 'I want to say something';

      const stalledAt = speechEnd + TRANSCRIPT_STALL_MS + 10;
      detector.tick(0.005, interimText, stalledAt);
      const confirmedAt = stalledAt + BLOCK_CONFIRM_MS + 10;
      const firstEvent = detector.tick(0.005, interimText, confirmedAt);
      expect(firstEvent).not.toBeNull();

      // During cooldown
      const duringCooldown = confirmedAt + 500;
      expect(detector.tick(0.005, interimText, duringCooldown)).toBeNull();

      const duringCooldown2 = confirmedAt + COOLDOWN_MS - 100;
      expect(detector.tick(0.005, interimText, duringCooldown2)).toBeNull();

      expect(addDetectionEventMock).toHaveBeenCalledOnce();
    });

    it('transitions back to FLUENT after cooldown expires', () => {
      const detector = createStutterDetector();
      const speechEnd = simulateSpeechActivity(detector, BASE_NOW);
      const interimText = 'I want to say something';

      const stalledAt = speechEnd + TRANSCRIPT_STALL_MS + 10;
      detector.tick(0.005, interimText, stalledAt);
      const confirmedAt = stalledAt + BLOCK_CONFIRM_MS + 10;
      detector.tick(0.005, interimText, confirmedAt);

      const afterCooldown = confirmedAt + COOLDOWN_MS + 10;
      detector.tick(0.1, 'I want to say something new', afterCooldown);
      expect(detector.getState()).toBe('FLUENT');
    });
  });

  describe('repetition detection', () => {
    it('fires when detectRepetition returns confidence >= threshold', () => {
      const detector = createStutterDetector();
      const event = detector.tick(0.05, 'b b b', BASE_NOW);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('repetition');
      expect(event?.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    });

    it('does NOT fire for non-repetitive text', () => {
      const detector = createStutterDetector();
      const event = detector.tick(0.05, 'hello', BASE_NOW);
      expect(event?.type).not.toBe('repetition');
    });
  });

  describe('prolongation detection', () => {
    it('fires when energy is high and text stalled long enough', () => {
      const detector = createStutterDetector();
      detector.tick(0.05, 'sss', BASE_NOW);
      const event = detector.tick(0.05, 'sss', BASE_NOW + 2000);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('prolongation');
      expect(event?.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    });

    it('does NOT fire if energy is too low', () => {
      const detector = createStutterDetector();
      detector.tick(0.005, 'sss', BASE_NOW);
      const event = detector.tick(0.005, 'sss', BASE_NOW + 2000);

      if (event !== null) {
        expect(event.type).not.toBe('prolongation');
      }
    });
  });

  describe('setThreshold and reset', () => {
    it('setThreshold changes the energy threshold for block detection', () => {
      const detector = createStutterDetector({ blockEnergyThreshold: 0.1 });
      const speechEnd = simulateSpeechActivity(detector, BASE_NOW);
      const interimText = 'I want to say something';

      // energy 0.02 is below custom threshold 0.1 and below PROLONGATION_ENERGY_FLOOR
      const stalledAt = speechEnd + TRANSCRIPT_STALL_MS + 10;
      detector.tick(0.02, interimText, stalledAt);
      const confirmedAt = stalledAt + BLOCK_CONFIRM_MS + 100;
      const event = detector.tick(0.02, interimText, confirmedAt);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('block');
    });

    it('reset() returns detector to FLUENT state', () => {
      const detector = createStutterDetector();
      const speechEnd = simulateSpeechActivity(detector, BASE_NOW);

      const stalledAt = speechEnd + TRANSCRIPT_STALL_MS + 10;
      detector.tick(0.005, 'I want to say something', stalledAt);
      expect(detector.getState()).toBe('ONSET_SILENCE');

      detector.reset();
      expect(detector.getState()).toBe('FLUENT');
    });
  });

  describe('calibrateAmbientNoise', () => {
    it('returns a number for the computed threshold', async () => {
      vi.useFakeTimers();
      const getRMS = vi.fn(() => 0.003 + Math.random() * 0.002);

      const calibratePromise = calibrateAmbientNoise(getRMS, 500, 100);
      await vi.advanceTimersByTimeAsync(600);
      const threshold = await calibratePromise;

      expect(typeof threshold).toBe('number');
      expect(threshold).toBeGreaterThan(0);
      vi.useRealTimers();
    });

    it('raises threshold for loud environments', async () => {
      vi.useFakeTimers();
      const getRMS = vi.fn(() => 0.1);

      const calibratePromise = calibrateAmbientNoise(getRMS, 500, 100);
      await vi.advanceTimersByTimeAsync(600);
      const threshold = await calibratePromise;

      expect(threshold).toBeGreaterThanOrEqual(BLOCK_ENERGY_THRESHOLD_DEFAULT);
      vi.useRealTimers();
    });
  });
});
