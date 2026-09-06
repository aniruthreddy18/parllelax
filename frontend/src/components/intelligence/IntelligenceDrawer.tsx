import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Factory,
  History,
  X,
} from 'lucide-react';
import { useIntelligence } from '../../context/IntelligenceContext';
import { ReasoningFlow } from './ReasoningFlow';

export const IntelligenceDrawer: React.FC = () => {
  const { selectedIncident, isDrawerOpen, setIsDrawerOpen, selectFacilityById } =
    useIntelligence();
  const navigate = useNavigate();

  if (!isDrawerOpen || !selectedIncident) return null;

  const handleFacilityClick = () => {
    selectFacilityById(selectedIncident.nearestFacilityId);
    navigate(`/facility-watch?facilityId=${selectedIncident.nearestFacilityId}`);
  };

  const handleHistoryClick = () => {
    navigate(`/thermal-history?incidentId=${selectedIncident.id}`);
  };

  const handleInvestigateClick = () => {
    navigate(`/incidents/${selectedIncident.id}`);
  };

  return (
    <div className="w-full lg:w-[360px] bg-[#081019] border border-[#253340] rounded-lg p-4 flex flex-col space-y-4 shrink-0 shadow-2xl overflow-y-auto max-h-full font-sans text-xs text-slate-100 z-30">
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-[#253340] pb-2 font-mono">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-[#3DB7D9] text-sm">{selectedIncident.id}</span>
          <span
            className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
              selectedIncident.severity === 'HIGH' || selectedIncident.severity === 'CRITICAL'
                ? 'bg-[#F04438]/20 text-[#F04438] border border-[#F04438]/40'
                : 'bg-[#E8A93A]/20 text-[#E8A93A] border border-[#E8A93A]/40'
            }`}
          >
            {selectedIncident.severity} Priority
          </span>
        </div>
        <button
          onClick={() => setIsDrawerOpen(false)}
          className="p-1 rounded text-[#A7B4C1] hover:text-white hover:bg-[#0D151E] transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Incident Title & Classification */}
      <div className="space-y-1 font-mono">
        <span className="text-[10px] text-[#A7B4C1] uppercase tracking-wider block">
          SELECTED OBSERVATION
        </span>
        <h2 className="text-base font-semibold text-white tracking-wide font-sans">
          {selectedIncident.classification}
        </h2>
        <p className="text-xs text-[#A7B4C1]">{selectedIncident.locationName}</p>
      </div>

      {/* Telemetry Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 font-mono text-xs">
        <div className="p-2 bg-[#0D151E] border border-[#253340] rounded">
          <span className="text-[9px] text-[#A7B4C1] block uppercase">FRP RADIATIVE POWER</span>
          <span className="text-sm font-bold text-[#E8A93A]">{selectedIncident.frpMw} MW</span>
        </div>
        <div className="p-2 bg-[#0D151E] border border-[#253340] rounded">
          <span className="text-[9px] text-[#A7B4C1] block uppercase">BRIGHTNESS TEMP</span>
          <span className="text-sm font-bold text-[#3DB7D9]">{selectedIncident.brightnessK} K</span>
        </div>
        <div className="p-2 bg-[#0D151E] border border-[#253340] rounded">
          <span className="text-[9px] text-[#A7B4C1] block uppercase">VIIRS CONFIDENCE</span>
          <span className="text-sm font-bold text-[#39B978]">{selectedIncident.confidence}%</span>
        </div>
        <div className="p-2 bg-[#0D151E] border border-[#253340] rounded">
          <span className="text-[9px] text-[#A7B4C1] block uppercase">FACILITY DISTANCE</span>
          <span className="text-xs font-bold text-white">
            {Math.round(selectedIncident.facilityDistanceKm * 1000)}m
          </span>
        </div>
      </div>

      {/* Nearest Facility Proximity Card */}
      <div className="p-3 bg-[#0D151E] border border-[#253340] rounded-lg space-y-2 font-mono text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#3DB7D9] font-semibold uppercase tracking-wider flex items-center space-x-1">
            <Factory className="w-3.5 h-3.5" />
            <span>NEAREST FACILITY</span>
          </span>
          <button
            onClick={handleFacilityClick}
            className="text-[10px] text-[#3DB7D9] hover:underline flex items-center space-x-0.5"
          >
            <span>View Facility</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="font-semibold text-white font-sans text-sm">{selectedIncident.nearestFacilityName}</div>
        <div className="flex justify-between text-[11px] text-[#A7B4C1] pt-1 border-t border-[#253340]">
          <span>PROXIMITY DISTANCE</span>
          <span className="text-[#E8A93A] font-bold">
            {selectedIncident.facilityDistanceKm} km ({Math.round(selectedIncident.facilityDistanceKm * 1000)}m)
          </span>
        </div>
      </div>

      {/* Why This Was Flagged / Explainable Reasoning */}
      <ReasoningFlow
        steps={selectedIncident.reasoningSteps}
        classification={selectedIncident.classification}
        confidence={selectedIncident.confidence}
      />

      {/* Recommended Action */}
      <div className="p-3 bg-[#F04438]/10 border border-[#F04438]/30 rounded-lg space-y-1 text-xs font-mono">
        <div className="flex items-center space-x-1.5 text-[#F04438] font-semibold text-[11px] uppercase">
          <AlertTriangle className="w-4 h-4" />
          <span>RECOMMENDED ACTION</span>
        </div>
        <p className="text-slate-200 text-xs leading-relaxed font-sans">
          {selectedIncident.suggestedAction}
        </p>
      </div>

      {/* Quick Action Navigation CTAs */}
      <div className="space-y-2 pt-2 border-t border-[#253340] font-mono">
        <button
          onClick={handleInvestigateClick}
          className="w-full py-2 px-3 bg-[#3DB7D9] hover:bg-[#287FB1] text-[#05080D] font-semibold text-xs rounded transition flex items-center justify-center space-x-2 shadow"
        >
          <span>INVESTIGATE INCIDENT</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleHistoryClick}
            className="py-1.5 px-2 bg-[#0D151E] hover:bg-[#111B25] border border-[#253340] text-slate-200 text-xs rounded transition flex items-center justify-center space-x-1"
          >
            <History className="w-3.5 h-3.5" />
            <span>Thermal History</span>
          </button>

          <button
            onClick={handleFacilityClick}
            className="py-1.5 px-2 bg-[#0D151E] hover:bg-[#111B25] border border-[#253340] text-slate-200 text-xs rounded transition flex items-center justify-center space-x-1"
          >
            <Factory className="w-3.5 h-3.5" />
            <span>Facility Watch</span>
          </button>
        </div>
      </div>
    </div>
  );
};
