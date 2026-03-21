import { describe, it, expect } from 'vitest';
import { detectRepetition, detectProlongation, PROLONGATION_STALL_MS, PROLONGATION_ENERGY_FLOOR } from './heuristics';
import { endsWithFiller } from './fillerWords';

describe('detectRepetition', () => {
  it('detects trailing repetitions with confidence >= 0.75', () => {
    const result = detectRepetition('the cat b b b book');
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('returns false for non-repeating transcript', () => {
    const result = detectRepetition('the cat sat on the mat');
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('detects 4 consecutive repeats with confidence >= 0.85', () => {
    const result = detectRepetition('b b b b');
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('returns false for empty string', () => {
    const result = detectRepetition('');
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('returns false for single word', () => {
    const result = detectRepetition('hello');
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('handles hyphenated repetitions', () => {
    const result = detectRepetition('b-b-b');
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('is case-insensitive', () => {
    const result = detectRepetition('The THE the');
    expect(result.detected).toBe(true);
  });

  it('includes repeatCount in result', () => {
    const result = detectRepetition('a a a');
    expect(result.detected).toBe(true);
    expect(result.repeatCount).toBe(3);
  });

  it('caps confidence at 0.92 for many repeats', () => {
    const result = detectRepetition('b b b b b b b b');
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeLessThanOrEqual(0.92);
  });

  it('does not detect when only one trailing token matches earlier word', () => {
    // "cat sat cat" — "cat" appears twice but not consecutively at the tail
    const result = detectRepetition('cat sat cat mat');
    expect(result.detected).toBe(false);
  });
});

describe('detectProlongation', () => {
  it('detects prolongation when energy high and text stalled >= 400ms', () => {
    const now = Date.now();
    const result = detectProlongation(0.05, 'sss', 'sss', now - 500, now);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it('returns false when text has changed (not stalled)', () => {
    const now = Date.now();
    const result = detectProlongation(0.05, 'sss', 'ssss', now, now);
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('returns false when energy too low', () => {
    const now = Date.now();
    const result = detectProlongation(0.005, 'sss', 'sss', now - 500, now);
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('returns false when stall duration too short', () => {
    const now = Date.now();
    const result = detectProlongation(0.05, 'sss', 'sss', now - 200, now);
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('includes stallDurationMs in result when detected', () => {
    const now = Date.now();
    const result = detectProlongation(0.05, 'sss', 'sss', now - 500, now);
    expect(result.detected).toBe(true);
    expect(result.stallDurationMs).toBeGreaterThanOrEqual(PROLONGATION_STALL_MS);
  });

  it('caps confidence at 0.85 for very long stalls', () => {
    const now = Date.now();
    // 10 seconds stall — should cap at 0.85
    const result = detectProlongation(0.05, 'sss', 'sss', now - 10000, now);
    expect(result.confidence).toBeLessThanOrEqual(0.85);
  });

  it('uses PROLONGATION_ENERGY_FLOOR constant correctly', () => {
    const now = Date.now();
    // Exactly at floor — should not detect (must be ABOVE floor)
    const atFloor = detectProlongation(PROLONGATION_ENERGY_FLOOR, 'sss', 'sss', now - 500, now);
    expect(atFloor.detected).toBe(false);
    // Slightly above floor — should detect
    const aboveFloor = detectProlongation(PROLONGATION_ENERGY_FLOOR + 0.001, 'sss', 'sss', now - 500, now);
    expect(aboveFloor.detected).toBe(true);
  });
});

describe('endsWithFiller', () => {
  it('detects "um" at end of sentence', () => {
    expect(endsWithFiller('I want to um')).toBe(true);
  });

  it('returns false for non-filler ending', () => {
    expect(endsWithFiller('I want to go')).toBe(false);
  });

  it('detects standalone "uh"', () => {
    expect(endsWithFiller('uh')).toBe(true);
  });

  it('detects multi-word filler "i mean"', () => {
    expect(endsWithFiller('I mean')).toBe(true);
  });

  it('detects "you know" at sentence end', () => {
    expect(endsWithFiller('I think you know')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(endsWithFiller('I want to UM')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(endsWithFiller('')).toBe(false);
  });

  it('does not match filler word in middle of sentence', () => {
    // "um" appears in middle — should not match because end is "store"
    expect(endsWithFiller('I um want the store')).toBe(false);
  });
});
