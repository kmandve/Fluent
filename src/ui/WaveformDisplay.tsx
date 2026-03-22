import { useEffect, useRef } from 'react';

interface WaveformDisplayProps {
  analyserNode: AnalyserNode | null;
  isActive: boolean;
  dafEnabled: boolean;
}

export function WaveformDisplay({ analyserNode, isActive, dafEnabled }: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      if (!canvas || !ctx) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }

      const w = rect.width;
      const h = rect.height;

      // Background with subtle gradient
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#0a0e1a');
      bg.addColorStop(1, '#060a14');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Center line (always visible)
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.15)';
      ctx.lineWidth = 1;
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      if (!analyserNode) {
        // Idle: subtle animated dots
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 8]);
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const bufferLength = analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserNode.getByteTimeDomainData(dataArray);

      // Glow effect behind waveform
      const glowColor = dafEnabled ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 211, 238, 0.06)';
      const glowGrad = ctx.createLinearGradient(0, 0, 0, h);
      glowGrad.addColorStop(0, 'transparent');
      glowGrad.addColorStop(0.3, glowColor);
      glowGrad.addColorStop(0.7, glowColor);
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, w, h);

      // Waveform line
      const lineColor = dafEnabled ? '#22c55e' : '#22d3ee';
      ctx.beginPath();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      const sliceWidth = w / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();

      // Shadow waveform (subtle depth)
      ctx.beginPath();
      ctx.strokeStyle = dafEnabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 211, 238, 0.12)';
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [analyserNode, dafEnabled]);

  return (
    <div className={`
      w-full rounded-xl overflow-hidden transition-all duration-500
      ${isActive
        ? (dafEnabled ? 'ring-1 ring-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.1)]' : 'ring-1 ring-cyan-500/20')
        : 'ring-1 ring-gray-800'
      }
    `}>
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: '140px', display: 'block' }}
      />
    </div>
  );
}

export default WaveformDisplay;
