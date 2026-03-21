import { useAudioPipeline } from './hooks/useAudioPipeline';
import { usePredictionPipeline } from './hooks/usePredictionPipeline';

function App() {
  useAudioPipeline();
  usePredictionPipeline();

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <h1 className="text-4xl font-bold">Fluent</h1>
    </div>
  )
}

export default App
