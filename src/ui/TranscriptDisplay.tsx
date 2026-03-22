import { useRef, useEffect } from 'react';
import { useSessionStore } from '../store/sessionStore';

export function TranscriptDisplay() {
  const transcript = useSessionStore((s) => s.transcript);
  const interimText = useSessionStore((s) => s.interimText);
  const isListening = useSessionStore((s) => s.isListening);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimText]);

  const isEmpty = transcript.length === 0 && !interimText;

  return (
    <div className="overflow-y-auto flex-1 px-4 py-3 flex flex-col gap-1">
      {isEmpty ? (
        <p className="text-gray-600 text-sm text-center py-6 animate-breathe">
          {isListening ? 'Listening for speech...' : 'Click Start to begin'}
        </p>
      ) : (
        <>
          {transcript.map((entry, i) => (
            <p
              key={entry.id}
              className="text-gray-200 text-sm leading-relaxed animate-fade-in"
              style={{ animationDelay: `${Math.min(i * 30, 200)}ms` }}
            >
              {entry.text}
            </p>
          ))}
          {interimText && (
            <p className="text-gray-500 text-sm italic animate-fade-in">{interimText}</p>
          )}
        </>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
