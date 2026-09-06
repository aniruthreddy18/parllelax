import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Crosshair,
  Loader2,
  PhoneCall,
  Send,
  Shield,
  Users,
} from 'lucide-react';
import { GISMapLibre } from '../../components/map/GISMapLibre';
import { useIntelligence } from '../../context/IntelligenceContext';
import { useApiResource } from '../../hooks/useApiResource';
import { fetchRiskAnalysis } from '../../services/firewatchApi';
import type { RiskAnalysisDTO } from '../../services/types';
import { maskPhoneNumber } from '../../utils/geo';

export const RiskImpactPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedIncident, connectionStatus } = useIntelligence();
  const [radiusMeters, setRadiusMeters] = useState<number>(1000);

  const incidentId = selectedIncident?.id ?? null;

  // POST /api/incidents/{id}/risk-analysis — re-runs whenever the incident or radius changes.
  const loader = useCallback(
    (signal: AbortSignal) =>
      incidentId
        ? fetchRiskAnalysis(incidentId, radiusMeters, signal)
        : Promise.reject(new Error('No incident selected')),
    [incidentId, radiusMeters],
  );
  const { data, isLoading, error } = useApiResource<RiskAnalysisDTO>(incidentId ? loader : null);

  const affectedUsers = data?.affected_users ?? [];
  const emergencyServices = data?.emergency_services ?? [];

  const handleAuthorizeAlert = () => {
    if (!incidentId) return;
    navigate(`/alerts?incidentId=${encodeURIComponent(incidentId)}&radius=${radiusMeters}`);
  };

  return (
    <div className="min-h-screen bg-[#05080D] p-4 sm:p-6 space-y-6 font-sans text-[#F1F4F6]">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#253340] pb-4 font-mono">
        <div>
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-[#3DB7D9]" />
            <h1 className="text-xl font-semibold text-white tracking-wide">
              SPATIAL RISK & POPULATION IMPACT WORKSPACE
            </h1>
          </div>
          <p className="text-xs text-[#A7B4C1] mt-1">
            LIVE RADIUS QUERY VIA <span className="text-[#3DB7D9]">POST /api/incidents/{'{id}'}/risk-analysis</span>
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <span className="text-[#A7B4C1]">DANGER RADIUS:</span>
          <select
            value={radiusMeters}
            onChange={(e) => setRadiusMeters(parseInt(e.target.value, 10))}
            className="bg-[#081019] border border-[#253340] text-[#3DB7D9] font-bold rounded px-3 py-1 focus:outline-none"
          >
            <option value={500}>500 Meters (Critical Zone)</option>
            <option value={1000}>1,000 Meters (1 km Radius)</option>
            <option value={2000}>2,000 Meters (2 km Radius)</option>
            <option value={5000}>5,000 Meters (5 km Sector)</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#F04438]/10 border border-[#F04438]/40 rounded-lg font-mono text-xs text-[#F04438] flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-bold block">SPATIAL QUERY FAILED</span>
            <span className="text-[11px] text-[#FFB3AC]">{error}</span>
            {connectionStatus === 'offline' && (
              <span className="text-[11px] text-[#A7B4C1] block mt-1">
                The incident feed is also offline — start the FastAPI backend on port 8000 and retry.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left GIS Map View (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#081019] border border-[#253340] rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between font-mono text-xs px-1">
              <span className="font-semibold text-white flex items-center space-x-1.5">
                <Crosshair className="w-4 h-4 text-[#3DB7D9]" />
                <span>SPATIAL DANGER BUFFER MAP ({data?.radius_meters ?? radiusMeters}m RADIUS)</span>
              </span>
              <span className="text-[#E8A93A] font-bold">INCIDENT: {incidentId ?? 'NONE SELECTED'}</span>
            </div>

            <div className="h-[460px] rounded-lg overflow-hidden border border-[#253340] relative">
              <GISMapLibre height="h-full" />
            </div>
          </div>

          {/* Quick Summary Bar */}
          <div className="grid grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3 bg-[#081019] border border-[#253340] rounded-lg">
              <span className="text-[10px] text-[#A7B4C1] block uppercase">OPTED-IN USERS</span>
              <span className="text-xl font-bold text-[#3DB7D9]">
                {isLoading ? '…' : data?.affected_users_count ?? 0}
              </span>
              <span className="text-[10px] text-[#39B978] block">Opted-in for Alerts</span>
            </div>
            <div className="p-3 bg-[#081019] border border-[#253340] rounded-lg">
              <span className="text-[10px] text-[#A7B4C1] block uppercase">EMERGENCY SERVICES</span>
              <span className="text-xl font-bold text-[#F04438]">
                {isLoading ? '…' : data?.emergency_services_count ?? 0}
              </span>
              <span className="text-[10px] text-[#A7B4C1] block">Prioritized Units</span>
            </div>
            <div className="p-3 bg-[#081019] border border-[#253340] rounded-lg">
              <span className="text-[10px] text-[#A7B4C1] block uppercase">NEAREST ASSET</span>
              <span className="text-xl font-bold text-[#E8A93A]">
                {selectedIncident ? `${selectedIncident.facilityDistanceKm} km` : '—'}
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                {selectedIncident?.nearestFacilityName ?? '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Impact Inspector (5 cols) */}
        <div className="lg:col-span-5 space-y-4 font-mono text-xs">
          {/* Affected Users Panel */}
          <div className="bg-[#081019] border border-[#253340] rounded-xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#253340] pb-2">
              <span className="font-bold text-[#3DB7D9] uppercase flex items-center space-x-1.5">
                <Users className="w-4 h-4" />
                <span>OPTED-IN RESIDENTS IN DANGER ZONE</span>
              </span>
              <span className="text-[10px] text-[#39B978] flex items-center space-x-1">
                {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>{isLoading ? 'QUERYING' : 'API VERIFIED'}</span>
              </span>
            </div>

            <div className="space-y-2">
              {affectedUsers.map((user) => (
                <div key={user.id} className="p-2.5 bg-[#0D151E] border border-[#253340] rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white text-xs">{user.name}</div>
                    {/* Contact details are masked in the UI per docs/DECISIONS.md §4. */}
                    <div className="text-[10px] text-[#A7B4C1]">{maskPhoneNumber(user.phone)}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[#E8A93A] font-bold block">{Math.round(user.distance_meters)}m</span>
                    <span className="text-[9px] px-1.5 py-0.2 bg-[#39B978]/20 text-[#39B978] rounded">
                      {user.opt_in ? 'OPTED-IN' : 'OPTED-OUT'}
                    </span>
                  </div>
                </div>
              ))}

              {!isLoading && affectedUsers.length === 0 && (
                <p className="text-[#66768A] italic text-[11px] py-2">
                  {error ? 'No data — spatial query failed.' : `No opted-in residents within ${radiusMeters}m of this incident.`}
                </p>
              )}
            </div>
          </div>

          {/* Emergency Services Panel */}
          <div className="bg-[#081019] border border-[#253340] rounded-xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#253340] pb-2">
              <span className="font-bold text-[#F04438] uppercase flex items-center space-x-1.5">
                <PhoneCall className="w-4 h-4" />
                <span>PRIORITIZED EMERGENCY CONTACTS</span>
              </span>
              <span className="text-[10px] text-[#F04438] font-bold">PRIORITY 1</span>
            </div>

            <div className="space-y-2">
              {emergencyServices.map((emg) => (
                <div key={emg.id} className="p-2.5 bg-[#0D151E] border border-[#253340] rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white text-xs">{emg.name}</div>
                    <div className="text-[10px] text-[#A7B4C1]">{emg.phone}</div>
                    <div className="text-[10px] text-[#66768A]">{emg.organization}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[#3DB7D9] font-bold block">{Math.round(emg.distance_meters)}m</span>
                    <span className="text-[9px] uppercase text-[#A7B4C1]">{emg.category}</span>
                  </div>
                </div>
              ))}

              {!isLoading && emergencyServices.length === 0 && (
                <p className="text-[#66768A] italic text-[11px] py-2">
                  No emergency contacts returned for this radius.
                </p>
              )}
            </div>

            <button
              onClick={handleAuthorizeAlert}
              disabled={!incidentId}
              className="w-full py-3 px-4 bg-[#F04438] hover:bg-[#FF6B35] disabled:bg-[#0D151E] disabled:text-[#66768A] text-white font-bold rounded text-xs transition flex items-center justify-center space-x-2 shadow-xl"
            >
              <Send className="w-4 h-4" />
              <span>AUTHORIZE EMERGENCY ALERT DISPATCH</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
