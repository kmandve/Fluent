import { useSessionStore } from '../store/sessionStore';

export function ErrorOverlay() {
  const errorState = useSessionStore((s) => s.errorState);

  if (errorState === 'none') return null;

  if (errorState === 'mic-denied') {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
        <div className="glass rounded-2xl p-8 max-w-md mx-4 text-center animate-slide-up">
          <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">
            Microphone Access Required
          </h2>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            Fluent needs microphone access for DAF. Open Chrome Settings &gt; Privacy &gt; Microphone and allow this site.
          </p>
          <button
            onClick={() => useSessionStore.getState().setErrorState('none')}
            className="bg-white/10 hover:bg-white/15 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (errorState === 'unsupported') {
    return (
      <div className="fixed top-0 inset-x-0 bg-red-500/10 border-b border-red-500/20 text-red-400 text-center py-3 text-sm z-50 backdrop-blur-sm animate-slide-up">
        Fluent requires Google Chrome for speech recognition.
      </div>
    );
  }

  return null;
}
