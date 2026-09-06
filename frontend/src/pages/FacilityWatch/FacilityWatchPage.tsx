import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Factory } from 'lucide-react';
import { GISMapLibre } from '../../components/map/GISMapLibre';
import { useIntelligence } from '../../context/IntelligenceContext';

export const FacilityWatchPage: React.FC = () => {
  const { facilities, selectedFacility, setSelectedFacility, selectFacilityById } = useIntelligence();
  const [searchParams] = useSearchParams();
  const facilityParamId = searchParams.get('facilityId');

  React.useEffect(() => {
    if (facilityParamId) {
      selectFacilityById(facilityParamId);
    }
  }, [facilityParamId, selectFacilityById]);

  const activeFac = selectedFacility || facilities[0];

  return (
    <div className="min-h-screen bg-[#050A12] p-4 sm:p-6 space-y-6 font-sans text-[#F5F7FA]">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-[#203246] pb-4 font-mono">
        <div>
          <div className="flex items-center space-x-2">
            <Factory className="w-6 h-6 text-[#16A9D9]" />
            <h1 className="text-2xl font-semibold text-white tracking-wide">
              FACILITY WATCH
            </h1>
          </div>
          <p className="text-xs text-[#A7B4C5] mt-1">
            CRITICAL INDUSTRIAL INFRASTRUCTURE THERMAL MONITORING
          </p>
        </div>

        <div className="text-xs font-mono text-[#16A9D9] bg-[#07101B] px-3 py-1.5 border border-[#203246] rounded">
          MONITORING {facilities.length} ASSETS IN GUJARAT
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Facilities List (4 cols) */}
        <div className="lg:col-span-4 bg-[#07101B] border border-[#203246] rounded-xl p-4 space-y-3 max-h-[700px] overflow-y-auto font-mono text-xs">
          <span className="text-xs font-semibold text-[#16A9D9] uppercase tracking-wider block border-b border-[#203246] pb-2">
            INDUSTRIAL ASSETS REGISTRY
          </span>

          <div className="space-y-2">
            {facilities.map((fac) => {
              const isSelected = activeFac.id === fac.id;
              return (
                <div
                  key={fac.id}
                  onClick={() => setSelectedFacility(fac)}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    isSelected
                      ? 'bg-[#0B1420] border-[#16A9D9]'
                      : 'bg-[#050A12] border-[#203246] hover:border-[#287FB1]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#16A9D9]">{fac.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        fac.status === 'ANOMALY_DETECTED'
                          ? 'bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/40'
                          : fac.status === 'ELEVATED'
                          ? 'bg-[#FFB020]/20 text-[#FFB020]'
                          : 'bg-[#28C76F]/20 text-[#28C76F]'
                      }`}
                    >
                      {fac.status}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#A7B4C5] mt-1 truncate">{fac.location}</p>

                  <div className="flex justify-between items-center text-[10px] text-slate-300 pt-2 border-t border-[#203246] mt-2">
                    <span>Baseline: {fac.baselineFRP} MW</span>
                    <span className="font-bold text-[#FFB020]">Current: {fac.currentFRP} MW</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Profile & MapLibre map (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="p-5 bg-[#07101B] border border-[#203246] rounded-xl space-y-4 font-mono text-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#203246] pb-3">
              <div>
                <span className="text-[10px] text-[#16A9D9] uppercase tracking-widest block font-bold">
                  {activeFac.type} &mdash; {activeFac.id}
                </span>
                <h2 className="text-xl font-semibold text-white tracking-wide">{activeFac.name}</h2>
              </div>
              <span
                className={`px-3 py-1 rounded text-xs font-bold ${
                  activeFac.status === 'ANOMALY_DETECTED'
                    ? 'bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/50'
                    : 'bg-[#28C76F]/20 text-[#28C76F]'
                }`}
              >
                STATUS: {activeFac.status}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 bg-[#050A12] border border-[#203246] rounded">
                <span className="text-[9px] text-[#A7B4C5] block uppercase">BASELINE FRP</span>
                <span className="text-sm font-bold text-[#16A9D9]">{activeFac.baselineFRP} MW</span>
              </div>
              <div className="p-2.5 bg-[#050A12] border border-[#203246] rounded">
                <span className="text-[9px] text-[#A7B4C5] block uppercase">CURRENT FRP</span>
                <span className="text-sm font-bold text-[#FFB020]">{activeFac.currentFRP} MW</span>
              </div>
              <div className="p-2.5 bg-[#050A12] border border-[#203246] rounded">
                <span className="text-[9px] text-[#A7B4C5] block uppercase">RISK RADIUS</span>
                <span className="text-sm font-bold text-[#28C76F]">{activeFac.riskBufferRadiusKm} KM</span>
              </div>
              <div className="p-2.5 bg-[#050A12] border border-[#203246] rounded">
                <span className="text-[9px] text-[#A7B4C5] block uppercase">EMERGENCY CONTACT</span>
                <span className="text-xs font-bold text-slate-200">{activeFac.emergencyContact}</span>
              </div>
            </div>
          </div>

          <div className="h-[400px] rounded-xl overflow-hidden border border-[#203246] relative shadow-2xl">
            <GISMapLibre height="h-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
