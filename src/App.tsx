import { useAudioPipeline } from './hooks/useAudioPipeline';
import { usePredictionPipeline } from './hooks/usePredictionPipeline';
import { useTTSOutput } from './hooks/useTTSOutput';

function App() {
  const { captureManager, start, stop, isListening } = useAudioPipeline();
  usePredictionPipeline();
  useTTSOutput(captureManager);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <h1 className="text-4xl font-bold">Fluent</h1>
      <div className="mt-4">
        <button
          onClick={isListening ? stop : start}
          className={`px-6 py-3 rounded-lg font-semibold ${isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
        >
          {isListening ? 'Stop' : 'Start'}
        </button>
      </div>
    </div>
  );
}

export default App;
