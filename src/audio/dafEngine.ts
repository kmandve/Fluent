export interface DAFEngine {
  enable: () => void;
  disable: () => void;
  setDelay: (ms: number) => void;
  isEnabled: () => boolean;
  destroy: () => void;
}

export function createDAFEngine(
  audioCtx: AudioContext,
  source: MediaStreamAudioSourceNode
): DAFEngine {
  // --- Audio processing chain ---
  // source → highpass → lowpass → presence → compressor → gain → delay → destination
  //
  // Goal: isolate the wearer's voice, make it clear and loud,
  //       cut background noise without making it sound muffled.

  // 1. High-pass — cut rumble below 100Hz (fans, HVAC, vibrations)
  //    Keep it low so we don't lose the warmth of the voice
  const highpass = audioCtx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 100;
  highpass.Q.value = 0.5; // Very gentle slope — no harsh cutoff

  // 2. Low-pass — cut harsh high frequencies above 8kHz (hiss, sibilance)
  const lowpass = audioCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 8000;
  lowpass.Q.value = 0.5;

  // 3. Presence boost — shelf boost at 2-4kHz where speech clarity lives
  //    This is the key: makes the voice sound crisp and present without being tinny
  const presence = audioCtx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 3000; // 3kHz — speech intelligibility sweet spot
  presence.Q.value = 1.0;         // Moderate width — covers 2-4kHz range
  presence.gain.value = 5;        // +5dB boost at the clarity frequency

  // 4. Compressor — gentle, just to even out volume (NOT aggressive)
  //    Light ratio so it doesn't squash the voice or make it sound flat
  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -25; // Only compress louder parts
  compressor.knee.value = 20;       // Very soft knee — transparent compression
  compressor.ratio.value = 2;       // 2:1 — gentle, keeps dynamics natural
  compressor.attack.value = 0.01;   // 10ms — lets transients through
  compressor.release.value = 0.2;   // 200ms — smooth release

  // 5. Output gain — make the result louder
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = 3.0; // ~+10dB — noticeably louder

  // 6. Delay — the DAF effect
  const delayNode = audioCtx.createDelay(0.2);
  delayNode.delayTime.value = 0.05;

  // Wire: source → highpass → lowpass → presence → compressor → gain → delay
  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(presence);
  presence.connect(compressor);
  compressor.connect(gainNode);
  gainNode.connect(delayNode);

  let enabled = false;

  function enable(): void {
    if (!enabled) {
      delayNode.connect(audioCtx.destination);
      enabled = true;
    }
  }

  function disable(): void {
    if (enabled) {
      try { delayNode.disconnect(audioCtx.destination); } catch { /* */ }
      enabled = false;
    }
  }

  function setDelay(ms: number): void {
    const clamped = Math.min(100, Math.max(10, ms));
    delayNode.delayTime.setValueAtTime(clamped / 1000, audioCtx.currentTime);
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
    try { highpass.disconnect(lowpass); } catch { /* */ }
    try { lowpass.disconnect(presence); } catch { /* */ }
    try { presence.disconnect(compressor); } catch { /* */ }
    try { compressor.disconnect(gainNode); } catch { /* */ }
    try { gainNode.disconnect(delayNode); } catch { /* */ }
  }

  return { enable, disable, setDelay, isEnabled, destroy };
}
