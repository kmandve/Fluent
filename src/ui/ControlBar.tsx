interface ControlBarProps {
  start: () => void;
  stop: () => void;
  isListening: boolean;
}

export function ControlBar({ start, stop, isListening }: ControlBarProps) {
  return (
    <button
      onClick={() => isListening ? stop() : start()}
      className={`
        relative flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-semibold text-sm
        transition-all duration-300 ease-out
        ${isListening
          ? 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30'
          : 'bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30 hover:shadow-[0_0_20px_rgba(34,197,94,0.15)]'
        }
      `}
    >
      {isListening ? (
        <>
          <span className="w-3 h-3 rounded-sm bg-red-400" />
          Stop
        </>
      ) : (
        <>
          <span className="w-0 h-0 border-l-[8px] border-l-green-400 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent ml-0.5" />
          Start
        </>
      )}
    </button>
  );
}
