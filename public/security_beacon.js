/**
 * SEVA·GIS FORENSIC CLIENT BEACON
 * ================================
 * Purpose: Collects hardware, network, WebRTC, and browser identifiers to de-cloak
 * unauthorized access or correlate devices used by visitors.
 * Runs completely asynchronously without disrupting UI or user experience.
 */
(function() {
  'use strict';

  async function collectTelemetry() {
    const data = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer || null,
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
        colorDepth: window.screen.colorDepth,
        pixelRatio: window.devicePixelRatio || 1,
        orientation: window.screen.orientation ? window.screen.orientation.type : null,
      },
      navigator: {
        language: navigator.language,
        languages: navigator.languages ? Array.from(navigator.languages) : [],
        hardwareConcurrency: navigator.hardwareConcurrency || null,
        deviceMemory: navigator.deviceMemory || null,
        maxTouchPoints: navigator.maxTouchPoints || 0,
        platform: navigator.platform || null,
        userAgent: navigator.userAgent,
      },
      timezone: {
        name: Intl.DateTimeFormat().resolvedOptions().timeZone,
        offsetMinutes: new Date().getTimezoneOffset(),
      },
      webgl: getWebGLFingerprint(),
      canvasHash: getCanvasFingerprint(),
      webrtc: await getWebRTCLeak(),
      battery: await getBatteryStatus(),
    };

    // Dispatch beacon to backend server
    const endpoint = '/api/security/telemetry-beacon';
    const payload = JSON.stringify(data);

    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, payload);
    } else {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  }

  function getWebGLFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return { supported: false };

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        supported: true,
        vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      };
    } catch (e) {
      return { supported: false, error: e.message };
    }
  }

  function getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 50;
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = "14px 'Arial'";
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('SEVA·GIS·FORENSIC', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('SEVA·GIS·FORENSIC', 4, 17);
      
      const dataUrl = canvas.toDataURL();
      // Simple DJB2-like string hash
      let hash = 0;
      for (let i = 0; i < dataUrl.length; i++) {
        hash = ((hash << 5) - hash) + dataUrl.charCodeAt(i);
        hash |= 0;
      }
      return 'cv_' + Math.abs(hash).toString(16);
    } catch (e) {
      return null;
    }
  }

  function getWebRTCLeak() {
    return new Promise((resolve) => {
      const candidateIps = new Set();
      try {
        const RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
        if (!RTCPeerConnection) {
          resolve({ candidateIps: [] });
          return;
        }

        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        pc.createDataChannel('');

        pc.onicecandidate = (event) => {
          if (!event || !event.candidate) {
            resolve({ candidateIps: Array.from(candidateIps) });
            return;
          }
          const candidate = event.candidate.candidate;
          // Match IPv4 addresses
          const match = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
          if (match && match[1]) {
            candidateIps.add(match[1]);
          }
        };

        pc.createOffer().then((offer) => pc.setLocalDescription(offer)).catch(() => resolve({ candidateIps: [] }));

        // Timeout fallback after 1.5 seconds so it doesn't hang
        setTimeout(() => {
          try { pc.close(); } catch(e){}
          resolve({ candidateIps: Array.from(candidateIps) });
        }, 1500);
      } catch (e) {
        resolve({ candidateIps: [], error: e.message });
      }
    });
  }

  function getBatteryStatus() {
    return new Promise((resolve) => {
      if (navigator.getBattery) {
        navigator.getBattery().then((battery) => {
          resolve({
            charging: battery.charging,
            level: battery.level,
            chargingTime: battery.chargingTime,
            dischargingTime: battery.dischargingTime,
          });
        }).catch(() => resolve(null));
      } else {
        resolve(null);
      }
    });
  }

  // Trigger telemetry collection once page loads or becomes visible
  if (document.readyState === 'complete') {
    collectTelemetry();
  } else {
    window.addEventListener('load', () => setTimeout(collectTelemetry, 500));
  }
})();

