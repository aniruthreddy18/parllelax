import React, { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { useIntelligence } from '../../context/IntelligenceContext';

export const TimeScrubber: React.FC = () => {
  const { hotspots, timelineIndex, setTimelineIndex, selectIncidentById } = useIntelligence();
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);

  useEffect(() => {
    let timer: any = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setTimelineIndex((prev: number) => {
          if (prev >= hotspots.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          selectIncidentById(hotspots[next].id);
          return next;
        });
      }, 2000 / speed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, speed, hotspots, setTimelineIndex, selectIncidentById]);

  const currentHotspot = hotspots[timelineIndex] || hotspots[0];

  return (
    <div className="h-11 bg-[#0B111A] border-t border-[#243244] px-4 flex items-center justify-between z-20 shrink-0 font-mono text-xs text-slate-300">
      {/* Playback Controls */}
      <div className="flex items-center space-x-1.5">
        <button
          onClick={() => {
            setTimelineIndex(0);
            selectIncidentById(hotspots[0].id);
          }}
          className="p-1 rounded bg-[#111A26] border border-[#243244] hover:text-[#2FA8D8] transition"
          title="Reset Timeline"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => {
            const next = Math.max(0, timelineIndex - 1);
            setTimelineIndex(next);
            selectIncidentById(hotspots[next].id);
          }}
          className="p-1 rounded bg-[#111A26] border border-[#243244] hover:text-[#2FA8D8] transition"
          title="Step Back"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`p-1 rounded border transition flex items-center space-x-1 ${
            isPlaying
              ? 'bg-[#E9A23B]/20 border-[#E9A23B]/60 text-[#E9A23B]'
              : 'bg-[#2FA8D8]/20 border-[#2FA8D8]/60 text-[#2FA8D8]'
          }`}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={() => {
            const next = Math.min(hotspots.length - 1, timelineIndex + 1);
            setTimelineIndex(next);
            selectIncidentById(hotspots[next].id);
          }}
          className="p-1 rounded bg-[#111A26] border border-[#243244] hover:text-[#2FA8D8] transition"
          title="Step Forward"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setSpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 5 : 1))}
          className="px-2 py-0.5 bg-[#111A26] border border-[#243244] text-[10px] text-[#2FA8D8] rounded"
        >
          {speed}X Speed
        </button>
      </div>

      {/* Time Slider */}
      <div className="flex-1 mx-6 flex items-center space-x-3">
        <span className="text-[10px] text-slate-500 hidden sm:inline">00:00 IST</span>
        <input
          type="range"
          min={0}
          max={hotspots.length - 1}
          value={timelineIndex}
          onChange={(e) => {
            const idx = parseInt(e.target.value, 10);
            setTimelineIndex(idx);
            selectIncidentById(hotspots[idx].id);
          }}
          className="w-full h-1 bg-[#111A26] rounded-lg appearance-none cursor-pointer accent-[#2FA8D8]"
        />
        <span className="text-[10px] text-[#2FA8D8] font-semibold whitespace-nowrap">
          {currentHotspot?.timeFormatted || '21:42 IST'}
        </span>
      </div>

      {/* Current Event Summary */}
      <div className="hidden lg:flex items-center space-x-2 text-[11px]">
        <span className="text-slate-400">TIMESTAMP REPLAY:</span>
        <span className="text-white font-semibold">{currentHotspot?.id}</span>
        <span className="text-[#E9A23B]">({currentHotspot?.frpMw} MW)</span>
      </div>
    </div>
  );
};
