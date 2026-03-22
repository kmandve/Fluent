import { useSessionStore } from '../store/sessionStore';

export function DAFControls() {
  const dafEnabled = useSessionStore((s) => s.dafEnabled);
  const dafDelayMs = useSessionStore((s) => s.dafDelayMs);
  const isListening = useSessionStore((s) => s.isListening);
  const setDafEnabled = useSessionStore((s) => s.setDafEnabled);
  const setDafDelayMs = useSessionStore((s) => s.setDafDelayMs);

  const handleToggle = () => {
    setDafEnabled(!dafEnabled);
  };

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDafDelayMs(Number(e.target.value));
  };

  return (
    <div className="bg-gray-900 border border-gray-700/50 rounded-lg p-4 flex flex-col gap-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        DAF Control
      </p>

      {/* Toggle button */}
      <button
        onClick={handleToggle}
        disabled={!isListening}
        className={`
          w-full py-3 rounded-full font-bold text-sm tracking-wide transition-colors
          ${dafEnabled
            ? 'bg-green-500 hover:bg-green-400 text-white'
            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }
          disabled:opacity-40 disabled:cursor-not-allowed
        `}
      >
        DAF {dafEnabled ? 'ON' : 'OFF'}
      </button>

      {/* Current delay readout */}
      <div className="text-center">
        <span className="text-3xl font-mono font-bold text-white">
          {dafDelayMs}
        </span>
        <span className="text-gray-400 text-sm ml-1">ms</span>
      </div>

      {/* Delay slider */}
      <div className="flex flex-col gap-1">
        <input
          type="range"
          min={10}
          max={100}
          step={1}
          value={dafDelayMs}
          onChange={handleSlider}
          disabled={!isListening}
          className="w-full accent-green-500 disabled:opacity-40 disabled:cursor-not-allowed"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>10ms</span>
          <span>100ms</span>
        </div>
      </div>
    </div>
  );
}

export default DAFControls;
