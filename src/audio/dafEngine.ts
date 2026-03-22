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
  // maxDelay must be set at creation time — 200ms provides headroom above 100ms slider max
  const delayNode = audioCtx.createDelay(0.2);
  delayNode.delayTime.value = 0.05; // Default 50ms

  let enabled = false;

  function enable(): void {
    if (!enabled) {
      delayNode.connect(audioCtx.destination);
      enabled = true;
    }
  }

  function disable(): void {
    if (enabled) {
      delayNode.disconnect(audioCtx.destination);
      enabled = false;
    }
  }

  function setDelay(ms: number): void {
    // Clamp to 10-100ms range per D-03
    const clamped = Math.min(100, Math.max(10, ms));
    // setValueAtTime for glitch-free changes
    delayNode.delayTime.setValueAtTime(clamped / 1000, audioCtx.currentTime);
  }

  function isEnabled(): boolean {
    return enabled;
  }

  function destroy(): void {
    if (enabled) {
      try {
        delayNode.disconnect(audioCtx.destination);
      } catch {
        // Already disconnected — ignore
      }
      enabled = false;
    }
    try {
      source.disconnect(delayNode);
    } catch {
      // Already disconnected — ignore
    }
  }

  // Connect source to delay node (but not to destination yet — enabled controls that)
  source.connect(delayNode);

  return { enable, disable, setDelay, isEnabled, destroy };
}
