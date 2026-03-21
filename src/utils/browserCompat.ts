export function isSpeechRecognitionSupported(): boolean {
  return (
    'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  );
}
