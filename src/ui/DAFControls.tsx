import { useSessionStore } from '../store/sessionStore';

export function DAFControls() {
  const dafEnabled = useSessionStore((s) => s.dafEnabled);
  const dafDelayMs = useSessionStore((s) => s.dafDelayMs);
  const isListening = useSessionStore((s) => s.isListening);
  const setDafEnabled = useSessionStore((s) => s.setDafEnabled);
  const setDafDelayMs = useSessionStore((s) => s.setDafDelayMs);

  return (
    <div className="glass rounded-xl p-5 flex flex-col gap-4 glass-hover transition-all duration-300">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          DAF Control
        </p>
        <div className={`
          w-2 h-2 rounded-full transition-all duration-500
          ${dafEnabled ? 'bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-600'}
        `} />
      </div>

      {/* Status + Toggle */}
      <button
        onClick={() => setDafEnabled(!dafEnabled)}
        disabled={!isListening}
        className={`
          w-full py-3 rounded-xl font-semibold text-sm tracking-wide
          transition-all duration-300 ease-out
          ${dafEnabled
            ? 'bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 shadow-[0_0_15px_rgba(34,197,94,0.1)]'
            : 'bg-gray-800/80 text-gray-400 border border-gray-700 hover:bg-gray-700/80 hover:text-gray-300'
          }
          disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-gray-800/80
        `}
      >
        {dafEnabled ? 'DAF Enabled' : 'DAF Disabled'}
      </button>

      {/* Delay display */}
      <div className="text-center">
        <span className={`
          text-4xl font-mono font-bold tracking-tight transition-colors duration-300
          ${dafEnabled ? 'text-white' : 'text-gray-500'}
        `}>
          {dafDelayMs}
        </span>
        <span className="text-gray-500 text-sm ml-1.5">ms delay</span>
      </div>

      {/* Slider */}
      <div className="flex flex-col gap-2">
        <input
          type="range"
          min={10}
          max={100}
          step={1}
          value={dafDelayMs}
          onChange={(e) => setDafDelayMs(Number(e.target.value))}
          disabled={!isListening}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-gray-600 px-0.5">
          <span>10ms</span>
          <span>50ms</span>
          <span>100ms</span>
        </div>
      </div>
    </div>
  );
}

export default DAFControls;
