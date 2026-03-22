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
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-950 to-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5 min-h-screen">

        {/* Header */}
        <header className="flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                Fluent
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">Delayed Auditory Feedback</p>
            </div>
            {isListening && (
              <span className={`
                text-xs font-medium px-3 py-1 rounded-full transition-all duration-500
                ${dafEnabled
                  ? 'bg-green-500/15 text-green-400 border border-green-500/30 animate-pulse-glow'
                  : 'bg-gray-800 text-gray-400 border border-gray-700'
                }
              `}>
                {dafEnabled ? 'DAF Active' : 'Listening'}
              </span>
            )}
          </div>
          <ControlBar start={start} stop={stop} isListening={isListening} />
        </header>

        {/* Waveform */}
        <div className="animate-slide-up delay-100">
          <WaveformDisplay analyserNode={analyserNode} isActive={isListening} dafEnabled={dafEnabled} />
        </div>

        {/* Controls grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-slide-up delay-200">
          <DAFControls />
          <SessionStats />
        </div>

        {/* Bottom panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 animate-slide-up delay-300">
          {/* Transcript */}
          <div className="glass rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Live Transcript
              </p>
            </div>
            <div className="flex-1 max-h-[30vh] lg:max-h-[40vh]">
              <TranscriptDisplay />
            </div>
          </div>

          {/* Detection History */}
          <div className="animate-slide-up delay-400">
            <DetectionLog />
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-3 text-gray-600 text-xs animate-fade-in delay-400">
          Built for HackVH 2026
        </footer>
      </div>
    </div>
  );
}

export default Dashboard;
