import type { AcousticAnalyzer } from '../audio/acousticAnalyzer';
import type { CaptureManager } from '../audio/captureManager';
import { ControlBar } from './ControlBar';
import { WaveformDisplay } from './WaveformDisplay';
import { DAFControls } from './DAFControls';
import { SessionStats } from './SessionStats';
import { TranscriptDisplay } from './TranscriptDisplay';
import { DetectionLog } from './DetectionLog';

interface DashboardProps {
  analyzer: AcousticAnalyzer | null;
  start: () => void;
  stop: () => void;
  isListening: boolean;
  captureManager: CaptureManager;
}

export function Dashboard({ analyzer, start, stop, isListening }: DashboardProps) {
  const analyserNode = analyzer ? analyzer.getAnalyserNode() : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 max-w-5xl mx-auto flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Fluent</h1>
          <p className="text-gray-400 text-sm">DAF Dashboard</p>
        </div>
        <ControlBar start={start} stop={stop} isListening={isListening} />
      </div>

      {/* Waveform — full width */}
      <div>
        <WaveformDisplay analyserNode={analyserNode} />
      </div>

      {/* Middle row: DAF Controls + Session Stats side-by-side */}
      <div className="grid grid-cols-2 gap-4">
        <DAFControls />
        <SessionStats />
      </div>

      {/* Transcript — compact */}
      <div className="bg-gray-900 border border-gray-700/50 rounded-lg overflow-hidden">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">
          Transcript
        </p>
        <div className="max-h-[30vh]">
          <TranscriptDisplay />
        </div>
      </div>

      {/* Detection log — always visible */}
      <DetectionLog />
    </div>
  );
}

export default Dashboard;
