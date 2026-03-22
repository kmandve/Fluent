export interface DAFEngine {
  enable: () => void;
  disable: () => void;
  setDelay: (ms: number) => void;
  setInputGain: (multiplier: number) => void;
  isEnabled: () => boolean;
  destroy: () => void;
}

/**
 * DAF Engine — based on the proven approach from
 * github.com/KorayUlusan/delayed-auditory-feedback-online
 *
 * Audio chain: source → delay → splitter → merger → gain → destination
 *
 * Key design choices:
 * - NO filters or compressor — they cause muffling and artifacts
 * - ChannelSplitter/Merger converts mono mic to stereo headphone output
 * - Only the DELAYED signal reaches the speakers — no direct mic path
 * - Input gain (multiplier) boosts the signal cleanly
 */
export function createDAFEngine(
  audioCtx: AudioContext,
  source: MediaStreamAudioSourceNode
): DAFEngine {
  // 1. Delay node — the core DAF effect
  const delayNode = audioCtx.createDelay(0.3); // max 300ms headroom
  delayNode.delayTime.value = 0.05; // default 50ms

  // 2. Channel splitter/merger — mono mic → stereo output
  //    Without this, mono mic input only plays in one ear
  const splitter = audioCtx.createChannelSplitter(1);
  const merger = audioCtx.createChannelMerger(2);

  // 3. Gain node — clean volume boost, no processing artifacts
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = 1.5; // slight boost by default

  // Wire the chain: source → delay → splitter → merger(both channels) → gain
  source.connect(delayNode);
  delayNode.connect(splitter);
  splitter.connect(merger, 0, 0); // mono input → left channel
  splitter.connect(merger, 0, 1); // mono input → right channel
  merger.connect(gainNode);
  // gainNode → destination is controlled by enable/disable

  let enabled = false;

  function enable(): void {
    if (!enabled) {
      gainNode.connect(audioCtx.destination);
      enabled = true;
    }
  }

  function disable(): void {
    if (enabled) {
      try { gainNode.disconnect(audioCtx.destination); } catch { /* */ }
      enabled = false;
    }
  }

  function setDelay(ms: number): void {
    const clamped = Math.min(200, Math.max(10, ms));
    delayNode.delayTime.setValueAtTime(clamped / 1000, audioCtx.currentTime);
  }

  function setInputGain(multiplier: number): void {
    const clamped = Math.max(0.1, Math.min(5, multiplier));
    gainNode.gain.setValueAtTime(clamped, audioCtx.currentTime);
  }

  function isEnabled(): boolean {
    return enabled;
  }

  function destroy(): void {
    disable();
    try { source.disconnect(delayNode); } catch { /* */ }
    try { delayNode.disconnect(splitter); } catch { /* */ }
    try { splitter.disconnect(merger); } catch { /* */ }
    try { merger.disconnect(gainNode); } catch { /* */ }
  }

  return { enable, disable, setDelay, setInputGain, isEnabled, destroy };
}
