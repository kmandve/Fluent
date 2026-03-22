export interface DAFEngine {
  enable: () => void;
  disable: () => void;
  setDelay: (ms: number) => void;
  setGain: (db: number) => void;
  isEnabled: () => boolean;
  destroy: () => void;
}

export function createDAFEngine(
  audioCtx: AudioContext,
  source: MediaStreamAudioSourceNode
): DAFEngine {
  // --- Audio processing chain ---
  // source → highpass → compressor → gain → delay → destination
  //
  // Highpass: cuts low rumble (AC, fans, footsteps) below 200Hz
  // Compressor: boosts quiet speech, tames loud peaks — makes close voice consistent
  // Gain: overall boost so your own voice is louder than background
  // Delay: the DAF effect

  // 1. High-pass filter — removes low-frequency background noise
  const highpass = audioCtx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 200; // Cut below 200Hz (rumble, HVAC, traffic)
  highpass.Q.value = 0.7; // Gentle roll-off

  // 2. Compressor — boosts quiet speech (your voice) and suppresses loud sounds (others talking)
  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -35; // Start compressing at -35dB (catches quiet speech)
  compressor.knee.value = 10;       // Soft knee for natural sound
  compressor.ratio.value = 4;       // 4:1 compression — strong enough to even out levels
  compressor.attack.value = 0.005;  // 5ms attack — fast enough to catch speech onset
  compressor.release.value = 0.15;  // 150ms release — smooth, no pumping

  // 3. Gain — boost the processed signal
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = 2.0; // +6dB boost — makes your close-mic voice noticeably louder

  // 4. Delay — the DAF effect
  const delayNode = audioCtx.createDelay(0.2);
  delayNode.delayTime.value = 0.05;

  // Wire the chain: source → highpass → compressor → gain → delay
  source.connect(highpass);
  highpass.connect(compressor);
  compressor.connect(gainNode);
  gainNode.connect(delayNode);
  // delay → destination is controlled by enable/disable

  let enabled = false;

  function enable(): void {
    if (!enabled) {
      delayNode.connect(audioCtx.destination);
      enabled = true;
    }
  }

  function disable(): void {
    if (enabled) {
      try { delayNode.disconnect(audioCtx.destination); } catch { /* already disconnected */ }
      enabled = false;
    }
  }

  function setDelay(ms: number): void {
    const clamped = Math.min(100, Math.max(10, ms));
    delayNode.delayTime.setValueAtTime(clamped / 1000, audioCtx.currentTime);
  }

  function setGain(db: number): void {
    // Convert dB to linear gain: 0dB=1.0, +6dB=2.0, +12dB=4.0
    const linear = Math.pow(10, db / 20);
    gainNode.gain.setValueAtTime(linear, audioCtx.currentTime);
  }

  function isEnabled(): boolean {
    return enabled;
  }

  function destroy(): void {
    if (enabled) {
      try { delayNode.disconnect(audioCtx.destination); } catch { /* */ }
      enabled = false;
    }
    try { source.disconnect(highpass); } catch { /* */ }
    try { highpass.disconnect(compressor); } catch { /* */ }
    try { compressor.disconnect(gainNode); } catch { /* */ }
    try { gainNode.disconnect(delayNode); } catch { /* */ }
  }

  return { enable, disable, setDelay, setGain, isEnabled, destroy };
}
