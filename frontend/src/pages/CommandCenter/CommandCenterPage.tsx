import React from 'react';
import { GISMapLibre } from '../../components/map/GISMapLibre';
import { MapControls } from '../../components/map/MapControls';
import { MapLegend } from '../../components/map/MapLegend';
import { IntelligenceDrawer } from '../../components/intelligence/IntelligenceDrawer';
import { SituationRail } from '../../components/intelligence/SituationRail';
import { TimeScrubber } from '../../components/timeline/TimeScrubber';

export const CommandCenterPage: React.FC = () => {
  return (
    <div className="flex flex-col h-[calc(100vh-5.75rem)] w-full overflow-hidden bg-[#050A12] p-2 space-y-2">
      {/* Central Command Center Grid */}
      <div className="flex-1 flex flex-col lg:flex-row gap-2 min-h-0 overflow-hidden relative">
        {/* Left Operational Situation Rail (~240px) */}
        <SituationRail />

        {/* Center MapLibre GIS Workspace Map (~65% space) */}
        <div className="flex-1 relative flex flex-col min-h-[400px] lg:min-h-0 rounded-lg overflow-hidden border border-[#203246]">
          <GISMapLibre height="h-full" />
          <MapControls />
          <MapLegend />
        </div>

        {/* Right Reusable Intelligence Drawer (~360px) */}
        <IntelligenceDrawer />
      </div>

      {/* Bottom Temporal Timeline Scrubber */}
      <TimeScrubber />
    </div>
  );
};
