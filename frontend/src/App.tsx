import React from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Navigation } from './components/layout/Navigation';
import { IntelligenceProvider } from './context/IntelligenceContext';
import { AlertsPage } from './pages/Alerts/AlertsPage';
import { AnalyticsPage } from './pages/Analytics/AnalyticsPage';
import { CommandCenterPage } from './pages/CommandCenter/CommandCenterPage';
import { FacilityWatchPage } from './pages/FacilityWatch/FacilityWatchPage';
import { FireDetectPage } from './pages/FireDetect/FireDetectPage';
import { IncidentAnalysisPage } from './pages/IncidentAnalysis/IncidentAnalysisPage';
import { IncidentDetailsPage } from './pages/IncidentDetails/IncidentDetailsPage';
import { IncidentsPage } from './pages/Incidents/IncidentsPage';
import { LandingPage } from './pages/Landing/LandingPage';
import { MapExplorerPage } from './pages/MapExplorer/MapExplorerPage';
import { MethodologyPage } from './pages/Methodology/MethodologyPage';
import { MissionBriefPage } from './pages/MissionBrief/MissionBriefPage';
import { RiskImpactPage } from './pages/RiskImpact/RiskImpactPage';
import { SystemStatusPage } from './pages/SystemStatus/SystemStatusPage';
import { ThermalHistoryPage } from './pages/ThermalHistory/ThermalHistoryPage';

const AppContent: React.FC = () => {
  const location = useLocation();
  // The globe landing page renders its own header, so the app chrome is hidden
  // there. Everything else — including the Fire Detection entry point — uses it.
  const isLanding = location.pathname === '/landing';

  return (
    <div className="min-h-screen bg-[#05080D] flex flex-col font-sans selection:bg-[#3DB7D9] selection:text-[#05080D] overflow-hidden">
      {!isLanding && <Header />}
      {!isLanding && <Navigation />}

      <div className="flex-1 overflow-y-auto">
        <Routes>
          {/* Fire Detection is the entry point. */}
          <Route path="/" element={<FireDetectPage />} />
          <Route path="/detect" element={<FireDetectPage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/command-center" element={<CommandCenterPage />} />
          <Route path="/incident/:incidentId" element={<IncidentAnalysisPage />} />
          <Route path="/incidents/:id" element={<IncidentDetailsPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/map-explorer" element={<MapExplorerPage />} />
          <Route path="/thermal-history" element={<ThermalHistoryPage />} />
          <Route path="/facility-watch" element={<FacilityWatchPage />} />
          <Route path="/risk-impact" element={<RiskImpactPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/system-status" element={<SystemStatusPage />} />
          <Route path="/methodology" element={<MethodologyPage />} />
          <Route path="/mission-brief" element={<MissionBriefPage />} />
        </Routes>
      </div>
    </div>
  );
};

export function App() {
  return (
    <IntelligenceProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </IntelligenceProvider>
  );
}

export default App;
