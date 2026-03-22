import { useState, useEffect } from 'react';
import { useSessionStore } from '../store/sessionStore';

function formatElapsed(startTime: number | null): string {
  if (startTime === null) return '00:00';
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function SessionStats() {
  const sessionStartTime = useSessionStore((s) => s.sessionStartTime);
  const detectionEvents = useSessionStore((s) => s.detectionEvents);
  const isListening = useSessionStore((s) => s.isListening);

  // Local tick for the timer
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!isListening && !sessionStartTime) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isListening, sessionStartTime]);

  // Count by type
  const blocks = detectionEvents.filter((e) => e.type === 'block').length;
  const repetitions = detectionEvents.filter((e) => e.type === 'repetition').length;
  const prolongations = detectionEvents.filter((e) => e.type === 'prolongation').length;
  const total = detectionEvents.length;

  // Per-minute rate (only show if session > 60s)
  const elapsedSeconds = sessionStartTime
    ? Math.floor((Date.now() - sessionStartTime) / 1000)
    : 0;
  const showRate = elapsedSeconds >= 60;
  const ratePerMin = showRate ? ((total / elapsedSeconds) * 60).toFixed(1) : null;

  return (
    <div className="bg-gray-900 border border-gray-700/50 rounded-lg p-4 flex flex-col gap-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Session
      </p>

      {/* Timer */}
      <div className="text-center">
        <span className="text-4xl font-mono font-bold text-white tracking-widest">
          {formatElapsed(sessionStartTime)}
        </span>
      </div>

      {/* Stutter counts */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Total</span>
          <span className="text-white font-semibold">
            {total}
            {ratePerMin && (
              <span className="text-gray-500 text-xs ml-1">({ratePerMin}/min)</span>
            )}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Blocks</span>
          <span className="inline-flex items-center gap-1">
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500 text-white">
              {blocks}
            </span>
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Repetitions</span>
          <span className="inline-flex items-center gap-1">
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-white">
              {repetitions}
            </span>
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Prolongations</span>
          <span className="inline-flex items-center gap-1">
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500 text-white">
              {prolongations}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default SessionStats;
