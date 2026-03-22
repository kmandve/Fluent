import { useState, useEffect } from 'react';
import { useSessionStore } from '../store/sessionStore';

interface AudioDevice {
  deviceId: string;
  label: string;
}

export function MicSelector() {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const selectedMicId = useSessionStore((s) => s.selectedMicId);
  const setSelectedMicId = useSessionStore((s) => s.setSelectedMicId);
  const isListening = useSessionStore((s) => s.isListening);

  useEffect(() => {
    async function loadDevices() {
      // Need a temporary getUserMedia call to get permission — labels are empty without it
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempStream.getTracks().forEach((t) => t.stop());
      } catch {
        // Permission denied — devices will have empty labels
      }

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const mics = allDevices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 6)}`,
        }));
      setDevices(mics);

      // Auto-select first device if nothing selected
      if (!selectedMicId && mics.length > 0) {
        setSelectedMicId(mics[0].deviceId);
      }
    }

    loadDevices();

    // Re-enumerate when devices change (e.g., headphones plugged in)
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
  }, [selectedMicId, setSelectedMicId]);

  if (devices.length <= 1) return null; // No point showing selector with only one mic

  return (
    <div className="glass rounded-xl p-4 glass-hover transition-all duration-300 animate-fade-in">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Microphone
      </p>
      <select
        value={selectedMicId || ''}
        onChange={(e) => setSelectedMicId(e.target.value || null)}
        disabled={isListening}
        className="
          w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2.5
          text-sm text-gray-200 appearance-none cursor-pointer
          hover:border-gray-600 focus:border-green-500/50 focus:outline-none
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-colors duration-200
        "
      >
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label}
          </option>
        ))}
      </select>
      {isListening && (
        <p className="text-[10px] text-gray-600 mt-1.5">Stop listening to change mic</p>
      )}
    </div>
  );
}

export default MicSelector;
