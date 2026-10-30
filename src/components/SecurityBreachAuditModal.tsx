import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Globe,
  Activity,
  Smartphone,
  Laptop,
  Download,
  RefreshCw,
  Trash2,
  MapPin,
  ExternalLink,
  X,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Radio,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import {
  fetchSecurityAuditSummary,
  clearSecurityLogs,
  triggerCsvExport,
  triggerJsonExport,
  SecurityAuditRecord,
  SecurityAuditSummary,
} from '../services/securityAuditService';

interface SecurityBreachAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityBreachAuditModal: React.FC<SecurityBreachAuditModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useI18n();
  const [summary, setSummary] = useState<SecurityAuditSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'vpn' | 'mobile' | 'login'>('all');
  const [clearing, setClearing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchSecurityAuditSummary();
      setSummary(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      const interval = setInterval(loadData, 5000); // 5-sec live polling
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleClear = async () => {
    if (window.confirm('Reset all security incident and link access logs? This cannot be undone.')) {
      setClearing(true);
      try {
        await clearSecurityLogs();
        await loadData();
      } finally {
        setClearing(false);
      }
    }
  };

  const filteredRecords = useMemo(() => {
    if (!summary?.records) return [];
    return summary.records.filter((rec) => {
      // Type filter
      if (filterType === 'vpn' && !rec.network.isVpnOrProxy) return false;
      if (filterType === 'mobile' && !rec.device.isMobile) return false;
      if (filterType === 'login' && (rec as any).eventType !== 'USER_LOGIN' && !(rec as any).user) return false;

      // Text search
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const targetStr = `${rec.clientIp} ${rec.network.country} ${rec.network.region} ${rec.network.city} ${rec.network.isp} ${rec.network.asn} ${rec.fullUrl} ${rec.device.os} ${rec.device.browser} ${(rec.clientTelemetry?.webRtcIps || []).join(' ')}`.toLowerCase();
      return targetStr.includes(term);
    });
  }, [summary, filterType, searchTerm]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          width: '100%',
          maxWidth: '1160px',
          maxHeight: '92vh',
          backgroundColor: '#090d16',
          border: '2px solid #ef4444',
          borderRadius: '16px',
          boxShadow: '0 25px 60px -15px rgba(239, 68, 68, 0.3), 0 0 0 1px rgba(239, 68, 68, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f1f5f9',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #1e293b',
            background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                border: '1.5px solid #ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
              }}
            >
              <ShieldAlert size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#f87171', letterSpacing: '-0.01em' }}>
                  {t('sec.modalTitle')}
                </h2>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(239, 68, 68, 0.25)',
                    color: '#fca5a5',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                  }}
                >
                  <Radio size={12} className="animate-pulse" /> LIVE TELEMETRY ACTIVE
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>
                {t('sec.modalSubtitle')}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={loadData}
              disabled={loading}
              title="Refresh Logs"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#1e293b',
                color: '#cbd5e1',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Metric Cards Banner */}
        <div
          style={{
            padding: '16px 24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: '12px',
            backgroundColor: '#0b1120',
            borderBottom: '1px solid #1e293b',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid #334155',
              borderRadius: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{t('sec.totalVisits')}</span>
              <Activity size={16} color="#38bdf8" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#f8fafc' }}>
              {summary?.totalVisits ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Total link access events</div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid #334155',
              borderRadius: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{t('sec.uniqueIps')}</span>
              <Globe size={16} color="#4ade80" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#f8fafc' }}>
              {summary?.uniqueIpCount ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Distinct network origins</div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1.5px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fca5a5' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>{t('sec.vpnFlagged')}</span>
              <AlertTriangle size={16} color="#ef4444" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#f87171' }}>
              {summary?.vpnFlaggedCount ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: '#fca5a5', marginTop: '2px' }}>Suspected anonymized tunnels</div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid #334155',
              borderRadius: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{t('sec.mobileVisitors')}</span>
              <Smartphone size={16} color="#a855f7" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#f8fafc' }}>
              {summary?.mobileCount ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Cellular & mobile phones</div>
          </div>
        </div>

        {/* Toolbar: Search, Filters & Export */}
        <div
          style={{
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: '#0c1322',
            borderBottom: '1px solid #1e293b',
          }}
        >
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1', minWidth: '240px', maxWidth: '380px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}
            />
            <input
              type="text"
              placeholder={t('sec.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '7px 10px 7px 32px',
                fontSize: '12px',
                color: '#f8fafc',
                outline: 'none',
              }}
            />
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setFilterType('all')}
              style={{
                fontSize: '11.5px',
                fontWeight: 600,
                padding: '5px 12px',
                borderRadius: '8px',
                border: filterType === 'all' ? '1.5px solid #38bdf8' : '1px solid #334155',
                backgroundColor: filterType === 'all' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: filterType === 'all' ? '#38bdf8' : '#94a3b8',
                cursor: 'pointer',
              }}
            >
              {t('sec.allFilter')} ({summary?.records.length ?? 0})
            </button>
            <button
              onClick={() => setFilterType('vpn')}
              style={{
                fontSize: '11.5px',
                fontWeight: 600,
                padding: '5px 12px',
                borderRadius: '8px',
                border: filterType === 'vpn' ? '1.5px solid #ef4444' : '1px solid #334155',
                backgroundColor: filterType === 'vpn' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                color: filterType === 'vpn' ? '#f87171' : '#94a3b8',
                cursor: 'pointer',
              }}
            >
              {t('sec.vpnFilter')} ({summary?.vpnFlaggedCount ?? 0})
            </button>
            <button
              onClick={() => setFilterType('mobile')}
              style={{
                fontSize: '11.5px',
                fontWeight: 600,
                padding: '5px 12px',
                borderRadius: '8px',
                border: filterType === 'mobile' ? '1.5px solid #a855f7' : '1px solid #334155',
                backgroundColor: filterType === 'mobile' ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                color: filterType === 'mobile' ? '#c084fc' : '#94a3b8',
                cursor: 'pointer',
              }}
            >
              {t('sec.mobileFilter')} ({summary?.mobileCount ?? 0})
            </button>
          
            <button
              onClick={() => setFilterType('login')}
              style={{
                fontSize: '11.5px',
                fontWeight: 600,
                padding: '5px 12px',
                borderRadius: '8px',
                border: filterType === 'login' ? '1.5px solid #10b981' : '1px solid #334155',
                backgroundColor: filterType === 'login' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                color: filterType === 'login' ? '#34d399' : '#94a3b8',
                cursor: 'pointer',
              }}
            >
              Sign-Ins / Logins ({summary?.records.filter(r => (r as any).eventType === 'USER_LOGIN' || (r as any).user).length ?? 0})
            </button>
</div>
          {/* Export Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={triggerCsvExport}
              title="Download official forensic CSV log"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#065f46',
                border: '1px solid #10b981',
                color: '#ecfdf5',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <FileSpreadsheet size={13} />
              <span>CSV Dossier</span>
            </button>
            <button
              onClick={triggerJsonExport}
              title="Download forensic JSON payload"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                color: '#e2e8f0',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <FileCode size={13} />
              <span>JSON</span>
            </button>
            <button
              onClick={handleClear}
              disabled={clearing}
              title="Clear all forensic access logs"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'rgba(127, 29, 29, 0.3)',
                border: '1px solid #991b1b',
                color: '#fca5a5',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Trash2 size={13} />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Evidence Table */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 24px',
            backgroundColor: '#090d16',
          }}
        >
          {filteredRecords.length === 0 ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: '#64748b',
                backgroundColor: '#0f172a',
                borderRadius: '12px',
                border: '1px dashed #334155',
              }}
            >
              <ShieldAlert size={36} color="#64748b" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>{t('sec.noRecords')}</div>
              <div style={{ fontSize: '12px', marginTop: '6px' }}>
                Open any link to this portal from any phone, computer, or network to record telemetry.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredRecords.map((rec) => {
                const isSuspect = rec.network.isVpnOrProxy;
                const dateStr = new Date(rec.timestamp).toLocaleString();
                const mapUrl =
                  rec.network.lat && rec.network.lon
                    ? `https://www.google.com/maps/search/?api=1&query=${rec.network.lat},${rec.network.lon}`
                    : null;

                return (
                  <div
                    key={rec.id}
                    style={{
                      padding: '14px 18px',
                      backgroundColor: isSuspect ? 'rgba(30, 16, 20, 0.7)' : 'rgba(15, 23, 42, 0.6)',
                      border: isSuspect ? '1.5px solid #dc2626' : '1px solid #1e293b',
                      borderRadius: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      transition: 'all 0.15s ease-in-out',
                    }}
                  >
                    {/* Top row: IP, Flags, Timestamp */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '15px',
                            fontWeight: 800,
                            color: isSuspect ? '#fca5a5' : '#38bdf8',
                            backgroundColor: '#020617',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #334155',
                          }}
                        >
                          {rec.clientIp}
                        </span>

                        {isSuspect ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 800,
                              color: '#fee2e2',
                              backgroundColor: '#991b1b',
                              padding: '3px 9px',
                              borderRadius: '999px',
                            }}
                          >
                            <AlertTriangle size={12} /> VPN / PROXY / CLOUD DETECTED
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#6ee7b7',
                              backgroundColor: 'rgba(6, 78, 59, 0.6)',
                              padding: '3px 9px',
                              borderRadius: '999px',
                            }}
                          >
                            <CheckCircle2 size={12} /> DIRECT CARRIER / ISP
                          </span>
                        )}

                        
                        {(rec as any).user && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 800,
                              color: '#6ee7b7',
                              backgroundColor: 'rgba(6, 78, 59, 0.65)',
                              padding: '3px 8px',
                              borderRadius: '999px',
                              border: '1px solid #10b981',
                            }}
                          >
                            🔑 LOGGED IN: {(rec as any).user.name} {((rec as any).user.email ? `(${(rec as any).user.email})` : `(${(rec as any).user.provider || 'direct'})`)}
                          </span>
                        )}

                        {rec.device.isMobile && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#d8b4fe',
                              backgroundColor: 'rgba(88, 28, 135, 0.5)',
                              padding: '3px 8px',
                              borderRadius: '999px',
                            }}
                          >
                            <Smartphone size={11} /> MOBILE DEVICE
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#94a3b8' }}>
                        <Clock size={13} />
                        <span>{dateStr}</span>
                      </div>
                    </div>

                    {/* Middle row: Geolocation, ISP, Device info */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '10px',
                        fontSize: '12px',
                        backgroundColor: 'rgba(2, 6, 23, 0.4)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                      }}
                    >
                      {/* Location & Map Pin */}
                      <div>
                        <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, marginBottom: '2px' }}>
                          GEOGRAPHIC LOCATION
                        </div>
                        <div style={{ fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>
                            {rec.network.city}, {rec.network.region}, {rec.network.country}
                          </span>
                          {mapUrl && (
                            <a
                              href={mapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open exact GPS coordinates in Google Maps"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                color: '#38bdf8',
                                textDecoration: 'none',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                              }}
                            >
                              <MapPin size={11} />
                              <span>{t('sec.viewMap')}</span>
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                        {rec.network.lat && rec.network.lon && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace' }}>
                            Lat: {rec.network.lat.toFixed(4)}°, Lon: {rec.network.lon.toFixed(4)}°
                          </div>
                        )}
                      </div>

                      {/* ISP & ASN */}
                      <div>
                        <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, marginBottom: '2px' }}>
                          NETWORK PROVIDER / ASN
                        </div>
                        <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{rec.network.isp || 'Standard Carrier'}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                          {rec.network.asn || rec.network.org || 'Route Direct'}
                        </div>
                        {rec.network.vpnIndicators && rec.network.vpnIndicators.length > 0 && (
                          <div style={{ fontSize: '11px', color: '#f87171', marginTop: '3px', fontWeight: 600 }}>
                            Indicator: {rec.network.vpnIndicators.join(', ')}
                          </div>
                        )}
                      </div>

                      {/* Device & Hardware */}
                      <div>
                        <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, marginBottom: '2px' }}>
                          DEVICE & PLATFORM
                        </div>
                        <div style={{ fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {rec.device.isMobile ? <Smartphone size={13} color="#a855f7" /> : <Laptop size={13} color="#38bdf8" />}
                          <span>{rec.device.os} · {rec.device.browser}</span>
                        </div>
                        {rec.clientTelemetry?.screen && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            Screen: {rec.clientTelemetry.screen} {rec.clientTelemetry?.timezone ? `· ${rec.clientTelemetry.timezone}` : ''}
                          </div>
                        )}
                        {rec.clientTelemetry?.webRtcIps && rec.clientTelemetry.webRtcIps.length > 0 && (
                          <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '3px', fontFamily: 'monospace' }}>
                            WebRTC Leaked IP: {rec.clientTelemetry.webRtcIps.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom: URL Link opened & Referrer */}
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '6px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        paddingTop: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', wordBreak: 'break-all' }}>
                        <span style={{ fontWeight: 700, color: '#94a3b8' }}>Link Opened:</span>
                        <code style={{ color: '#38bdf8', backgroundColor: '#020617', padding: '1px 6px', borderRadius: '4px' }}>
                          {rec.fullUrl}
                        </code>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, color: '#94a3b8' }}>Referrer:</span>
                        <span>{rec.referrer}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Legal & Police Verification Notice */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: '#050912',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '11.5px',
            color: '#64748b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldAlert size={14} color="#ef4444" />
            <span>{t('sec.legalNotice')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Seva·GIS Security Engine v1.0</span>
            <span>·</span>
            <span>SHA-256 Validated</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityBreachAuditModal;

