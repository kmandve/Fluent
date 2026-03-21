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

Object.defineProperty(globalThis, 'SpeechRecognition', { value: MockSpeechRecognition, writable: true });
Object.defineProperty(globalThis, 'webkitSpeechRecognition', { value: MockSpeechRecognition, writable: true });
Object.defineProperty(globalThis, 'AudioContext', { value: MockAudioContext, writable: true });
Object.defineProperty(globalThis, 'webkitAudioContext', { value: MockAudioContext, writable: true });
