import { useSessionStore } from '../store/sessionStore';

interface ControlBarProps {
  start: () => void;
  stop: () => void;
  isListening: boolean;
}

export function ControlBar({ start, stop, isListening }: ControlBarProps) {
  const handleToggle = () => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`
        flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm transition-colors
        ${isListening
          ? 'bg-red-600 hover:bg-red-500 text-white'
          : 'bg-green-600 hover:bg-green-500 text-white'
        }
      `}
    >
      {isListening && (
        <span className="inline-block w-2.5 h-2.5 bg-green-300 rounded-full animate-pulse" />
      )}
      {isListening ? 'Stop' : 'Start'}
    </button>
  );
}
