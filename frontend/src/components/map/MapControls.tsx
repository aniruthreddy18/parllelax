import React, { useState } from 'react';
import { Layers, SlidersHorizontal } from 'lucide-react';
import { useIntelligence } from '../../context/IntelligenceContext';

export const MapControls: React.FC = () => {
  const { layers, toggleLayer, mapMode, setMapMode } = useIntelligence();
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <div className="absolute top-3 right-3 z-[1000] font-mono text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 bg-[#081019]/95 border border-[#253340] rounded-md text-slate-200 hover:text-white hover:border-[#3DB7D9] transition shadow-lg flex items-center space-x-1.5 backdrop-blur-md"
      >
        <Layers className="w-4 h-4 text-[#3DB7D9]" />
        <span className="hidden sm:inline font-semibold">LAYERS & MAP</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-10 w-64 bg-[#081019]/95 border border-[#253340] rounded-lg p-3 backdrop-blur-md shadow-2xl space-y-3 text-slate-200 z-50">
          <div className="flex items-center justify-between border-b border-[#253340] pb-2">
            <span className="font-semibold text-[#3DB7D9] text-[11px]">GIS LAYER MANAGER</span>
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#A7B4C1]" />
          </div>

          {/* Map Base Mode Switcher */}
          <div className="space-y-1">
            <span className="text-[10px] text-[#A7B4C1] uppercase font-semibold block">BASEMAP</span>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                onClick={() => setMapMode('dark')}
                className={`py-1 px-2 rounded border transition text-[11px] ${
                  mapMode === 'dark' ? 'bg-[#0D151E] border-[#3DB7D9] text-[#3DB7D9]' : 'bg-[#0D151E]/50 border-[#253340] text-slate-400'
                }`}
              >
                Dark Vector
              </button>
              <button
                onClick={() => setMapMode('satellite')}
                className={`py-1 px-2 rounded border transition text-[11px] ${
                  mapMode === 'satellite' ? 'bg-[#0D151E] border-[#3DB7D9] text-[#3DB7D9]' : 'bg-[#0D151E]/50 border-[#253340] text-slate-400'
                }`}
              >
                Satellite Imagery
              </button>
            </div>
          </div>

          {/* Toggleable Layers */}
          <div className="space-y-2 border-t border-[#253340] pt-2 text-[11px]">
            <span className="text-[10px] text-[#A7B4C1] uppercase font-semibold block">OBSERVATIONS & INFRASTRUCTURE</span>

            <label className="flex items-center space-x-2 cursor-pointer hover:text-white transition">
              <input
                type="checkbox"
                checked={layers.thermalVIIRS}
                onChange={() => toggleLayer('thermalVIIRS')}
                className="rounded accent-[#3DB7D9]"
              />
              <span>VIIRS Thermal Hotspots</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer hover:text-white transition">
              <input
                type="checkbox"
                checked={layers.industrialFacilities}
                onChange={() => toggleLayer('industrialFacilities')}
                className="rounded accent-[#3DB7D9]"
              />
              <span>Industrial Infrastructure</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer hover:text-white transition">
              <input
                type="checkbox"
                checked={layers.riskZones}
                onChange={() => toggleLayer('riskZones')}
                className="rounded accent-[#3DB7D9]"
              />
              <span>500m & 2km Risk Buffer Zones</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer hover:text-white transition">
              <input
                type="checkbox"
                checked={layers.landCover}
                onChange={() => toggleLayer('landCover')}
                className="rounded accent-[#3DB7D9]"
              />
              <span>Industrial Zones Boundaries</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
