import React, { useState, useMemo, useEffect } from 'react'
import {
  MessageSquare, Share2, Send, Phone, Check, Copy, Settings,
  ExternalLink, AlertCircle, CheckCircle2, RefreshCw, Smartphone,
  Globe, Shield, Droplets, CloudRain, ShieldAlert, Sparkles, ChevronDown,
  ChevronUp, History, Terminal
} from 'lucide-react'
import type { FarmData } from '../lib/seva'
import {
  OpenSmsConfig,
  MessageTemplateType,
  AdvisoryLanguage,
  DispatchHistoryRecord,
  getStoredOpenSmsConfig,
  saveStoredOpenSmsConfig,
  getStoredDispatchHistory,
  saveDispatchRecord,
  cleanPhoneNumber,
  generateAdvisoryMessage,
  sendViaOpenSmsGateway,
  getNativeSmsUri,
  getWhatsAppUri
} from '../lib/openSmsGateway'

interface Props {
  farm: FarmData & { id: string; name: string; crop?: string }
}

export default function FarmerSmsWhatsAppDispatch({ farm }: Props) {
  // Recipient numbers
  const [mobileNumber, setMobileNumber] = useState<string>('')
  const [whatsAppNumber, setWhatsAppNumber] = useState<string>('')
  const [farmerName, setFarmerName] = useState<string>('')

  // Template & Language
  const [template, setTemplate] = useState<MessageTemplateType>('crop_health')
  const [language, setLanguage] = useState<AdvisoryLanguage>('en')

  // OpenSMS Config State
  const [config, setConfig] = useState<OpenSmsConfig>(getStoredOpenSmsConfig())
  const [showConfig, setShowConfig] = useState<boolean>(false)
  const [showHistory, setShowHistory] = useState<boolean>(false)
  const [history, setHistory] = useState<DispatchHistoryRecord[]>(getStoredDispatchHistory())

  // UI Feedback
  const [sendingOpenSms, setSendingOpenSms] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [copied, setCopied] = useState<boolean>(false)

  // Generate live message
  const messageText = useMemo(() => {
    return generateAdvisoryMessage(farm, template, language)
  }, [farm, template, language])

  // Character counter
  const charCount = messageText.length
  const segmentCount = Math.ceil(charCount / 160)

  // Sync WhatsApp number from Mobile number
  const handleCopyMobileToWhatsApp = () => {
    setWhatsAppNumber(mobileNumber)
  }

  // Save OpenSMS config changes
  const handleSaveConfig = () => {
    saveStoredOpenSmsConfig(config)
    setStatusMessage({
      type: 'info',
      text: 'OpenSMS Android Gateway settings saved locally!'
    })
    setTimeout(() => setStatusMessage(null), 3500)
  }

  // 1. Dispatch via WhatsApp
  const handleDispatchWhatsApp = () => {
    const targetNumber = cleanPhoneNumber(whatsAppNumber || mobileNumber)
    const url = getWhatsAppUri(targetNumber, messageText)
    window.open(url, '_blank')

    const record: DispatchHistoryRecord = {
      id: Date.now().toString(36),
      timestamp: new Date().toLocaleTimeString(),
      recipientNumber: targetNumber || 'Direct Chat',
      channel: 'whatsapp',
      templateType: template,
      language,
      farmName: farm.name,
      status: 'opened',
      messagePreview: messageText.slice(0, 80) + '...'
    }
    saveDispatchRecord(record)
    setHistory(getStoredDispatchHistory())

    setStatusMessage({
      type: 'success',
      text: `WhatsApp chat opened for ${targetNumber || 'farmer'}. Message pre-filled ready to send!`
    })
    setTimeout(() => setStatusMessage(null), 4000)
  }

  // 2. Dispatch via Native Device SMS (sms: protocol)
  const handleDispatchNativeSms = () => {
    const targetNumber = cleanPhoneNumber(mobileNumber)
    if (!targetNumber) {
      setStatusMessage({
        type: 'error',
        text: 'Please enter a mobile phone number to launch device SMS.'
      })
      return
    }

    const url = getNativeSmsUri(targetNumber, messageText)
    window.location.href = url

    const record: DispatchHistoryRecord = {
      id: Date.now().toString(36),
      timestamp: new Date().toLocaleTimeString(),
      recipientNumber: targetNumber,
      channel: 'nativesms',
      templateType: template,
      language,
      farmName: farm.name,
      status: 'opened',
      messagePreview: messageText.slice(0, 80) + '...'
    }
    saveDispatchRecord(record)
    setHistory(getStoredDispatchHistory())

    setStatusMessage({
      type: 'success',
      text: `Device SMS messenger launched for ${targetNumber}.`
    })
    setTimeout(() => setStatusMessage(null), 4000)
  }

  // 3. Dispatch via OpenSMS Android REST API Gateway
  const handleDispatchOpenSms = async () => {
    const targetNumber = cleanPhoneNumber(mobileNumber)
    if (!targetNumber) {
      setStatusMessage({
        type: 'error',
        text: 'Please enter a valid mobile number for OpenSMS dispatch.'
      })
      return
    }

    setSendingOpenSms(true)
    setStatusMessage({ type: 'info', text: `Contacting OpenSMS gateway at ${config.serverUrl}...` })

    try {
      const res = await sendViaOpenSmsGateway(config, targetNumber, messageText)
      setSendingOpenSms(false)

      const record: DispatchHistoryRecord = {
        id: Date.now().toString(36),
        timestamp: new Date().toLocaleTimeString(),
        recipientNumber: targetNumber,
        channel: 'opensms',
        templateType: template,
        language,
        farmName: farm.name,
        status: 'sent',
        messagePreview: messageText.slice(0, 80) + '...'
      }
      saveDispatchRecord(record)
      setHistory(getStoredDispatchHistory())

      setStatusMessage({
        type: 'success',
        text: `SMS dispatched successfully through your Android phone SIM card via OpenSMS! (${res.message})`
      })
    } catch (err: any) {
      setSendingOpenSms(false)
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to dispatch via OpenSMS.'
      })
    }
  }

  // Copy to clipboard
  const handleCopyMessage = () => {
    navigator.clipboard.writeText(messageText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="ag-card" style={{
      borderRadius: 14,
      border: '1px solid #cbd5e1',
      background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
      padding: '20px',
      marginBottom: '20px',
      boxShadow: '0 4px 20px -2px rgba(0,0,0,0.06)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #16a34a 0%, #0284c7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
          }}>
            <MessageSquare size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                Farmer SMS &amp; WhatsApp Advisory Dispatch
              </h3>
              <span style={{ fontSize: 10, background: '#dcfce7', color: '#15803d', padding: '2px 7px', borderRadius: 6, fontWeight: 700, border: '1px solid #86efac' }}>
                OpenSMS Powered · 100% FREE
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Direct WhatsApp chat, native device SMS, and OpenSMS Android SIM gateway for zero-cost farmer communication
            </div>
          </div>
        </div>

        {/* Action Toggle buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowConfig(!showConfig)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid #cbd5e1', background: showConfig ? '#e2e8f0' : '#ffffff', color: '#334155', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
          >
            <Settings size={13} />
            <span>OpenSMS Gateway Setup</span>
          </button>

          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid #cbd5e1', background: showHistory ? '#e2e8f0' : '#ffffff', color: '#334155', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
          >
            <History size={13} />
            <span>History ({history.length})</span>
          </button>
        </div>
      </div>

      {/* OpenSMS Server Configuration Drawer */}
      {showConfig && (
        <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 10, border: '1px solid #cbd5e1', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
              <Smartphone size={16} color="#0284c7" />
              <span>OpenSMS Android API Gateway Settings</span>
            </div>
            <a
              href="https://github.com/daslearning-org/OpenSMS"
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}
            >
              OpenSMS on GitHub <ExternalLink size={12} />
            </a>
          </div>

          <p style={{ margin: '0 0 12px 0', fontSize: 11.5, color: '#475569', lineHeight: 1.5 }}>
            <b>How it works:</b> Install the free open-source <a href="https://github.com/daslearning-org/OpenSMS/releases" target="_blank" rel="noreferrer" style={{ color: '#0284c7', fontWeight: 600 }}>OpenSMS app</a> on any Android phone with an active SIM card. Launch the app and tap <b>&quot;Start Server&quot;</b>. Enter your phone&apos;s Wi-Fi IP address below (port 9292). SEVA·GIS will route automated SMS through your phone with zero third-party charges!
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                OpenSMS Server URL (HTTP / LAN)
              </label>
              <input
                type="text"
                placeholder="http://192.168.1.100:9292/sms/"
                value={config.serverUrl}
                onChange={e => setConfig({ ...config, serverUrl: e.target.value })}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box' }}
              />
              <span style={{ fontSize: 10, color: '#64748b' }}>Default port: 9292/sms/</span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                API Bearer Token (Optional)
              </label>
              <input
                type="password"
                placeholder="Leave blank or enter token generated by OpenSMS"
                value={config.apiKey}
                onChange={e => setConfig({ ...config, apiKey: e.target.value })}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, boxSizing: 'border-box' }}
              />
              <span style={{ fontSize: 10, color: '#64748b' }}>Stored safely in local browser memory</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleSaveConfig}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6, background: '#0284c7', color: '#fff', border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              <Check size={14} /> Save Gateway Settings
            </button>

            <span style={{ fontSize: 11, color: '#64748b' }}>
              💡 Test CLI command: <code style={{ background: '#e2e8f0', padding: '2px 5px', borderRadius: 4, fontFamily: 'monospace' }}>curl -X POST &apos;{config.serverUrl}&apos; -d &apos;{JSON.stringify({ number: '+919999999999', text: 'SEVA GIS Test' })}&apos;</code>
            </span>
          </div>
        </div>
      )}

      {/* Recipient Details & Controls Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 14 }}>
        {/* Mobile Number for SMS */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
            <Phone size={13} color="#0284c7" />
            <span>Mobile Number (for SMS &amp; OpenSMS)</span>
          </label>
          <input
            type="tel"
            placeholder="+91 98765 43210"
            value={mobileNumber}
            onChange={e => setMobileNumber(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box', fontWeight: 600 }}
          />
          <span style={{ fontSize: 10, color: '#64748b' }}>Auto-formats to international E.164 (+91)</span>
        </div>

        {/* WhatsApp Number */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
              <Share2 size={13} color="#22c55e" />
              <span>WhatsApp Number</span>
            </label>
            <button
              onClick={handleCopyMobileToWhatsApp}
              style={{ background: 'none', border: 'none', color: '#16a34a', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              Same as Mobile
            </button>
          </div>
          <input
            type="tel"
            placeholder="+91 98765 43210"
            value={whatsAppNumber}
            onChange={e => setWhatsAppNumber(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box', fontWeight: 600 }}
          />
          <span style={{ fontSize: 10, color: '#64748b' }}>Opens direct chat with pre-filled advisory</span>
        </div>

        {/* Template Selector */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
            Advisory Topic / Template
          </label>
          <select
            value={template}
            onChange={e => setTemplate(e.target.value as MessageTemplateType)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, background: '#fff', boxSizing: 'border-box', fontWeight: 600 }}
          >
            <option value="crop_health">🌾 Crop Health &amp; Vigour (NDVI)</option>
            <option value="irrigation">💧 Irrigation &amp; Soil Moisture (NDMI)</option>
            <option value="weather_alert">🌦️ Weather &amp; Spray Timing Alert</option>
            <option value="pmfby_claim">🛡️ PMFBY Insurance Damage Evidence</option>
          </select>
          <span style={{ fontSize: 10, color: '#64748b' }}>Grounded in current Sentinel-2 scene</span>
        </div>

        {/* Language Selector */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
            <Globe size={13} color="#6366f1" />
            <span>Advisory Language</span>
          </label>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value as AdvisoryLanguage)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, background: '#fff', boxSizing: 'border-box', fontWeight: 600 }}
          >
            <option value="en">English (Universal)</option>
            <option value="te">Telugu (తెలుగు - ఆంధ్రప్రదేశ్ &amp; తెలంగాణ)</option>
            <option value="hi">Hindi (हिन्दी - उत्तर भारत)</option>
          </select>
          <span style={{ fontSize: 10, color: '#64748b' }}>Native Unicode script formatting</span>
        </div>
      </div>

      {/* Live Preview Box */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>
            Live Advisory Preview
          </span>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            {charCount} characters · <b>{segmentCount} SMS segment{segmentCount > 1 ? 's' : ''}</b>
          </span>
        </div>

        <div style={{ position: 'relative' }}>
          <textarea
            readOnly
            value={messageText}
            rows={5}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#0f172a',
              fontSize: 12,
              lineHeight: 1.5,
              boxSizing: 'border-box',
              resize: 'vertical',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          />
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          marginBottom: 14,
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: statusMessage.type === 'success' ? '#f0fdf4' : statusMessage.type === 'error' ? '#fef2f2' : '#eff6ff',
          color: statusMessage.type === 'success' ? '#166534' : statusMessage.type === 'error' ? '#991b1b' : '#1e40af',
          border: `1px solid ${statusMessage.type === 'success' ? '#bbf7d0' : statusMessage.type === 'error' ? '#fecaca' : '#bfdbfe'}`
        }}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Dispatch Action Buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* WhatsApp Button */}
        <button
          onClick={handleDispatchWhatsApp}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '8px 16px',
            borderRadius: 8,
            background: '#22c55e',
            color: '#fff',
            border: 'none',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(34, 197, 94, 0.3)'
          }}
        >
          <Share2 size={16} /> Send via WhatsApp
        </button>

        {/* Native Device SMS Button */}
        <button
          onClick={handleDispatchNativeSms}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '8px 16px',
            borderRadius: 8,
            background: '#0284c7',
            color: '#fff',
            border: 'none',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
          }}
        >
          <Smartphone size={16} /> Open Device SMS
        </button>

        {/* OpenSMS Automated Android Gateway Button */}
        <button
          onClick={handleDispatchOpenSms}
          disabled={sendingOpenSms}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '8px 16px',
            borderRadius: 8,
            background: sendingOpenSms ? '#94a3b8' : '#0f172a',
            color: '#fff',
            border: 'none',
            fontWeight: 700,
            fontSize: 13,
            cursor: sendingOpenSms ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 6px rgba(15, 23, 42, 0.25)'
          }}
        >
          {sendingOpenSms ? <RefreshCw size={15} className="spin" /> : <Send size={15} />}
          <span>Send via OpenSMS (Android)</span>
        </button>

        {/* Copy Text Button */}
        <button
          onClick={handleCopyMessage}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 8,
            background: '#fff',
            color: '#334155',
            border: '1px solid #cbd5e1',
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
            marginLeft: 'auto'
          }}
        >
          {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
          <span>{copied ? 'Copied!' : 'Copy Text'}</span>
        </button>
      </div>

      {/* History Drawer */}
      {showHistory && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <History size={14} /> Recent Dispatch Log
          </div>
          {history.length === 0 ? (
            <div style={{ fontSize: 11.5, color: '#94a3b8', fontStyle: 'italic' }}>
              No messages dispatched yet. Messages sent via WhatsApp, Device SMS, or OpenSMS will appear here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
              {history.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 11 }}>
                  <div>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{item.recipientNumber}</span>
                    <span style={{ color: '#64748b', marginLeft: 8 }}>({item.farmName})</span>
                    <span style={{ color: '#94a3b8', marginLeft: 8 }}>{item.messagePreview}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 9.5,
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontWeight: 700,
                      background: item.channel === 'whatsapp' ? '#dcfce7' : item.channel === 'opensms' ? '#ede9fe' : '#e0f2fe',
                      color: item.channel === 'whatsapp' ? '#15803d' : item.channel === 'opensms' ? '#6d28d9' : '#0369a1'
                    }}>
                      {item.channel.toUpperCase()}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: 10 }}>{item.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
