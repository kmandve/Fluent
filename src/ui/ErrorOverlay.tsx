import { useSessionStore } from '../store/sessionStore';

export function ErrorOverlay() {
  const errorState = useSessionStore((s) => s.errorState);

  if (errorState === 'none') {
    return null;
  }

  if (errorState === 'mic-denied') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-xl p-8 max-w-md mx-4 text-center">
          <h2 className="text-xl font-bold text-white mb-4">
            Microphone Access Denied
          </h2>
          <p className="text-gray-300 mb-6">
            Fluent needs microphone access to listen to your speech. Open Chrome
            Settings &gt; Privacy &gt; Microphone and allow this site.
          </p>
          <button
            onClick={() => useSessionStore.getState().setErrorState('none')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-500 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (errorState === 'unsupported') {
    return (
      <div className="fixed top-0 inset-x-0 bg-red-700 text-white text-center py-3 z-50">
        Fluent requires Google Chrome. Please open this page in Chrome to use
        speech recognition.
      </div>
    );
  }

  return null;
}
