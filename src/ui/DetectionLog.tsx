import { useSessionStore } from '../store/sessionStore';
import type { StutterEvent, StutterType } from '../detection/types';

function timeAgo(timestamp: number): string {
  const s = Math.floor((Date.now() - timestamp) / 1000);
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

const TYPE_STYLES: Record<StutterType, { bg: string; text: string }> = {
  block: { bg: 'bg-red-500/15', text: 'text-red-400' },
  repetition: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  prolongation: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
};

function EventRow({ event, index }: { event: StutterEvent; index: number }) {
  const style = TYPE_STYLES[event.type];
  return (
    <li
      className="flex items-center gap-3 px-4 py-2.5 text-sm animate-fade-in hover:bg-white/[0.02] transition-colors"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-semibold ${style.bg} ${style.text}`}>
        {event.type}
      </span>
      <span className="text-gray-300 font-mono text-xs">
        {Math.round(event.confidence * 100)}%
      </span>
      {event.type === 'block' && event.silenceDurationMs !== undefined && (
        <span className="text-gray-600 text-xs">{event.silenceDurationMs}ms</span>
      )}
      {event.type === 'repetition' && event.repeatCount !== undefined && (
        <span className="text-gray-600 text-xs">{event.repeatCount}x</span>
      )}
      <span className="ml-auto text-gray-600 text-xs">{timeAgo(event.timestamp)}</span>
    </li>
  );
}

export function DetectionLog() {
  const detectionEvents = useSessionStore((s) => s.detectionEvents);
  const visible = [...detectionEvents].reverse().slice(0, 10);

  return (
    <div className="glass rounded-xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Detection History
        </p>
        {detectionEvents.length > 0 && (
          <span className="text-xs text-gray-600">{detectionEvents.length} total</span>
        )}
      </div>
      <div className="max-h-[35vh] overflow-y-auto">
        {visible.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-6">
            No detections yet
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.03]">
            {visible.map((event, i) => (
              <EventRow key={event.id} event={event} index={i} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default DetectionLog;
