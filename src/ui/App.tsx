import { useEffect } from 'react';
import { TranscriptDisplay } from './TranscriptDisplay';
import { ControlBar } from './ControlBar';
import { ErrorOverlay } from './ErrorOverlay';
import { isSpeechRecognitionSupported } from '../utils/browserCompat';
import { useSessionStore } from '../store/sessionStore';

export function App() {
  // Check browser support on mount — set error state if unsupported
  useEffect(() => {
    if (!isSpeechRecognitionSupported()) {
      useSessionStore.getState().setErrorState('unsupported');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center p-6">
      <h1 className="text-3xl font-bold mb-2">Fluent</h1>
      <p className="text-gray-400 mb-6">Real-time speech assistance</p>
      <div className="w-full max-w-2xl flex-1 flex flex-col">
        <TranscriptDisplay />
        <div className="mt-4">
          <ControlBar />
        </div>
      </div>
      <ErrorOverlay />
    </div>
  );
}

export default App;
