import type { AcousticAnalyzer } from '../audio/acousticAnalyzer';
import type { CaptureManager } from '../audio/captureManager';
import { ControlBar } from './ControlBar';
import { WaveformDisplay } from './WaveformDisplay';
import { DAFControls } from './DAFControls';
import { SessionStats } from './SessionStats';
import { TranscriptDisplay } from './TranscriptDisplay';
import { DetectionLog } from './DetectionLog';
import { useSessionStore } from '../store/sessionStore';

interface DashboardProps {
  analyzer: AcousticAnalyzer | null;
  start: () => void;
  stop: () => void;
  isListening: boolean;
  captureManager: CaptureManager;
}

export function Dashboard({ analyzer, start, stop, isListening }: DashboardProps) {
  const analyserNode = analyzer ? analyzer.getAnalyserNode() : null;
  const dafEnabled = useSessionStore((s) => s.dafEnabled);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 max-w-4xl mx-auto flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white tracking-tight">Fluent</h1>
          {isListening && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              dafEnabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
            }`}>
              {dafEnabled ? 'DAF Active' : 'Listening'}
            </span>
          )}
        </div>
        <ControlBar start={start} stop={stop} isListening={isListening} />
      </div>

      {/* Waveform — full width */}
      <WaveformDisplay analyserNode={analyserNode} />

      {/* Controls row: DAF Controls + Session Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DAFControls />
        <SessionStats />
      </div>

      {/* Transcript */}
      <div className="bg-gray-900 border border-gray-700/50 rounded-lg overflow-hidden">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">
          Live Transcript
        </p>
        <div className="max-h-[25vh]">
          <TranscriptDisplay />
        </div>
      </div>

      {/* Detection History */}
      <DetectionLog />
    </div>
  );
}

export default Dashboard;
