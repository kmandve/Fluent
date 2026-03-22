import { useRef, useEffect } from 'react';
import { useSessionStore } from '../store/sessionStore';

export function TranscriptDisplay() {
  const transcript = useSessionStore((s) => s.transcript);
  const interimText = useSessionStore((s) => s.interimText);
  const isListening = useSessionStore((s) => s.isListening);
  const predictedWord = useSessionStore((s) => s.predictedWord);
  const bottomRef = useRef<HTMLDivElement>(null);

  // D-02: Auto-scroll to keep latest text visible
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimText]);

  const isEmpty = transcript.length === 0 && !interimText;

  return (
    <div className="overflow-y-auto max-h-[30vh] bg-gray-900 p-4 min-h-[80px] flex flex-col">
      {isEmpty && !isListening ? (
        <p className="text-gray-500 italic text-lg text-center mt-8">
          Click Start to begin...
        </p>
      ) : (
        <>
          {/* D-01: Rolling log — new entries append at bottom, older text scrolls up */}
          {transcript.map((entry) => (
            <p key={entry.id} className="text-white text-lg mb-1">
              {entry.text}
            </p>
          ))}

          {/* Interim text shown in gray italic at the bottom */}
          {interimText && (
            <p className="text-gray-400 text-lg italic">{interimText}</p>
          )}

          {/* Predicted word flash — visible while predictedWord is non-null (OUT-02) */}
          {predictedWord && (
            <div className="mt-2 px-3 py-1 bg-green-600/30 border border-green-500/50 rounded-md inline-block animate-pulse">
              <span className="text-green-300 text-lg font-semibold">
                {predictedWord.word}
              </span>
              <span className="text-green-400/60 text-sm ml-2">
                (spoken)
              </span>
            </div>
          )}
        </>
      )}

      {/* Scroll anchor — always at bottom of the list */}
      <div ref={bottomRef} />
    </div>
  );
}
