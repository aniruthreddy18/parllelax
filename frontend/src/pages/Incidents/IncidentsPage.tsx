import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Filter,
  Flame,
  LayoutGrid,
  List,
} from 'lucide-react';
import { useIntelligence } from '../../context/IntelligenceContext';

export const IncidentsPage: React.FC = () => {
  const { filteredHotspots, filters, setFilters, selectIncidentById } = useIntelligence();
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const navigate = useNavigate();

  const handleRowClick = (id: string) => {
    selectIncidentById(id);
    navigate(`/incidents/${id}`);
  };

  return (
    <div className="min-h-screen bg-[#070B12] p-4 sm:p-6 space-y-6 font-sans text-slate-100">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#243244] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Flame className="w-5 h-5 text-[#E5484D]" />
            <h1 className="text-xl font-semibold text-white tracking-wide">
              Incidents Registry
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Detected Thermal Anomalies in Hyderabad Industrial Corridor
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center space-x-2 font-mono text-xs">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded flex items-center space-x-1 border transition ${
              viewMode === 'table' ? 'bg-[#111A26] text-[#2FA8D8] border-[#2FA8D8]/50' : 'bg-[#111A26]/50 text-slate-400 border-[#243244]'
            }`}
          >
            <List className="w-4 h-4" />
            <span>Table View</span>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded flex items-center space-x-1 border transition ${
              viewMode === 'grid' ? 'bg-[#111A26] text-[#2FA8D8] border-[#2FA8D8]/50' : 'bg-[#111A26]/50 text-slate-400 border-[#243244]'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Grid View</span>
          </button>
        </div>
      </div>

      {/* Filter Control Toolbar */}
      <div className="p-3.5 bg-[#111A26] border border-[#243244] rounded-lg flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 text-[#2FA8D8] font-semibold">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          <select
            value={filters.eventType}
            onChange={(e) => setFilters((prev) => ({ ...prev, eventType: e.target.value }))}
            className="px-3 py-1 bg-[#0B111A] border border-[#243244] text-slate-200 rounded focus:outline-none focus:border-[#2FA8D8]"
          >
            <option value="ALL">All Classifications</option>
            <option value="Industrial Fire">Industrial Fire</option>
            <option value="Routine Flare">Routine Flare</option>
            <option value="Forest Fire">Forest Fire</option>
            <option value="Agricultural Burning">Agricultural Burning</option>
            <option value="Unknown Anomaly">Unknown Anomaly</option>
          </select>

          <select
            value={filters.severity}
            onChange={(e) => setFilters((prev) => ({ ...prev, severity: e.target.value }))}
            className="px-3 py-1 bg-[#0B111A] border border-[#243244] text-slate-200 rounded focus:outline-none focus:border-[#2FA8D8]"
          >
            <option value="ALL">All Severities</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>
        </div>

        <div className="text-slate-400">
          Showing <strong className="text-[#2FA8D8] font-bold">{filteredHotspots.length}</strong> incidents
        </div>
      </div>

      {/* Table View */}
      {viewMode === 'table' ? (
        <div className="overflow-x-auto border border-[#243244] rounded-lg bg-[#111A26]">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-[#0B111A] border-b border-[#243244] text-[#2FA8D8]">
                <th className="p-3 font-semibold">INCIDENT ID</th>
                <th className="p-3 font-semibold">CLASSIFICATION</th>
                <th className="p-3 font-semibold">SEVERITY</th>
                <th className="p-3 font-semibold">LOCATION</th>
                <th className="p-3 font-semibold">FRP (MW)</th>
                <th className="p-3 font-semibold">CONFIDENCE</th>
                <th className="p-3 font-semibold">NEAREST FACILITY</th>
                <th className="p-3 font-semibold text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#243244]">
              {filteredHotspots.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => handleRowClick(item.id)}
                  className="hover:bg-[#151F2C] cursor-pointer transition"
                >
                  <td className="p-3 font-bold text-[#2FA8D8]">{item.id}</td>
                  <td className="p-3 font-semibold text-white">{item.classification}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                        item.severity === 'HIGH' ? 'bg-[#E5484D]/20 text-[#E5484D] border border-[#E5484D]/40' : 'bg-[#E9A23B]/20 text-[#E9A23B]'
                      }`}
                    >
                      {item.severity}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300 max-w-xs truncate">{item.locationName}</td>
                  <td className="p-3 font-bold text-[#E9A23B]">{item.frpMw} MW</td>
                  <td className="p-3 text-[#2FBF71] font-bold">{item.confidence}%</td>
                  <td className="p-3 text-slate-300">{item.nearestFacilityName} ({item.facilityDistanceKm} km)</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(item.id);
                      }}
                      className="px-3 py-1 bg-[#2FA8D8] hover:bg-[#3BB7E6] text-[#070B12] font-semibold rounded text-[11px] transition inline-flex items-center space-x-1"
                    >
                      <span>Investigate</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
          {filteredHotspots.map((item) => (
            <div
              key={item.id}
              onClick={() => handleRowClick(item.id)}
              className="p-4 bg-[#111A26] border border-[#243244] hover:border-[#304155] rounded-lg space-y-3 cursor-pointer transition group"
            >
              <div className="flex items-center justify-between border-b border-[#243244] pb-2">
                <span className="font-bold text-sm text-[#2FA8D8]">{item.id}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    item.severity === 'HIGH' ? 'bg-[#E5484D]/20 text-[#E5484D]' : 'bg-[#E9A23B]/20 text-[#E9A23B]'
                  }`}
                >
                  {item.severity}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-white text-base group-hover:text-[#2FA8D8] transition">
                  {item.classification}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{item.locationName}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs bg-[#0B111A] p-2 rounded border border-[#243244]">
                <div>FRP: <strong className="text-[#E9A23B]">{item.frpMw} MW</strong></div>
                <div>Confidence: <strong className="text-[#2FBF71]">{item.confidence}%</strong></div>
              </div>
              <div className="text-xs text-slate-300 pt-1 flex justify-between items-center">
                <span>Nearest: {item.nearestFacilityName}</span>
                <ChevronRight className="w-4 h-4 text-[#2FA8D8]" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
