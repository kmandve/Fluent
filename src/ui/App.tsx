import { useEffect, useRef, useState } from 'react';
import { TranscriptDisplay } from './TranscriptDisplay';
import { ControlBar } from './ControlBar';
import { ErrorOverlay } from './ErrorOverlay';
import { DetectionLog } from './DetectionLog';
import { isSpeechRecognitionSupported } from '../utils/browserCompat';
import { useSessionStore } from '../store/sessionStore';

export function App() {
  const lastDetection = useSessionStore((s) => s.lastDetection);
  const [highlightActive, setHighlightActive] = useState(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check browser support on mount — set error state if unsupported
  useEffect(() => {
    if (!isSpeechRecognitionSupported()) {
      useSessionStore.getState().setErrorState('unsupported');
    }
  }, []);

  // Pulse the transcript container for 800ms whenever a new detection event fires
  useEffect(() => {
    if (!lastDetection) return;

    setHighlightActive(true);

    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = setTimeout(() => {
      setHighlightActive(false);
      highlightTimerRef.current = null;
    }, 800);

    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, [lastDetection]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center p-6">
      <h1 className="text-3xl font-bold mb-2">Fluent</h1>
      <p className="text-gray-400 mb-6">Real-time speech assistance</p>
      <div className="w-full max-w-2xl flex-1 flex flex-col">
        {/* Transcript with detection highlight pulse */}
        <div
          className={`rounded-lg transition-all duration-300 ${
            highlightActive ? 'ring-2 ring-amber-400/60' : 'ring-2 ring-transparent'
          }`}
        >
          <TranscriptDisplay />
        </div>

        <div className="mt-4">
          <ControlBar />
        </div>

        {/* Detection log panel — only visible during active session */}
        <DetectionLog />
      </div>
      <ErrorOverlay />
    </div>
  );
}

export default App;
