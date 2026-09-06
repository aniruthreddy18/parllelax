import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  Flame,
  Globe2,
  Info,
  Layers,
  Radar,
  Shield,
} from 'lucide-react';

export const MissionBriefPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#05080D] p-4 sm:p-8 space-y-8 font-sans text-[#F1F4F6] max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-[#253340] pb-6 space-y-2">
        <div className="flex items-center space-x-2 font-mono text-xs text-[#3DB7D9] uppercase tracking-wider font-semibold">
          <Info className="w-4 h-4" />
          <span>OPERATIONAL MISSION BRIEF</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          FireWatch AI Mission & Classification Philosophy
        </h1>
        <p className="text-sm text-[#A7B4C1] max-w-3xl leading-relaxed">
          Satellite thermal observations are combined with industrial GIS context, land cover and historical activity to determine whether a thermal anomaly is routine or potentially dangerous.
        </p>
      </div>

      {/* Core Workflow Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
        <div className="p-4 bg-[#081019] border border-[#253340] rounded-lg space-y-2">
          <Radar className="w-5 h-5 text-[#3DB7D9]" />
          <h3 className="font-semibold text-white text-sm">1. SATELLITE DETECTION</h3>
          <p className="text-[#A7B4C1] font-sans text-xs leading-relaxed">
            VIIRS 375m sensor detects thermal anomalies and computes Fire Radiative Power (FRP MW) & brightness temperature.
          </p>
        </div>

        <div className="p-4 bg-[#081019] border border-[#253340] rounded-lg space-y-2">
          <Layers className="w-5 h-5 text-[#3DB7D9]" />
          <h3 className="font-semibold text-white text-sm">2. GEOSPATIAL CONTEXT</h3>
          <p className="text-[#A7B4C1] font-sans text-xs leading-relaxed">
            Spatial overlay against industrial complexes, refineries, chemical plants, power stations, and land cover types.
          </p>
        </div>

        <div className="p-4 bg-[#081019] border border-[#253340] rounded-lg space-y-2">
          <Database className="w-5 h-5 text-[#3DB7D9]" />
          <h3 className="font-semibold text-white text-sm">3. HISTORICAL PATTERN</h3>
          <p className="text-[#A7B4C1] font-sans text-xs leading-relaxed">
            180-day historical recurrence check to distinguish routine industrial flares from new unannounced thermal events.
          </p>
        </div>

        <div className="p-4 bg-[#081019] border border-[#253340] rounded-lg space-y-2">
          <Cpu className="w-5 h-5 text-[#3DB7D9]" />
          <h3 className="font-semibold text-white text-sm">4. RULE CLASSIFICATION</h3>
          <p className="text-[#A7B4C1] font-sans text-xs leading-relaxed">
            Deterministic Beta decision tree evaluating spatial intersection, baseline FRP thresholds, and severity scoring.
          </p>
        </div>
      </div>

      {/* Recognized Classifications Section */}
      <div className="p-6 bg-[#081019] border border-[#253340] rounded-xl space-y-4 font-mono text-xs">
        <h2 className="text-base font-semibold text-white border-b border-[#253340] pb-2 uppercase tracking-wider">
          RECOGNIZED THERMAL CLASSIFICATIONS
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans text-xs">
          <div className="p-3 bg-[#0D151E] border border-[#253340] rounded-lg space-y-1">
            <div className="flex items-center space-x-2 text-[#F04438] font-semibold font-mono text-sm">
              <Flame className="w-4 h-4" />
              <span>Suspected Industrial Fire</span>
            </div>
            <p className="text-[#A7B4C1] leading-relaxed">
              High FRP thermal detection intersecting industrial boundary with no recurring baseline pattern or exceeding baseline threshold by &gt;500%.
            </p>
          </div>

          <div className="p-3 bg-[#0D151E] border border-[#253340] rounded-lg space-y-1">
            <div className="flex items-center space-x-2 text-[#FF6B35] font-semibold font-mono text-sm">
              <Flame className="w-4 h-4" />
              <span>Routine Gas Flare</span>
            </div>
            <p className="text-[#A7B4C1] leading-relaxed">
              Expected operational thermal dissipation at registered refinery or chemical stack within historical baseline limits.
            </p>
          </div>

          <div className="p-3 bg-[#0D151E] border border-[#253340] rounded-lg space-y-1">
            <div className="flex items-center space-x-2 text-[#FF6B35] font-semibold font-mono text-sm">
              <Shield className="w-4 h-4" />
              <span>Forest Fire</span>
            </div>
            <p className="text-[#A7B4C1] leading-relaxed">
              Thermal anomaly located over forested or protected vegetation land cover outside designated industrial sectors.
            </p>
          </div>

          <div className="p-3 bg-[#0D151E] border border-[#253340] rounded-lg space-y-1">
            <div className="flex items-center space-x-2 text-[#E8A93A] font-semibold font-mono text-sm">
              <Globe2 className="w-4 h-4" />
              <span>Agricultural Burning</span>
            </div>
            <p className="text-[#A7B4C1] leading-relaxed">
              Seasonal crop residue burning detected over agricultural land cover zones.
            </p>
          </div>
        </div>
      </div>

      {/* Analyst Action Checklist */}
      <div className="p-6 bg-[#081019] border border-[#253340] rounded-xl space-y-4 font-mono text-xs">
        <h2 className="text-base font-semibold text-white border-b border-[#253340] pb-2 uppercase tracking-wider">
          WHAT AN ANALYST CAN DO
        </h2>

        <div className="space-y-2 text-[#A7B4C1] font-sans text-xs">
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#39B978] shrink-0 mt-0.5" />
            <span>Investigate high-priority thermal events in the Hyderabad Industrial Corridor using MapLibre vector maps & 500m risk buffer rings.</span>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#39B978] shrink-0 mt-0.5" />
            <span>Cross-reference historical FRP trends against industrial asset baseline levels in Facility Watch.</span>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#39B978] shrink-0 mt-0.5" />
            <span>Inspect 5-stage explainable rule reasoning chains explaining why an anomaly was flagged.</span>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={() => navigate('/command-center')}
            className="py-2.5 px-5 bg-[#3DB7D9] hover:bg-[#287FB1] text-[#05080D] font-semibold rounded text-xs transition inline-flex items-center space-x-2"
          >
            <span>LAUNCH COMMAND CENTER</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
