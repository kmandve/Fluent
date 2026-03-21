import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('browserCompat - isSpeechRecognitionSupported', () => {
  // We'll re-import the module each time with different window state
  let isSpeechRecognitionSupported: () => boolean

  beforeEach(async () => {
    // Re-import fresh module each test to avoid caching
    const module = await import('../src/utils/browserCompat')
    isSpeechRecognitionSupported = module.isSpeechRecognitionSupported
  })

  it('returns true when window.SpeechRecognition exists', () => {
    // setup.ts already defines SpeechRecognition on globalThis
    // The mock is installed globally in setup.ts
    expect(isSpeechRecognitionSupported()).toBe(true)
  })

  it('returns false when both SpeechRecognition and webkitSpeechRecognition are undefined', () => {
    // Temporarily delete both (requires configurable: true in setup.ts)
    const origSR = (globalThis as any).SpeechRecognition
    const origWSR = (globalThis as any).webkitSpeechRecognition
    delete (globalThis as any).SpeechRecognition
    delete (globalThis as any).webkitSpeechRecognition

    expect(isSpeechRecognitionSupported()).toBe(false)

    // Restore
    Object.defineProperty(globalThis, 'SpeechRecognition', { value: origSR, writable: true, configurable: true })
    Object.defineProperty(globalThis, 'webkitSpeechRecognition', { value: origWSR, writable: true, configurable: true })
  })
})
