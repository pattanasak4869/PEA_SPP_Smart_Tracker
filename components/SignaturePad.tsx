
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Trash2, Maximize2, X, RotateCcw, Check, MousePointer2 } from 'lucide-react';

interface SignaturePadProps {
  label: string;
  onSave: (signature: string) => void;
}

interface Point { x: number; y: number; }

export const SignaturePad: React.FC<SignaturePadProps> = ({ label, onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  
  const currentStrokeRef = useRef<Point[]>([]);

  // Function to get high-DPI scaling
  const getPixelRatio = (ctx: any) => {
    const backingStore = ctx.backingStorePixelRatio ||
      ctx.webkitBackingStorePixelRatio ||
      ctx.mozBackingStorePixelRatio ||
      ctx.msBackingStorePixelRatio ||
      ctx.oBackingStorePixelRatio ||
      ctx.backingStorePixelRatio || 1;
    return (window.devicePixelRatio || 1) / backingStore;
  };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#6366f1'; // Indigo-500
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    strokes.forEach(stroke => {
      if (stroke.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x * canvas.width, stroke[0].y * canvas.height);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x * canvas.width, stroke[i].y * canvas.height);
      }
      ctx.stroke();
    });
  }, [strokes]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (canvas && container) {
      const rect = container.getBoundingClientRect();
      const ctx = canvas.getContext('2d');
      const ratio = getPixelRatio(ctx);
      
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx?.scale(ratio, ratio);
      
      redraw();
    }
  }, [redraw]);

  // Use ResizeObserver for robust resizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
        initCanvas();
    });

    resizeObserver.observe(container);

    return () => {
        resizeObserver.disconnect();
    };
  }, [initCanvas]);

  // Also re-init when fullscreen toggles
  useEffect(() => {
      setTimeout(initCanvas, 50);
  }, [isFullscreen, initCanvas]);

  const getCoords = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const point = getCoords(e);
    currentStrokeRef.current = [point];
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const point = getCoords(e);
    currentStrokeRef.current.push(point);
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas && currentStrokeRef.current.length > 1) {
      const last = currentStrokeRef.current[currentStrokeRef.current.length - 2];
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(last.x * canvas.width / (window.devicePixelRatio || 1), last.y * canvas.height / (window.devicePixelRatio || 1));
      ctx.lineTo(point.x * canvas.width / (window.devicePixelRatio || 1), point.y * canvas.height / (window.devicePixelRatio || 1));
      ctx.stroke();
    }
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStrokeRef.current.length > 1) {
      const newStrokes = [...strokes, [...currentStrokeRef.current]];
      setStrokes(newStrokes);
      const canvas = canvasRef.current;
      if (canvas) onSave(canvas.toDataURL());
    }
    currentStrokeRef.current = [];
  };

  const handleClear = () => {
    setStrokes([]);
    setHasSignature(false);
    onSave('');
  };

  return (
    <div className={`flex flex-col space-y-2 ${isFullscreen ? 'fixed inset-0 z-[300] bg-slate-950 p-6 animate-fade-in' : 'w-full'}`}>
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2">
           <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</label>
           {hasSignature && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>}
        </div>
        <div className="flex items-center gap-1">
           {hasSignature && (
             <button 
               onClick={handleClear} 
               className="p-2 text-slate-500 hover:text-rose-500 transition-colors bg-white/5 rounded-lg border border-white/5"
               title="ล้างลายเซ็น"
             >
               <RotateCcw size={14} />
             </button>
           )}
           <button 
             onClick={() => setIsFullscreen(!isFullscreen)} 
             className="p-2 text-slate-500 hover:text-indigo-400 transition-colors bg-white/5 rounded-lg border border-white/5"
             title={isFullscreen ? "ย่อหน้าต่าง" : "ขยายเต็มจอ"}
           >
             {isFullscreen ? <X size={14} /> : <Maximize2 size={14} />}
           </button>
        </div>
      </div>

      <div 
        ref={containerRef} 
        className={`relative group bg-black/40 border transition-all duration-500 ${
          isFullscreen 
          ? 'flex-1 rounded-[2.5rem]' 
          : 'h-40 rounded-3xl'
        } ${hasSignature ? 'border-indigo-500/30 shadow-[inset_0_0_20px_rgba(99,102,241,0.05)]' : 'border-white/5'}`}
      >
        {!hasSignature && !isDrawing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20 group-hover:opacity-30 transition-opacity">
            <MousePointer2 size={32} className="text-slate-400 mb-2" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">เซ็นชื่อในบริเวณนี้</p>
          </div>
        )}
        
        <canvas
          ref={canvasRef}
          className="touch-none w-full h-full cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        <div className="absolute bottom-4 right-6 pointer-events-none">
           <div className={`p-2 rounded-full border transition-all duration-500 ${hasSignature ? 'bg-emerald-500 border-emerald-400 shadow-lg' : 'bg-white/5 border-white/10 opacity-20'}`}>
              <Check size={12} className={hasSignature ? 'text-white' : 'text-slate-500'} />
           </div>
        </div>
      </div>

      {isFullscreen && (
        <div className="flex justify-center pt-6">
           <button 
             onClick={() => setIsFullscreen(false)}
             className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-indigo-600/30 transition-all active:scale-95"
           >
             บันทึกและกลับไปที่แบบฟอร์ม
           </button>
        </div>
      )}
    </div>
  );
};
