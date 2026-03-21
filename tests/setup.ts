import { vi } from 'vitest';

// Mock SpeechRecognition
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onstart: (() => void) | null = null;
  start() {}
  stop() {}
  abort() {}
}

// Mock AudioContext
class MockAudioContext {
  state = 'running';
  createMediaStreamSource() {
    return { connect: () => {} };
  }
  createAnalyser() {
    return {
      fftSize: 256,
      getFloatTimeDomainData: (buffer: Float32Array) => {
        buffer.fill(0);
      },
      connect: () => {},
    };
  }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

Object.defineProperty(globalThis, 'SpeechRecognition', { value: MockSpeechRecognition, writable: true, configurable: true });
Object.defineProperty(globalThis, 'webkitSpeechRecognition', { value: MockSpeechRecognition, writable: true, configurable: true });
Object.defineProperty(globalThis, 'AudioContext', { value: MockAudioContext, writable: true, configurable: true });
Object.defineProperty(globalThis, 'webkitAudioContext', { value: MockAudioContext, writable: true, configurable: true });

// Mock SpeechSynthesisUtterance
class MockSpeechSynthesisUtterance {
  text: string;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  voice: any = null;
  rate = 1;
  pitch = 1;
  volume = 1;
  lang = '';
  constructor(text: string = '') { this.text = text; }
}

const mockSpeechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  getVoices: vi.fn().mockReturnValue([]),
  onvoiceschanged: null as (() => void) | null,
  speaking: false,
  pending: false,
  paused: false,
};

Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
  value: MockSpeechSynthesisUtterance, writable: true, configurable: true,
});
Object.defineProperty(globalThis, 'speechSynthesis', {
  value: mockSpeechSynthesis, writable: true, configurable: true,
});
