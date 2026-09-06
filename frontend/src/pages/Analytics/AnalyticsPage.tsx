import React from 'react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, TrendingUp } from 'lucide-react';
import { useIntelligence } from '../../context/IntelligenceContext';

const DAILY_TREND = [
  { date: 'Aug 22', detections: 2, avgFrp: 45.2 },
  { date: 'Aug 23', detections: 4, avgFrp: 88.0 },
  { date: 'Aug 24', detections: 3, avgFrp: 62.5 },
  { date: 'Aug 25', detections: 5, avgFrp: 110.2 },
  { date: 'Aug 26', detections: 2, avgFrp: 38.0 },
  { date: 'Aug 27', detections: 7, avgFrp: 142.6 },
];

const SEVERITY_DISTRIBUTION = [
  { name: 'High Severity', value: 3, color: '#F04438' },
  { name: 'Medium Severity', value: 3, color: '#E8A93A' },
  { name: 'Low Severity', value: 1, color: '#39B978' },
];

export const AnalyticsPage: React.FC = () => {
  const { metrics } = useIntelligence();

  return (
    <div className="min-h-screen bg-[#05080D] p-4 sm:p-6 space-y-6 font-sans text-[#F1F4F6]">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-[#253340] pb-4 font-mono">
        <div>
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-[#3DB7D9]" />
            <h1 className="text-xl font-semibold text-white tracking-wide">
              INTELLIGENCE ANALYTICS
            </h1>
          </div>
          <p className="text-xs text-[#A7B4C1] mt-1">
            GEOSPATIAL THERMAL ANOMALY TRENDS & INFRASTRUCTURE IMPACT
          </p>
        </div>

        <div className="text-xs text-[#3DB7D9] bg-[#081019] px-3 py-1.5 border border-[#253340] rounded">
          DEMO ANALYTICS WINDOW (LAST 30 DAYS)
        </div>
      </div>

      {/* Dynamic KPI Header Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
        <div className="p-4 bg-[#081019] border border-[#253340] rounded-lg">
          <span className="text-[10px] text-[#A7B4C1] uppercase block">TOTAL DETECTIONS</span>
          <span className="text-2xl font-bold text-[#3DB7D9]">{metrics.totalDetected}</span>
          <span className="text-[10px] text-[#39B978] flex items-center mt-1">
            <TrendingUp className="w-3 h-3 mr-1" /> +14.2% vs prev 30d
          </span>
        </div>

        <div className="p-4 bg-[#081019] border border-[#253340] rounded-lg">
          <span className="text-[10px] text-[#F04438] uppercase font-semibold block">HIGH PRIORITY</span>
          <span className="text-2xl font-bold text-[#F04438]">{metrics.highPriorityCount}</span>
          <span className="text-[10px] text-[#A7B4C1] block mt-1">42.8% of total</span>
        </div>

        <div className="p-4 bg-[#081019] border border-[#253340] rounded-lg">
          <span className="text-[10px] text-[#A7B4C1] uppercase block">AVERAGE FRP</span>
          <span className="text-2xl font-bold text-[#E8A93A]">{metrics.avgFrp} MW</span>
          <span className="text-[10px] text-[#A7B4C1] block mt-1">Radiative Energy</span>
        </div>

        <div className="p-4 bg-[#081019] border border-[#253340] rounded-lg">
          <span className="text-[10px] text-[#A7B4C1] uppercase block">MONITORED ASSETS</span>
          <span className="text-2xl font-bold text-white">06</span>
          <span className="text-[10px] text-[#39B978] block mt-1">Telangana Sector</span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Detection Volume & FRP Trend Chart (8 cols) */}
        <div className="lg:col-span-8 bg-[#081019] border border-[#253340] rounded-xl p-5 space-y-4 font-mono">
          <div className="flex items-center justify-between border-b border-[#253340] pb-2 text-xs">
            <span className="font-semibold text-[#3DB7D9] uppercase tracking-wider">
              DAILY DETECTION VOLUME & MEAN FRP (MW)
            </span>
            <span className="text-[10px] text-[#A7B4C1]">30-DAY WINDOW</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={DAILY_TREND}>
                <CartesianGrid strokeDasharray="3 3" stroke="#253340" />
                <XAxis dataKey="date" stroke="#6F7E8D" fontSize={11} />
                <YAxis stroke="#6F7E8D" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#081019', borderColor: '#253340', color: '#fff' }} />
                <Line type="monotone" dataKey="detections" stroke="#3DB7D9" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="avgFrp" stroke="#E8A93A" strokeWidth={2} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Severity Breakdown Pie Chart (4 cols) */}
        <div className="lg:col-span-4 bg-[#081019] border border-[#253340] rounded-xl p-5 space-y-4 font-mono">
          <div className="flex items-center justify-between border-b border-[#253340] pb-2 text-xs">
            <span className="font-semibold text-white uppercase tracking-wider">
              SEVERITY DISTRIBUTION
            </span>
            <span className="text-[10px] text-[#A7B4C1]">VIIRS SCORE</span>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={SEVERITY_DISTRIBUTION} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                  {SEVERITY_DISTRIBUTION.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#081019', borderColor: '#253340', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
