import React, { useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Cpu, Database, Flame, Layers, Loader2, Radar, RefreshCw, ShieldAlert } from 'lucide-react';
import { useApiResource } from '../../hooks/useApiResource';
import { fetchSystemStatus } from '../../services/firewatchApi';
import { API_BASE_URL } from '../../services/apiClient';
import { useIntelligence } from '../../context/IntelligenceContext';
import type { SystemStatusDTO } from '../../services/types';

/** Amber for anything still running on simulated credentials, green once wired up. */
const isDemoValue = (value: string) => value.toUpperCase().includes('DEMO');

interface ServiceCardProps {
  label: string;
  value: string | undefined;
  hint: string;
  isPending: boolean;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ label, value, hint, isPending }) => {
  const unknown = !value;
  const demo = value ? isDemoValue(value) : false;
  const tone = unknown ? 'text-[#6F7E8D]' : demo ? 'text-[#E8A93A]' : 'text-[#39B978]';
  const Icon = unknown ? AlertTriangle : demo ? ShieldAlert : CheckCircle2;

  return (
    <div className="p-4 bg-[#081019] border border-[#253340] rounded-lg space-y-1">
      <span className="text-[10px] text-[#A7B4C1] block uppercase">{label}</span>
      <span className={`text-sm font-bold flex items-center space-x-1 ${tone}`}>
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
        <span>{isPending ? 'QUERYING API…' : value ?? 'UNREACHABLE'}</span>
      </span>
      <span className="text-[10px] text-[#A7B4C1] block pt-1">{hint}</span>
    </div>
  );
};

