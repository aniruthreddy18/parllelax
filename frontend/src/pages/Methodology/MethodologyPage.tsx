import React from 'react';
import { BookOpen, CheckCircle2, ShieldAlert } from 'lucide-react';

export const MethodologyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#05080D] p-4 sm:p-8 space-y-8 font-sans text-[#F1F4F6] max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-[#253340] pb-6 space-y-2">
        <div className="flex items-center space-x-2 font-mono text-xs text-[#3DB7D9] uppercase tracking-wider font-semibold">
          <BookOpen className="w-4 h-4" />
          <span>TECHNICAL DOCUMENTATION</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          FireWatch AI Classification & Decision Methodology
        </h1>
        <p className="text-sm text-[#A7B4C1] max-w-2xl leading-relaxed">
          Detailed technical specification of VIIRS 375m thermal anomaly ingestion, GIS spatial overlays, 180-day temporal baseline evaluation, and deterministic Beta classification logic.
        </p>
      </div>

      {/* Beta Classifier Explanation */}
      <div className="p-6 bg-[#081019] border border-[#253340] rounded-xl space-y-4 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-[#253340] pb-2">
          <span className="font-semibold text-white text-sm uppercase tracking-wider">
            BETA RULE-BASED DECISION TREE
          </span>
          <span className="text-xs text-[#3DB7D9]">DETERMINISTIC & EXPLAINABLE</span>
        </div>

        <p className="text-[#A7B4C1] font-sans text-xs leading-relaxed">
          The current Beta classifier operates on strict explainable spatial and temporal rules rather than opaque black-box machine learning models.
        </p>

        <div className="space-y-3 font-sans text-xs">
          <div className="p-3 bg-[#0D151E] border border-[#253340] rounded-lg">
            <span className="font-mono text-xs font-bold text-[#3DB7D9] block">RULE 01: ROUTINE INDUSTRIAL FLARE</span>
            <p className="text-[#A7B4C1] mt-1">
              If hotspot coordinates intersect a registered industrial facility boundary AND historical recurrence count &gt; 5 within 180 days AND current FRP &lt; 3x facility baseline &rarr; Classify as <strong>Routine Flare</strong>.
            </p>
          </div>

          <div className="p-3 bg-[#0D151E] border border-[#253340] rounded-lg">
            <span className="font-mono text-xs font-bold text-[#F04438] block">RULE 02: SUSPECTED INDUSTRIAL FIRE</span>
            <p className="text-[#A7B4C1] mt-1">
              If hotspot coordinates intersect an industrial zone AND current FRP exceeds 50 MW AND (first-time detection OR FRP &gt; 5x baseline) &rarr; Classify as <strong>Industrial Fire (High Severity)</strong>.
            </p>
          </div>

          <div className="p-3 bg-[#0D151E] border border-[#253340] rounded-lg">
            <span className="font-mono text-xs font-bold text-[#FF6B35] block">RULE 03: FOREST FIRE</span>
            <p className="text-[#A7B4C1] mt-1">
              If hotspot land cover classification equals Forest/Vegetation AND distance to nearest industrial facility &gt; 2,000 meters &rarr; Classify as <strong>Forest Fire</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Future Roadmap Note */}
      <div className="p-6 bg-[#081019] border border-[#253340] rounded-xl space-y-3 font-mono text-xs">
        <div className="flex items-center space-x-2 text-[#E8A93A] font-semibold text-sm">
          <ShieldAlert className="w-4 h-4" />
          <span>FUTURE EXPANSION ROADMAP</span>
        </div>
        <div className="space-y-1.5 text-[#A7B4C1] font-sans text-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#39B978]" />
            <span>Direct NASA FIRMS REST API ingestion pipeline integration.</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#39B978]" />
            <span>Sentinel-2 MSI 10m high-resolution optical validation overlays.</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#39B978]" />
            <span>Temporal LSTM neural anomaly prediction for early flare deviation detection.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
