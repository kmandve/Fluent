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

  const [, setTick] = useState(0);

  useEffect(() => {
    if (!isListening && !sessionStartTime) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isListening, sessionStartTime]);

  const blocks = detectionEvents.filter((e) => e.type === 'block').length;
  const repetitions = detectionEvents.filter((e) => e.type === 'repetition').length;
  const prolongations = detectionEvents.filter((e) => e.type === 'prolongation').length;
  const total = detectionEvents.length;

  const elapsedSeconds = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : 0;
  const showRate = elapsedSeconds >= 60;
  const ratePerMin = showRate ? ((total / elapsedSeconds) * 60).toFixed(1) : null;

  const stats = [
    { label: 'Blocks', count: blocks, color: 'bg-red-500/20 text-red-400', dot: 'bg-red-400' },
    { label: 'Repetitions', count: repetitions, color: 'bg-amber-500/20 text-amber-400', dot: 'bg-amber-400' },
    { label: 'Prolongations', count: prolongations, color: 'bg-blue-500/20 text-blue-400', dot: 'bg-blue-400' },
  ];

  return (
    <div className="glass rounded-xl p-5 flex flex-col gap-4 glass-hover transition-all duration-300">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Session
      </p>

      {/* Timer */}
      <div className="text-center">
        <span className={`
          text-4xl font-mono font-bold tracking-widest transition-colors duration-300
          ${isListening ? 'text-white' : 'text-gray-500'}
        `}>
          {formatElapsed(sessionStartTime)}
        </span>
        {ratePerMin && (
          <p className="text-gray-500 text-xs mt-1">{ratePerMin} events/min</p>
        )}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between px-1">
        <span className="text-gray-400 text-sm">Total Detections</span>
        <span className="text-white font-bold text-lg">{total}</span>
      </div>

      {/* Type breakdown */}
      <div className="flex flex-col gap-2">
        {stats.map(({ label, count, color, dot }) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              <span className="text-gray-400">{label}</span>
            </div>
            <span className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold ${color}`}>
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SessionStats;
