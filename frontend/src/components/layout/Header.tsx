import React, { useEffect, useState } from 'react';
import { Bell, Globe, Radar, RefreshCw, Search } from 'lucide-react';
import { useIntelligence } from '../../context/IntelligenceContext';

export const Header: React.FC = () => {
  const { filters, setFilters, alerts, connectionStatus, lastSyncedAt, refreshIncidents } = useIntelligence();
  const [timeString, setTimeString] = useState<string>('');
  const unresolvedCount = alerts.filter((a) => a.isUnresolved).length;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const utc = now.toISOString().slice(11, 19) + ' UTC';
      const istStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST';
      setTimeString(`${istStr} | ${utc}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 bg-[#081019] border-b border-[#253340] px-4 flex items-center justify-between z-30 relative shrink-0">
      {/* Brand & Identity */}
      <div className="flex items-center space-x-3">
        <div className="w-7 h-7 rounded bg-[#0D151E] border border-[#253340] flex items-center justify-center text-[#3DB7D9]">
          <Radar className="w-4 h-4" />
        </div>
        <div>
          <span className="font-semibold text-sm tracking-wide text-white">FIREWATCH <span className="text-[#3DB7D9]">AI</span></span>
          <span className="text-[10px] text-[#A7B4C1] ml-2 px-1.5 py-0.5 bg-[#0D151E] border border-[#253340] rounded font-mono">
            SATELLITE THERMAL INTELLIGENCE
          </span>
        </div>
      </div>

      {/* Backend Connection Badge */}
      <div className="hidden md:flex items-center space-x-3 font-mono text-xs">
        <div
          className={`flex items-center space-x-2 px-2.5 py-1 bg-[#0D151E] border rounded ${
            connectionStatus === 'live'
              ? 'border-[#39B978]/40'
              : connectionStatus === 'connecting'
              ? 'border-[#253340]'
              : 'border-[#F04438]/40'
          }`}
          title={
            lastSyncedAt
              ? `Last incident sync: ${lastSyncedAt.toLocaleTimeString('en-GB', { hour12: false })}`
              : 'Awaiting first incident sync'
          }
        >
          <span
            className={`w-2 h-2 rounded-full ${
              connectionStatus === 'live'
                ? 'bg-[#39B978]'
                : connectionStatus === 'connecting'
                ? 'bg-[#E8A93A] animate-pulse'
                : 'bg-[#F04438]'
            }`}
          />
          <span
            className={`font-medium text-[11px] ${
              connectionStatus === 'live'
                ? 'text-[#39B978]'
                : connectionStatus === 'connecting'
                ? 'text-[#E8A93A]'
                : 'text-[#F04438]'
            }`}
          >
            {connectionStatus === 'live'
              ? 'LIVE API FEED'
              : connectionStatus === 'connecting'
              ? 'CONNECTING TO API…'
              : 'API OFFLINE — DEMO DATA'}
          </span>
        </div>

        <button
          onClick={() => void refreshIncidents()}
          title="Re-poll GET /api/incidents"
          className="flex items-center justify-center w-7 h-7 rounded bg-[#0D151E] border border-[#253340] text-[#A7B4C1] hover:text-white hover:border-[#3DB7D9] transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Region Selector & Global Search */}
      <div className="flex items-center space-x-3 font-mono text-xs">
        <div className="relative hidden lg:block">
          <Globe className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#6F7E8D]" />
          <select
            value={filters.region}
            onChange={(e) => setFilters((prev) => ({ ...prev, region: e.target.value }))}
            className="pl-8 pr-3 py-1 bg-[#0D151E] border border-[#253340] text-slate-200 text-xs rounded focus:outline-none focus:border-[#3DB7D9]"
          >
            <option value="Hyderabad Industrial Corridor">Hyderabad Industrial Corridor (IN)</option>
            <option value="Permian Petrochemical Zone">Permian Petrochemical Basin (US)</option>
            <option value="Rhine Industrial Belt">Rhine Industrial Belt (EU)</option>
          </select>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#6F7E8D]" />
          <input
            type="text"
            placeholder="Search FW ID, facility..."
            value={filters.searchKeyword}
            onChange={(e) => setFilters((prev) => ({ ...prev, searchKeyword: e.target.value }))}
            className="pl-8 pr-3 py-1 bg-[#0D151E] border border-[#253340] text-xs text-slate-200 placeholder-[#6F7E8D] rounded w-36 sm:w-48 focus:outline-none focus:border-[#3DB7D9]"
          />
        </div>

        {/* Live Timestamp */}
        <div className="hidden xl:block text-[11px] text-[#A7B4C1] bg-[#0D151E] px-2.5 py-1 border border-[#253340] rounded">
          {timeString}
        </div>

        {/* Notification Counter */}
        <div className="relative flex items-center justify-center w-7 h-7 rounded bg-[#0D151E] border border-[#253340] text-slate-300 hover:text-white cursor-pointer transition">
          <Bell className="w-3.5 h-3.5" />
          {unresolvedCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#F04438] text-white text-[9px] font-mono font-bold rounded-full flex items-center justify-center">
              {unresolvedCount}
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
