import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  Crosshair,
  Factory,
  Flame,
  Send,
  Shield,
} from 'lucide-react';
import { ReasoningFlow } from '../../components/intelligence/ReasoningFlow';
import { GISMapLibre } from '../../components/map/GISMapLibre';
import { useIntelligence } from '../../context/IntelligenceContext';

/** Verdict colour, matching the severity palette used across the console. */
const VERDICT_TONE: Record<string, string> = {
  'Industrial Fire': '#F04438',
  'Forest Fire': '#FF6B35',
  'Agricultural Burning': '#E8A93A',
  'Unknown Anomaly': '#6F7E8D',
};

export const IncidentAnalysisPage: React.FC = () => {
  const { incidentId } = useParams<{ incidentId: string }>();
  const navigate = useNavigate();
  const { hotspots, selectFacilityById } = useIntelligence();

  const incident = hotspots.find((h) => h.id === incidentId) || hotspots[0];
  const [customRadius, setCustomRadius] = useState<number>(1000);

  const verdictColor = VERDICT_TONE[incident?.classification ?? ''] ?? '#6F7E8D';

  const handleFacilityClick = () => {
    selectFacilityById(incident.nearestFacilityId);
    navigate(`/facility-watch?facilityId=${incident.nearestFacilityId}`);
  };

  const handleAuthorizeAlertClick = () => {
    navigate(`/alerts?incidentId=${incident.id}&radius=${customRadius}`);
  };

  return (
    <div className="min-h-screen bg-[#05080D] p-4 space-y-4 font-sans text-[#F1F4F6]">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between border-b border-[#253340] pb-3 font-mono text-xs">
        <button
          onClick={() => navigate('/incidents')}
          className="flex items-center space-x-2 text-[#3DB7D9] hover:underline transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO INCIDENT REGISTER</span>
        </button>

        <div className="flex items-center space-x-3">
          <span className="text-[#A7B4C1]">INCIDENT ANALYSIS WORKSPACE:</span>
          <span className="font-bold text-white text-sm bg-[#081019] px-2.5 py-1 rounded border border-[#253340]">
            {incident.id}
          </span>
          <span className="px-2 py-0.5 bg-[#F04438]/20 text-[#F04438] border border-[#F04438]/40 rounded text-[10px] font-bold">
            {incident.severity} SEVERITY
          </span>
        </div>
      </div>

      {/* Verdict banner — the classifier's conclusion, stated up front */}
      <div
        className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono"
        style={{ borderColor: verdictColor, backgroundColor: `${verdictColor}14` }}
      >
        <div className="flex items-center space-x-3">
          <Flame className="w-6 h-6 shrink-0" style={{ color: verdictColor }} />
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#A7B4C1] block">
              AUTOMATED VERDICT — DERIVED FROM SURROUNDING LAND USE
            </span>
            <span className="text-lg font-bold font-sans" style={{ color: verdictColor }}>
              {incident.classification}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          <div className="text-right">
            <span className="text-[10px] text-[#A7B4C1] block uppercase">Severity</span>
            <span className="font-bold" style={{ color: verdictColor }}>{incident.severity}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-[#A7B4C1] block uppercase">Confidence</span>
            <span className="font-bold text-[#39B978]">{incident.confidence}%</span>
          </div>
          <div className="text-right max-w-[16rem]">
            <span className="text-[10px] text-[#A7B4C1] block uppercase">Nearest land use</span>
            <span className="text-white truncate block">{incident.nearestFacilityName}</span>
          </div>
        </div>
      </div>

      {/* Main 3-Column Emergency Intelligence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT COLUMN: Incident Summary / Identity (3 cols) */}
        <div className="lg:col-span-3 space-y-4 font-mono text-xs">
          <div className="bg-[#081019] border border-[#253340] rounded-xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#253340] pb-2">
              <span className="text-[10px] text-[#3DB7D9] uppercase font-bold tracking-wider">
                EVENT IDENTITY
              </span>
              <span className="text-[9px] px-1.5 py-0.5 bg-[#0D151E] text-slate-300 rounded border border-[#253340]">
                {incident.isNew ? 'MANUAL BETA TRIGGER' : 'SATELLITE VIIRS'}
              </span>
            </div>

            <div>
              <h2 className="text-base font-bold text-white font-sans">{incident.classification}</h2>
              <p className="text-xs text-[#A7B4C1] mt-0.5">{incident.locationName}</p>
            </div>

            <div className="space-y-2 border-t border-[#253340] pt-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#A7B4C1]">STATUS:</span>
                <span className="text-[#39B978] font-bold">ACTIVE RESPONSE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7B4C1]">LAT / LNG:</span>
                <span className="text-white">{incident.lat.toFixed(4)}, {incident.lng.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7B4C1]">FRP POWER:</span>
                <span className="text-[#E8A93A] font-bold">{incident.frpMw} MW</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7B4C1]">BRIGHTNESS TEMP:</span>
                <span className="text-[#3DB7D9]">{incident.brightnessK} K</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7B4C1]">CONFIDENCE:</span>
                <span className="text-[#39B978] font-bold">{incident.confidence}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7B4C1]">ACQUISITION TIME:</span>
                <span className="text-slate-300">{incident.timeFormatted}</span>
              </div>
            </div>

            {/* Nearest Facility Card */}
            <div className="p-3 bg-[#0D151E] border border-[#253340] rounded-lg space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#3DB7D9] font-bold uppercase flex items-center space-x-1">
                  <Factory className="w-3.5 h-3.5" />
                  <span>TARGET PROXIMITY</span>
                </span>
                <button
                  onClick={handleFacilityClick}
                  className="text-[#3DB7D9] hover:underline flex items-center"
                >
                  <span>Profile</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="font-bold text-white font-sans text-xs">{incident.nearestFacilityName}</div>
              <div className="flex justify-between text-[10px] text-[#A7B4C1]">
                <span>DISTANCE:</span>
                <span className="text-[#E8A93A] font-bold">
                  {Math.round(incident.facilityDistanceKm * 1000)}m ({incident.facilityDistanceKm} km)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: Large MapLibre GIS Analysis Map (6 cols ~55-65%) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#081019] border border-[#253340] rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between font-mono text-xs px-1">
              <div className="flex items-center space-x-2">
                <Crosshair className="w-4 h-4 text-[#3DB7D9]" />
                <span className="font-semibold text-white">SPATIAL RISK ANALYSIS MAP</span>
              </div>
              <div className="flex items-center space-x-2 text-[11px]">
                <span className="text-[#A7B4C1]">CUSTOM DANGER RADIUS:</span>
                <select
                  value={customRadius}
                  onChange={(e) => setCustomRadius(parseInt(e.target.value, 10))}
                  className="bg-[#0D151E] border border-[#253340] text-[#3DB7D9] rounded px-2 py-0.5 focus:outline-none"
                >
                  <option value={500}>500 m</option>
                  <option value={1000}>1,000 m (1 km)</option>
                  <option value={2000}>2,000 m (2 km)</option>
                  <option value={5000}>5,000 m (5 km)</option>
                </select>
              </div>
            </div>

            <div className="h-[480px] rounded-lg overflow-hidden border border-[#253340] relative">
              <GISMapLibre height="h-full" searchRadiusM={1000} />
            </div>
          </div>

          {/* Bottom Reasoning Flow */}
          <div className="bg-[#081019] border border-[#253340] rounded-xl p-4 font-mono">
            <ReasoningFlow
              steps={incident.reasoningSteps}
              classification={incident.classification}
              confidence={incident.confidence}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Response & Emergency Contact Prioritization (3 cols) */}
        <div className="lg:col-span-3 space-y-4 font-mono text-xs">
          <div className="bg-[#081019] border border-[#253340] rounded-xl p-4 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#253340] pb-2">
              <span className="text-[10px] text-[#3DB7D9] uppercase font-bold tracking-wider">
                EMERGENCY ESCALATION PRIORITY
              </span>
              <Shield className="w-4 h-4 text-[#3DB7D9]" />
            </div>

            <div className="space-y-2 text-[11px]">
              {/* Priority 1: Emergency Services */}
              <div className="p-2.5 bg-[#0D151E] border border-[#F04438]/40 rounded-lg space-y-1">
                <div className="flex items-center justify-between font-bold text-[#F04438]">
                  <span>PRIORITY 1: EMERGENCY SERVICES</span>
                  <span className="text-[9px] px-1 py-0.2 bg-[#F04438]/20 rounded">URGENT</span>
                </div>
                <p className="text-[#A7B4C1] text-[10px]">Police, Fire Department, Industrial Ambulance</p>
                <div className="text-white font-semibold text-[10px] pt-1">Telangana Fire Services (101)</div>
              </div>

              {/* Priority 2: Facility Operators */}
              <div className="p-2.5 bg-[#0D151E] border border-[#FF6B35]/40 rounded-lg space-y-1">
                <div className="flex items-center justify-between font-bold text-[#FF6B35]">
                  <span>PRIORITY 2: FACILITY OPERATORS</span>
                  <span className="text-[9px] px-1 py-0.2 bg-[#FF6B35]/20 rounded">DIRECT</span>
                </div>
                <p className="text-[#A7B4C1] text-[10px]">Plant Safety Officers & Storage Tank Managers</p>
                <div className="text-white font-semibold text-[10px] pt-1">TSIIC Industrial Safety Desk</div>
              </div>

              {/* Priority 3: Opted-in Users */}
              <div className="p-2.5 bg-[#0D151E] border border-[#253340] rounded-lg space-y-1">
                <div className="flex items-center justify-between font-bold text-[#3DB7D9]">
                  <span>PRIORITY 3: OPTED-IN RESIDENTS</span>
                  <span className="text-[9px] px-1 py-0.2 bg-[#3DB7D9]/20 rounded">47 USERS</span>
                </div>
                <p className="text-[#A7B4C1] text-[10px]">Registered residents inside 1.0 km danger radius</p>
              </div>
            </div>

            {/* Authorize Alert CTA */}
            <button
              onClick={handleAuthorizeAlertClick}
              className="w-full py-3 px-4 bg-[#F04438] hover:bg-[#FF6B35] text-white font-bold rounded text-xs shadow-xl transition flex items-center justify-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>AUTHORIZE EMERGENCY ALERT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
