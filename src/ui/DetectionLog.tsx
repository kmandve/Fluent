import { useSessionStore } from '../store/sessionStore';
import type { StutterEvent, StutterType } from '../detection/types';

function formatTimestamp(timestamp: number): string {
  const secondsAgo = Math.floor((Date.now() - timestamp) / 1000);
  if (secondsAgo < 60) return `${secondsAgo}s ago`;
  const minutesAgo = Math.floor(secondsAgo / 60);
  return `${minutesAgo}m ago`;
}

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

const TYPE_BADGE: Record<StutterType, string> = {
  block: 'bg-red-500 text-white',
  repetition: 'bg-amber-500 text-white',
  prolongation: 'bg-blue-500 text-white',
};

function EventDetail({ event }: { event: StutterEvent }) {
  if (event.type === 'block' && event.silenceDurationMs !== undefined) {
    return <span className="text-gray-400 text-xs">{event.silenceDurationMs}ms silence</span>;
  }
  if (event.type === 'repetition' && event.repeatCount !== undefined) {
    return <span className="text-gray-400 text-xs">{event.repeatCount}x repeats</span>;
  }
  if (event.type === 'prolongation' && event.stallDurationMs !== undefined) {
    return <span className="text-gray-400 text-xs">{event.stallDurationMs}ms stall</span>;
  }
  return null;
}

export function DetectionLog() {
  const detectionEvents = useSessionStore((s) => s.detectionEvents);
  const isListening = useSessionStore((s) => s.isListening);

  if (!isListening) return null;

  // Show most recent events first, max 10 visible
  const visibleEvents = [...detectionEvents].reverse().slice(0, 10);

  return (
    <div className="mt-4 w-full max-w-2xl">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Detection Log
      </h2>
      <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/50 backdrop-blur-sm">
        {visibleEvents.length === 0 ? (
          <p className="text-gray-500 italic text-sm text-center py-4 px-3">
            No detections yet
          </p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {visibleEvents.map((event) => (
              <li key={event.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                {/* Type badge */}
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${TYPE_BADGE[event.type]}`}
                >
                  {event.type}
                </span>

                {/* Confidence */}
                <span className="text-white font-mono">
                  {formatConfidence(event.confidence)}
                </span>

                {/* Optional detail */}
                <EventDetail event={event} />

                {/* Timestamp (pushed right) */}
                <span className="ml-auto text-gray-500 text-xs shrink-0">
                  {formatTimestamp(event.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default DetectionLog;
