import React from 'react';
import { Activity } from 'lucide-react';
import { useIntelligence } from '../../context/IntelligenceContext';
import type { EventClassification } from '../../types';

export const SituationRail: React.FC = () => {
  const { metrics, filteredHotspots, selectedIncident, selectIncidentById, filters, setFilters } = useIntelligence();

  const EVENT_TYPES: EventClassification[] = [
    'Industrial Fire',
    'Routine Flare',
    'Forest Fire',
    'Agricultural Burning',
    'Unknown Anomaly',
  ];

  return (
    <div className="w-full lg:w-60 bg-[#081019] border border-[#253340] rounded-lg p-3 flex flex-col space-y-4 shrink-0 overflow-y-auto max-h-full font-mono text-xs shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#253340] pb-2">
        <div className="flex items-center space-x-2">
          <Activity className="w-3.5 h-3.5 text-[#3DB7D9]" />
          <span className="font-semibold text-slate-100 uppercase tracking-wider text-[11px]">
            LIVE SITUATION
          </span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 bg-[#0D151E] text-slate-300 border border-[#253340] rounded">
          GUJARAT
        </span>
      </div>

      {/* Dynamic KPI Cards */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setFilters((prev) => ({ ...prev, severity: 'ALL' }))}
          className={`p-2 rounded border text-left transition ${
            filters.severity === 'ALL'
              ? 'bg-[#0D151E] border-[#3DB7D9]/50'
              : 'bg-[#0D151E]/50 border-[#253340] hover:border-[#304150]'
          }`}
        >
          <span className="text-[9px] text-[#A7B4C1] uppercase block font-semibold">DETECTIONS</span>
          <span className="text-lg font-bold text-[#3DB7D9]">{metrics.totalDetected}</span>
        </button>

        <button
          onClick={() => setFilters((prev) => ({ ...prev, severity: 'HIGH' }))}
          className={`p-2 rounded border text-left transition ${
            filters.severity === 'HIGH'
              ? 'bg-[#F04438]/15 border-[#F04438]/50'
              : 'bg-[#0D151E]/50 border-[#253340] hover:border-[#F04438]/30'
          }`}
        >
          <span className="text-[9px] text-[#F04438] uppercase font-semibold block">HIGH</span>
          <span className="text-lg font-bold text-[#F04438]">{metrics.highPriorityCount}</span>
        </button>

        <button
          onClick={() => setFilters((prev) => ({ ...prev, severity: 'MEDIUM' }))}
          className={`p-2 rounded border text-left transition ${
            filters.severity === 'MEDIUM'
              ? 'bg-[#E8A93A]/15 border-[#E8A93A]/50'
              : 'bg-[#0D151E]/50 border-[#253340] hover:border-[#E8A93A]/30'
          }`}
        >
          <span className="text-[9px] text-[#E8A93A] uppercase font-semibold block">MEDIUM</span>
          <span className="text-base font-bold text-[#E8A93A]">{metrics.mediumPriorityCount}</span>
        </button>

        <button
          onClick={() => setFilters((prev) => ({ ...prev, severity: 'LOW' }))}
          className={`p-2 rounded border text-left transition ${
            filters.severity === 'LOW'
              ? 'bg-[#39B978]/15 border-[#39B978]/50'
              : 'bg-[#0D151E]/50 border-[#253340] hover:border-[#39B978]/30'
          }`}
        >
          <span className="text-[9px] text-[#39B978] uppercase font-semibold block">LOW</span>
          <span className="text-base font-bold text-[#39B978]">{metrics.lowPriorityCount}</span>
        </button>
      </div>

      {/* Event Mix Distribution */}
      <div className="space-y-2 border-t border-[#253340] pt-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-200 font-semibold uppercase">EVENT MIX</span>
          <span className="text-[#6F7E8D] text-[10px]">Ratio</span>
        </div>

        <div className="space-y-1.5 text-xs">
          {EVENT_TYPES.map((type) => {
            const count = metrics.eventMix[type] || 0;
            const pct = metrics.totalDetected > 0 ? Math.round((count / metrics.totalDetected) * 100) : 0;
            const isFilterActive = filters.eventType === type;

            return (
              <div
                key={type}
                onClick={() => setFilters((prev) => ({ ...prev, eventType: isFilterActive ? 'ALL' : type }))}
                className={`p-1.5 rounded cursor-pointer transition border ${
                  isFilterActive
                    ? 'bg-[#0D151E] border-[#3DB7D9]/50'
                    : 'bg-[#0D151E]/40 hover:bg-[#0D151E] border-transparent'
                }`}
              >
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-300">{type}</span>
                  <span className="text-[#3DB7D9] font-bold">{count} ({pct}%)</span>
                </div>
                <div className="w-full h-1 bg-[#05080D] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      type === 'Industrial Fire'
                        ? 'bg-[#F04438]'
                        : type === 'Routine Flare'
                        ? 'bg-[#FF6B35]'
                        : type === 'Forest Fire'
                        ? 'bg-[#FF6B35]'
                        : type === 'Agricultural Burning'
                        ? 'bg-[#E8A93A]'
                        : 'bg-slate-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Latest Detections Ticker */}
      <div className="border-t border-[#253340] pt-3 space-y-2 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-200 font-semibold uppercase">RECENT DETECTIONS</span>
          <span className="text-[10px] text-[#39B978]">● LIVE</span>
        </div>

        <div className="space-y-1.5">
          {filteredHotspots.slice(0, 4).map((hotspot) => {
            const isSelected = selectedIncident?.id === hotspot.id;
            return (
              <div
                key={hotspot.id}
                onClick={() => selectIncidentById(hotspot.id)}
                className={`p-2 rounded border cursor-pointer transition ${
                  isSelected
                    ? 'bg-[#0D151E] border-[#3DB7D9]'
                    : 'bg-[#0D151E]/50 border-[#253340] hover:border-[#304150]'
                }`}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-[#3DB7D9]">{hotspot.id}</span>
                  <span className="text-[#A7B4C1]">{hotspot.timeFormatted}</span>
                </div>
                <div className="text-[11px] font-medium text-white truncate mt-0.5 font-sans">
                  {hotspot.classification}
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                  <span>FRP: {hotspot.frpMw} MW</span>
                  <span
                    className={`px-1.5 py-0.2 rounded font-semibold ${
                      hotspot.severity === 'HIGH' ? 'bg-[#F04438]/20 text-[#F04438]' : 'bg-[#E8A93A]/20 text-[#E8A93A]'
                    }`}
                  >
                    {hotspot.severity}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
