import React from 'react';

export const MapLegend: React.FC = () => {
  return (
    <div className="absolute bottom-3 left-3 z-[1000] p-2.5 bg-[#081019]/95 border border-[#253340] rounded-lg backdrop-blur-md text-[11px] font-mono text-slate-300 shadow-xl space-y-2 max-w-xs">
      <div className="flex items-center justify-between border-b border-[#253340] pb-1">
        <span className="font-semibold text-[#3DB7D9]">GIS SYMBOLOGY</span>
        <span className="text-[9px] text-[#A7B4C1]">VIIRS 375m</span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F04438]" />
          <span>Industrial Fire</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B35]" />
          <span>Routine Flare</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B35]" />
          <span>Forest Fire</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E8A93A]" />
          <span>Ag Burning</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#6F7E8D]" />
          <span>Unknown</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#3DB7D9]" />
          <span>Industrial Facility</span>
        </div>
      </div>
    </div>
  );
};
