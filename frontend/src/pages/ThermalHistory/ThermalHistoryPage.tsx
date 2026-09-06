import React from 'react';
import { History } from 'lucide-react';
import { GISMapLibre } from '../../components/map/GISMapLibre';
import { MapLegend } from '../../components/map/MapLegend';
import { TimeScrubber } from '../../components/timeline/TimeScrubber';
import { useIntelligence } from '../../context/IntelligenceContext';

export const ThermalHistoryPage: React.FC = () => {
  const { selectedIncident } = useIntelligence();

  return (
    <div className="h-[calc(100vh-5.75rem)] w-full flex flex-col bg-[#050A12] p-2 space-y-2 overflow-hidden font-sans text-[#F5F7FA]">
      {/* Page Title Bar */}
      <div className="flex items-center justify-between bg-[#07101B] border border-[#203246] rounded-lg p-3 font-mono text-xs shrink-0">
        <div className="flex items-center space-x-2">
          <History className="w-5 h-5 text-[#16A9D9]" />
          <div>
            <h1 className="font-semibold text-sm text-white tracking-wide">THERMAL HISTORY REPLAY</h1>
            <p className="text-[10px] text-[#A7B4C5]">REPLAY THERMAL EVOLUTION OVER PAST 180 DAYS</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-[#A7B4C5]">PATTERN INTERPRETATION:</span>
          <span className="px-2.5 py-1 bg-[#FFB020]/20 border border-[#FFB020]/40 text-[#FFB020] font-bold rounded">
            SUDDEN ANOMALY
          </span>
        </div>
      </div>

      {/* Main Map Replay Body */}
      <div className="flex-1 relative rounded-lg overflow-hidden border border-[#203246] min-h-0">
        <GISMapLibre height="h-full" />
        <MapLegend />

        {/* Floating Historical Pattern Card */}
        <div className="absolute top-4 left-4 z-[1000] p-3 bg-[#07101B]/95 border border-[#203246] rounded-lg backdrop-blur-md w-72 space-y-2 font-mono text-xs shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#203246] pb-1.5">
            <span className="font-semibold text-[#16A9D9]">HISTORICAL METRICS</span>
            <span className="text-[10px] text-slate-500">180-DAY LOOKBACK</span>
          </div>
          <div className="space-y-1 text-slate-300 text-[11px]">
            <div className="flex justify-between">
              <span>Historical Occurrences:</span>
              <strong className="text-white">{selectedIncident?.historicalOccurrenceCount || 0}</strong>
            </div>
            <div className="flex justify-between">
              <span>First Seen Date:</span>
              <strong className="text-slate-200">{selectedIncident?.firstSeenDate || '2026-08-27'}</strong>
            </div>
            <div className="flex justify-between">
              <span>Peak Recorded FRP:</span>
              <strong className="text-[#FFB020]">{selectedIncident?.frpMw || 184.6} MW</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Temporal Timeline Scrubber */}
      <TimeScrubber />
    </div>
  );
};
