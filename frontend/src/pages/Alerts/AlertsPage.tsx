import React, { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Radio,
  RefreshCw,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { useIntelligence } from '../../context/IntelligenceContext';
import { useApiResource } from '../../hooks/useApiResource';
import { acknowledgeNotification, authorizeAlertDispatch, fetchIncidentNotifications } from '../../services/firewatchApi';
import type { DispatchChannel, NotificationRecipientDTO } from '../../services/types';

type DispatchState = 'IDLE' | 'AUTHORIZING' | 'DISPATCHED' | 'FAILED';

/** Human-readable provider label for each backend channel code. */
const CHANNEL_LABELS: Record<string, string> = {
  FCM: 'FCM Push',
  SMS: 'SMS (Twilio)',
  EMAIL: 'Email (SendGrid)',
};

export const AlertsPage: React.FC = () => {
  const { alerts, resolveAlert, hotspots, selectedIncident, connectionStatus } = useIntelligence();
  const [searchParams] = useSearchParams();

  const incidentId = searchParams.get('incidentId') || selectedIncident?.id || null;

  // Resolve the incident the URL actually points at — it is not necessarily the
  // globally selected one, so the modal must not show another incident's location.
  const targetIncident = useMemo(
    () => hotspots.find((h) => h.id === incidentId) ?? null,
    [hotspots, incidentId],
  );

  const radiusMeters = Number(searchParams.get('radius')) || targetIncident?.customRadiusMeters || 1000;

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [channels, setChannels] = useState<{ fcm: boolean; sms: boolean; email: boolean }>({
    fcm: true,
    sms: true,
    email: true,
  });
  const [dispatchState, setDispatchState] = useState<DispatchState>('IDLE');
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  // GET /api/incidents/{id}/notifications — the recipient delivery ledger.
  const loader = useCallback(
    (signal: AbortSignal) =>
      incidentId
        ? fetchIncidentNotifications(incidentId, signal)
        : Promise.reject(new Error('No incident selected')),
    [incidentId],
  );
  const {
    data: records,
    isLoading,
    error: recordsError,
    reload,
    setData: setRecords,
  } = useApiResource<NotificationRecipientDTO[]>(incidentId ? loader : null);

  const deliveryRecords = useMemo(() => records ?? [], [records]);

  const selectedChannels = useMemo<DispatchChannel[]>(() => {
    const list: DispatchChannel[] = [];
    if (channels.fcm) list.push('FCM');
    if (channels.sms) list.push('SMS');
    if (channels.email) list.push('EMAIL');
    return list;
  }, [channels]);

  const handleAuthorizeDispatch = async () => {
    if (!incidentId || selectedChannels.length === 0) return;

    setDispatchState('AUTHORIZING');
    setDispatchError(null);

    try {
      const result = await authorizeAlertDispatch(incidentId, selectedChannels, radiusMeters);
      setRecords(result.recipients);
      setDispatchState('DISPATCHED');
      setIsAuthModalOpen(false);
    } catch (error) {
      setDispatchState('FAILED');
      setDispatchError(error instanceof Error ? error.message : 'Dispatch authorization failed');
    }
  };

  const handleAcknowledgeRecord = async (recipientId: string) => {
    setAcknowledgingId(recipientId);
    try {
      const updated = await acknowledgeNotification(recipientId);
      setRecords(deliveryRecords.map((r) => (r.id === updated.id ? updated : r)));
    } catch (error) {
      setDispatchError(error instanceof Error ? error.message : 'Acknowledgement failed');
    } finally {
      setAcknowledgingId(null);
    }
  };

  const bannerError = dispatchError ?? recordsError;

  return (
    <div className="min-h-screen bg-[#05080D] p-4 sm:p-6 space-y-6 font-sans text-[#F1F4F6]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#253340] pb-4 font-mono">
        <div>
          <div className="flex items-center space-x-2">
            <Radio className="w-5 h-5 text-[#F04438]" />
            <h1 className="text-xl font-semibold text-white tracking-wide">
              EMERGENCY ALERT DISPATCH & DELIVERY MONITORING
            </h1>
          </div>
          <p className="text-xs text-[#A7B4C1] mt-1">
            NOTIFICATIONS LIFECYCLE: QUEUED &rarr; SENT &rarr; DELIVERED &rarr; READ &rarr; ACKNOWLEDGED
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs text-[#E8A93A] bg-[#081019] px-3 py-1.5 border border-[#253340] rounded font-mono">
            {connectionStatus === 'live' ? 'BACKEND DEMO MODE DISPATCH' : 'BACKEND OFFLINE'}
          </span>

          <button
            onClick={reload}
            disabled={!incidentId}
            className="flex items-center space-x-1.5 px-3 py-2 bg-[#081019] border border-[#253340] rounded font-mono text-xs text-[#A7B4C1] hover:text-white hover:border-[#3DB7D9] disabled:opacity-40 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>REFRESH</span>
          </button>

          <button
            onClick={() => setIsAuthModalOpen(true)}
            disabled={!incidentId}
            className="px-4 py-2 bg-[#F04438] hover:bg-[#FF6B35] disabled:bg-[#0D151E] disabled:text-[#66768A] text-white font-bold rounded text-xs transition flex items-center space-x-1.5 shadow-lg"
          >
            <Send className="w-4 h-4" />
            <span>AUTHORIZE ALERT DISPATCH</span>
          </button>
        </div>
      </div>

      {bannerError && (
        <div className="p-3 bg-[#F04438]/10 border border-[#F04438]/40 rounded-lg font-mono text-xs text-[#F04438] flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-bold block">NOTIFICATION API ERROR</span>
            <span className="text-[11px] text-[#FFB3AC]">{bannerError}</span>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono text-xs">
        {/* Active Alert Events List (5 cols) */}
        <div className="lg:col-span-5 bg-[#081019] border border-[#253340] rounded-xl p-4 space-y-3 shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#253340] pb-2">
            <span className="font-bold text-[#3DB7D9] uppercase text-xs">OPERATIONAL ALERT QUEUE</span>
            <span className="text-[10px] text-[#A7B4C1]">{alerts.filter((a) => a.isUnresolved).length} ACTIVE</span>
          </div>

          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border transition space-y-2 ${
                  alert.isUnresolved
                    ? 'bg-[#0D151E] border-[#F04438]/50'
                    : 'bg-[#0D151E]/40 border-[#253340] opacity-60'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#3DB7D9]">{alert.hotspotId || alert.incidentId}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      alert.severity === 'HIGH' || alert.severity === 'CRITICAL'
                        ? 'bg-[#F04438]/20 text-[#F04438]'
                        : 'bg-[#E8A93A]/20 text-[#E8A93A]'
                    }`}
                  >
                    {alert.severity}
                  </span>
                </div>

                <div className="font-sans font-semibold text-white text-xs">{alert.title}</div>
                <div className="text-[10px] text-[#A7B4C1]">{alert.locationName}</div>

                <div className="flex justify-between items-center text-[10px] pt-1 border-t border-[#253340]">
                  <span>FRP: {alert.frpMw} MW</span>
                  {alert.isUnresolved ? (
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="text-[#39B978] hover:underline flex items-center space-x-1 font-bold"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Acknowledge</span>
                    </button>
                  ) : (
                    <span className="text-[#39B978]">ACKNOWLEDGED</span>
                  )}
                </div>
              </div>
            ))}

            {alerts.length === 0 && (
              <p className="text-[#66768A] italic text-[11px] py-2">No active alerts in the incident feed.</p>
            )}
          </div>
        </div>

        {/* Recipient Delivery Ledger (7 cols) */}
        <div className="lg:col-span-7 bg-[#081019] border border-[#253340] rounded-xl p-4 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#253340] pb-2">
            <span className="font-bold text-white text-xs uppercase">RECIPIENT DELIVERY & ACKNOWLEDGEMENT TRACKER</span>
            <span className="text-[10px] text-[#39B978] font-bold flex items-center space-x-1">
              {isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-[#39B978]" />
              )}
              <span>{incidentId ?? 'NO INCIDENT'}</span>
            </span>
          </div>

          <div className="space-y-2">
            {deliveryRecords.map((r) => (
              <div key={r.id} className="p-3 bg-[#0D151E] border border-[#253340] rounded-lg space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">{r.recipient_name}</span>
                    <span className="text-[10px] text-[#A7B4C1]">
                      {r.recipient_type} &bull; {CHANNEL_LABELS[r.channel] ?? r.channel}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.status === 'ACKNOWLEDGED'
                        ? 'bg-[#39B978]/20 text-[#39B978] border border-[#39B978]/40'
                        : r.status === 'READ'
                        ? 'bg-[#3DB7D9]/20 text-[#3DB7D9]'
                        : r.status === 'DELIVERED'
                        ? 'bg-[#E8A93A]/20 text-[#E8A93A]'
                        : 'bg-[#6F7E8D]/20 text-[#A7B4C1]'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#A7B4C1] pt-1 border-t border-[#253340]">
                  <span>
                    Sent: {r.sent_at ?? '—'}
                    {r.delivered_at ? ` | Delivered: ${r.delivered_at}` : ''}
                    {r.acknowledged_at ? ` | Ack: ${r.acknowledged_at}` : ''}
                  </span>

                  {r.status !== 'ACKNOWLEDGED' && (
                    <button
                      onClick={() => handleAcknowledgeRecord(r.id)}
                      disabled={acknowledgingId === r.id}
                      className="text-[#39B978] hover:underline font-bold disabled:opacity-50"
                    >
                      {acknowledgingId === r.id ? 'Acknowledging…' : 'Acknowledge Response'}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {!isLoading && deliveryRecords.length === 0 && (
              <p className="text-[#66768A] italic text-[11px] py-2">
                {incidentId
                  ? 'No dispatch has been authorized for this incident yet. Use AUTHORIZE ALERT DISPATCH to notify recipients inside the risk radius.'
                  : 'Select an incident to view its notification ledger.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ADMIN AUTHORIZATION MODAL */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-[#05080D]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono text-xs">
          <div className="bg-[#081019] border border-[#253340] rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#253340] pb-3">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-[#F04438]" />
                <h2 className="font-bold text-white text-base">AUTHORIZE ALERT DISPATCH</h2>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-[#0D151E] border border-[#253340] rounded space-y-1">
                <span className="text-[10px] text-[#A7B4C1]">TARGET INCIDENT:</span>
                <div className="font-bold text-white text-sm">{incidentId}</div>
                <div className="text-[11px] text-[#FF6B35]">
                  {targetIncident?.locationName ?? 'Location resolved by backend'}
                </div>
                <div className="text-[10px] text-[#A7B4C1] pt-1 border-t border-[#253340]">
                  DISPATCH RADIUS: {radiusMeters} m
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#A7B4C1] uppercase block mb-1">SELECT DISPATCH CHANNELS</label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={channels.fcm}
                      onChange={(e) => setChannels({ ...channels, fcm: e.target.checked })}
                      className="accent-[#3DB7D9]"
                    />
                    <span>FCM Cloud Push Notification (Mobile App)</span>
                  </label>
                  <label className="flex items-center space-x-2 text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={channels.sms}
                      onChange={(e) => setChannels({ ...channels, sms: e.target.checked })}
                      className="accent-[#3DB7D9]"
                    />
                    <span>Twilio SMS Emergency Broadcast</span>
                  </label>
                  <label className="flex items-center space-x-2 text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={channels.email}
                      onChange={(e) => setChannels({ ...channels, email: e.target.checked })}
                      className="accent-[#3DB7D9]"
                    />
                    <span>SendGrid Email Dispatch</span>
                  </label>
                </div>
                {selectedChannels.length === 0 && (
                  <p className="text-[10px] text-[#F04438] mt-2">Select at least one dispatch channel.</p>
                )}
              </div>

              {dispatchState === 'FAILED' && dispatchError && (
                <p className="text-[10px] text-[#F04438] p-2 bg-[#F04438]/10 border border-[#F04438]/40 rounded">
                  {dispatchError}
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-[#253340] flex justify-end space-x-2">
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="px-4 py-2 bg-[#0D151E] text-[#A7B4C1] hover:text-white rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleAuthorizeDispatch}
                disabled={dispatchState === 'AUTHORIZING' || selectedChannels.length === 0}
                className="px-4 py-2 bg-[#F04438] hover:bg-[#FF6B35] disabled:bg-[#0D151E] disabled:text-[#66768A] text-white font-bold rounded flex items-center space-x-1.5"
              >
                {dispatchState === 'AUTHORIZING' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{dispatchState === 'AUTHORIZING' ? 'AUTHORIZING…' : 'AUTHORIZE & DISPATCH NOW'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
