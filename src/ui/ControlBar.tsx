import { useEffect, useRef } from 'react';
import { useAudioPipeline } from '../hooks/useAudioPipeline';
import { useSessionStore } from '../store/sessionStore';

export function ControlBar() {
  const { start, stop, isListening } = useAudioPipeline();
  const energyLevel = useSessionStore((s) => s.energyLevel);
  const energyLogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Throttled console debug log for energy — log at most once per 500ms
  useEffect(() => {
    if (energyLogTimerRef.current) return; // timer already pending

    energyLogTimerRef.current = setTimeout(() => {
      energyLogTimerRef.current = null;
      console.debug('[energy] RMS:', energyLevel.toFixed(4));
    }, 500);

    return () => {
      if (energyLogTimerRef.current) {
        clearTimeout(energyLogTimerRef.current);
        energyLogTimerRef.current = null;
      }
    };
  }, [energyLevel]);

  const handleToggle = () => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleToggle}
        className={
          isListening
            ? 'flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors'
            : 'flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-500 transition-colors'
        }
      >
        {isListening && (
          <span className="inline-block w-3 h-3 bg-green-400 rounded-full animate-pulse" />
        )}
        {isListening ? 'Stop' : 'Start Listening'}
      </button>

      {/* Energy debug readout */}
      <p className="text-xs text-gray-500 mt-1">
        Energy: {energyLevel.toFixed(4)}
      </p>
    </div>
  );
}
