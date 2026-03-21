export interface AcousticAnalyzer {
  getRMS: () => number;
  stop: () => void;
}

export function createAcousticAnalyzer(stream: MediaStream): AcousticAnalyzer {
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

  const buffer = new Float32Array(analyser.fftSize);

  function getRMS(): number {
    analyser.getFloatTimeDomainData(buffer);
    let sumSquares = 0;
    for (const sample of buffer) {
      sumSquares += sample * sample;
    }
    return Math.sqrt(sumSquares / buffer.length);
  }

  function stop() {
    audioCtx.close();
  }

  return { getRMS, stop };
}