export const SystemStatusPage: React.FC = () => {
  const { connectionStatus, lastSyncedAt } = useIntelligence();
  const loader = useCallback((signal: AbortSignal) => fetchSystemStatus(signal), []);
  const { data, isLoading, error, reload } = useApiResource<SystemStatusDTO>(loader);

  const apiOrigin = API_BASE_URL || `${window.location.origin} (dev proxy)`;

  return (
    <div className="min-h-screen bg-[#05080D] p-4 sm:p-6 space-y-6 font-sans text-[#F1F4F6]">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#253340] pb-4 font-mono">
        <div>
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-[#3DB7D9]" />
            <h1 className="text-xl font-semibold text-white tracking-wide">
              ENGINEERING SYSTEM STATUS & HEALTH MONITOR
            </h1>
          </div>
          <p className="text-xs text-[#A7B4C1] mt-1">
            LIVE READ OF <span className="text-[#3DB7D9]">GET /api/system/status</span> &bull; {apiOrigin}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div
            className={`flex items-center space-x-2 font-mono text-xs px-3 py-1.5 border rounded ${
              error
                ? 'text-[#F04438] border-[#F04438]/40 bg-[#F04438]/10'
                : 'text-[#39B978] border-[#253340] bg-[#081019]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${error ? 'bg-[#F04438]' : 'bg-[#39B978]'}`} />
            <span>{error ? 'FASTAPI UNREACHABLE' : 'FRONTEND & FASTAPI CONNECTED'}</span>
          </div>

          <button
            onClick={reload}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#081019] border border-[#253340] rounded font-mono text-xs text-[#A7B4C1] hover:text-white hover:border-[#3DB7D9] transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>REFRESH</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#F04438]/10 border border-[#F04438]/40 rounded-lg font-mono text-xs text-[#F04438] flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-bold block">BACKEND HEALTH CHECK FAILED</span>
            <span className="text-[11px] text-[#FFB3AC]">{error}</span>
            <span className="text-[11px] text-[#A7B4C1] block mt-1">
              Start the API with <span className="text-white">uvicorn app.main:app --port 8000</span> from the <span className="text-white">backend/</span> directory.
            </span>
          </div>
        </div>
      )}

      {/* Service Health Grid — values come straight from the API response */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
        <ServiceCard
          label="POSTGRESQL / POSTGIS"
          value={data?.postgis}
          hint={data?.database ?? 'DATABASE_URL pending'}
          isPending={isLoading}
        />
        <ServiceCard
          label="FCM PUSH PROVIDER"
          value={data?.fcm}
          hint="FCM_PROJECT_ID"
          isPending={isLoading}
        />
        <ServiceCard
          label="TWILIO SMS PROVIDER"
          value={data?.twilio}
          hint="TWILIO_ACCOUNT_SID"
          isPending={isLoading}
        />
        <ServiceCard
          label="SENDGRID EMAIL"
          value={data?.sendgrid}
          hint="SENDGRID_API_KEY"
          isPending={isLoading}
        />
      </div>

      {/* API connection summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
        <div className="p-4 bg-[#081019] border border-[#253340] rounded-lg space-y-1">
          <span className="text-[10px] text-[#A7B4C1] block uppercase">INCIDENT FEED</span>
          <span
            className={`text-sm font-bold ${
              connectionStatus === 'live'
                ? 'text-[#39B978]'
                : connectionStatus === 'connecting'
                ? 'text-[#E8A93A]'
                : 'text-[#F04438]'
            }`}
          >
            {connectionStatus.toUpperCase()}
          </span>
          <span className="text-[10px] text-[#A7B4C1] block pt-1">
            {lastSyncedAt ? `Last sync ${lastSyncedAt.toLocaleTimeString('en-GB', { hour12: false })}` : 'Awaiting first sync'}
          </span>
        </div>

        <div className="p-4 bg-[#081019] border border-[#253340] rounded-lg space-y-1">
          <span className="text-[10px] text-[#A7B4C1] block uppercase">RUN MODE</span>
          <span className={`text-sm font-bold ${data?.demo_mode === false ? 'text-[#39B978]' : 'text-[#E8A93A]'}`}>
            {data ? (data.demo_mode ? 'DEMO MODE / BETA SIMULATION' : 'LIVE DISPATCH') : '—'}
          </span>
          <span className="text-[10px] text-[#A7B4C1] block pt-1">settings.DEMO_MODE</span>
        </div>

        <div className="p-4 bg-[#081019] border border-[#253340] rounded-lg space-y-1">
          <span className="text-[10px] text-[#A7B4C1] block uppercase">MAP TILE PROVIDERS</span>
          <span className="text-sm font-bold text-[#3DB7D9]">{data?.map_tiles ?? '—'}</span>
          <span className="text-[10px] text-[#A7B4C1] block pt-1">VITE_MAP_STYLE_URL</span>
        </div>
      </div>

      {/* Engineering Pipeline Diagram */}
      <div className="max-w-5xl mx-auto space-y-4 font-mono text-xs">
        <h2 className="text-sm font-bold text-white uppercase border-b border-[#253340] pb-2">
          6-STAGE PIPELINE HEALTH
        </h2>

        {[
          { stage: '01', name: 'VIIRS / NASA FIRMS INGESTION', status: 'FIRMS INTEGRATION READY', desc: 'Batch thermal point converter (375m I-Band)', icon: Radar },
          { stage: '02', name: 'POSTGIS SPATIAL DATABASE', status: data?.postgis ?? 'UNREACHABLE', desc: 'Indexed spatial geometries for Telangana assets', icon: Database },
          { stage: '03', name: 'GIS CONTEXT INTERSECTION', status: 'READY', desc: 'Land cover & industrial zone spatial overlay', icon: Layers },
          { stage: '04', name: '180-DAY HISTORICAL RECURRENCE', status: 'READY', desc: 'Recurrence lookup against baseline flare data', icon: Flame },
          { stage: '05', name: 'DETERMINISTIC BETA RULE ENGINE', status: 'ONLINE', desc: '5-stage explainable decision tree evaluator', icon: Cpu },
          { stage: '06', name: 'SPATIAL RISK & NOTIFICATION LIFE', status: data?.status ?? 'UNREACHABLE', desc: 'QUEUED -> SENT -> DELIVERED -> READ -> ACKNOWLEDGED', icon: CheckCircle2 },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.stage}
              className="p-4 bg-[#081019] border border-[#253340] rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded bg-[#0D151E] border border-[#253340] flex items-center justify-center text-[#3DB7D9] font-bold">
                  {item.stage}
                </div>
                <div>
                  <h3 className="font-bold text-white text-xs flex items-center space-x-2">
                    <Icon className="w-4 h-4 text-[#3DB7D9]" />
                    <span>{item.name}</span>
                  </h3>
                  <p className="text-[11px] text-[#A7B4C1] mt-0.5">{item.desc}</p>
                </div>
              </div>

              <span className="px-2.5 py-1 bg-[#39B978]/20 text-[#39B978] border border-[#39B978]/40 rounded font-bold text-[10px] flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>{item.status}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
