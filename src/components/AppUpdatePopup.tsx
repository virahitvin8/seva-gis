import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, X, Download, CheckCircle2 } from 'lucide-react';
import { appUpdateService, type AppVersionInfo } from '../services/appUpdateService';
import { useI18n } from '../lib/i18n';

const AUTO_UPDATE_SECONDS = 5;

export default function AppUpdatePopup() {
  const { t } = useI18n();
  const [updateInfo, setUpdateInfo] = useState<AppVersionInfo | null>(null);
  const [countdown, setCountdown] = useState<number>(AUTO_UPDATE_SECONDS);
  const [paused, setPaused] = useState<boolean>(false);
  const [applying, setApplying] = useState<boolean>(false);

  useEffect(() => {
    const handleEvent = (ev: Event) => {
      const detail = (ev as CustomEvent<AppVersionInfo>).detail;
      if (detail) {
        setUpdateInfo(detail);
        setCountdown(AUTO_UPDATE_SECONDS);
        setPaused(false);
        setApplying(false);
      }
    };

    window.addEventListener('seva:update-available', handleEvent);
    const unsub = appUpdateService.onUpdateAvailable((info) => {
      setUpdateInfo(info);
      setCountdown(AUTO_UPDATE_SECONDS);
      setPaused(false);
      setApplying(false);
    });

    return () => {
      window.removeEventListener('seva:update-available', handleEvent);
      unsub();
    };
  }, []);

  // Automatic update countdown so mobile APK & web users update seamlessly
  useEffect(() => {
    if (!updateInfo || paused || applying) return;
    if (countdown <= 0) {
      void handleApplyNow();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [updateInfo, paused, applying, countdown]);

  const handleApplyNow = async () => {
    if (applying) return;
    setApplying(true);
    await appUpdateService.applyUpdate(updateInfo);
  };

  const handleDismiss = () => {
    setPaused(true);
    if (updateInfo) {
      appUpdateService.dismissCurrentUpdate(updateInfo);
    }
    setUpdateInfo(null);
  };

  if (!updateInfo) return null;

  const progressPct = applying
    ? 100
    : Math.round(((AUTO_UPDATE_SECONDS - countdown) / AUTO_UPDATE_SECONDS) * 100);

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('update.title')}
      className="fixed bottom-20 sm:bottom-5 right-3 left-3 sm:left-auto sm:w-[400px] z-[9999] rounded-2xl border border-emerald-400/50 bg-[#07110c]/95 text-slate-100 shadow-2xl backdrop-blur-xl p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-[#b6f36a] shrink-0">
            {applying ? <CheckCircle2 size={18} /> : <Sparkles size={18} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white leading-tight">{t('update.title')}</h3>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-mono font-bold text-[#b6f36a]">
                v{updateInfo.version}
                {updateInfo.commit ? ` · ${updateInfo.commit.slice(0, 7)}` : ''}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {applying
                ? t('update.applying')
                : paused
                  ? t('update.subtitle')
                  : `${t('update.autoIn')} ${countdown}s`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t('common.close')}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {Array.isArray(updateInfo.changelog) && updateInfo.changelog.length > 0 && (
        <ul className="mt-2.5 space-y-1 text-[11px] text-slate-300 bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 max-h-24 overflow-y-auto">
          {updateInfo.changelog.slice(0, 3).map((item, idx) => (
            <li key={idx} className="flex items-start gap-1.5">
              <span className="text-[#b6f36a] mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-[#b6f36a] transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {!applying && !paused && (
          <button
            type="button"
            onClick={() => setPaused(true)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-300 border border-slate-700 hover:bg-slate-800 cursor-pointer"
          >
            {t('update.later')}
          </button>
        )}

        {updateInfo.hasNewerApk && updateInfo.apkDownloadUrl && (
          <a
            href={updateInfo.apkDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 flex items-center gap-1"
          >
            <Download size={13} />
            <span>{t('update.getApk')}</span>
          </a>
        )}

        <button
          type="button"
          onClick={() => void handleApplyNow()}
          disabled={applying}
          className="px-4 py-1.5 rounded-full text-xs font-bold bg-[#b6f36a] hover:bg-[#c5dda0] text-[#07110c] flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-60"
        >
          <RefreshCw size={13} className={applying ? 'animate-spin' : ''} />
          <span>{applying ? t('update.applying') : t('update.now')}</span>
        </button>
      </div>
    </div>
  );
}

