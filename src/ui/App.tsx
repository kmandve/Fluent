import { useEffect } from 'react';
import { ErrorOverlay } from './ErrorOverlay';
import { Dashboard } from './Dashboard';
import { isSpeechRecognitionSupported } from '../utils/browserCompat';
import { useSessionStore } from '../store/sessionStore';
import { useAudioPipeline } from '../hooks/useAudioPipeline';

export function App() {
  const { start, stop, isListening, captureManager, analyzer } = useAudioPipeline();

  useEffect(() => {
    if (!isSpeechRecognitionSupported()) {
      useSessionStore.getState().setErrorState('unsupported');
    }
  }, []);

  return (
    <>
      <Dashboard
        analyzer={analyzer}
        start={start}
        stop={stop}
        isListening={isListening}
        captureManager={captureManager}
      />
      <ErrorOverlay />
    </>
  );
}

export default App;
