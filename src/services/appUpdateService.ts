/**
 * SEVA.GIS Mobile & Web Live Auto-Update Service
 * Continuously checks version.json (origin + live sevagis.dpdns.org), Service Worker updates,
 * and GitHub Latest Releases so website changes pushed to Git automatically notify & update
 * mobile APK and web users in-place.
 */

export interface AppVersionInfo {
  version: string;
  buildDate: string;
  buildNumber: number;
  commit?: string;
  channel: string;
  appName: string;
  author: string;
  changelog: string[];
  apkVersionCode?: number;
  apkDownloadUrl?: string;
  releaseTag?: string;
  hasNewerApk?: boolean;
  source?: 'sw' | 'remote' | 'github-release';
}

export interface BuildIdentity {
  version: string;
  commit: string;
  buildNumber: number;
  buildDate: string;
  apkVersionCode: number;
}

export type UpdateCallback = (info: AppVersionInfo) => void;

export const LIVE_SITE_ORIGIN = 'https://sevagis.dpdns.org';
export const DEFAULT_APK_RELEASE_URL =
  'https://github.com/virahitvin8/seva-gis/releases/latest/download/seva-gis-latest.apk';

const APPLIED_COMMIT_KEY = 'seva_applied_commit';
const DISMISSED_KEY = 'seva_dismissed_update_key';

export function getCurrentBuildIdentity(): BuildIdentity {
  const version =
    typeof __SEVA_APP_VERSION__ !== 'undefined' ? __SEVA_APP_VERSION__ : '4.4.0';
  const commit =
    typeof __SEVA_BUILD_COMMIT__ !== 'undefined' ? __SEVA_BUILD_COMMIT__ : 'local';
  const buildNumber =
    typeof __SEVA_BUILD_NUMBER__ !== 'undefined' ? Number(__SEVA_BUILD_NUMBER__) : 44;
  const buildDate =
    typeof __SEVA_BUILD_DATE__ !== 'undefined'
      ? __SEVA_BUILD_DATE__
      : '2026-11-27T18:00:00Z';
  const apkVersionCode =
    typeof __SEVA_APK_VERSION_CODE__ !== 'undefined'
      ? Number(__SEVA_APK_VERSION_CODE__)
      : 44;
  return { version, commit, buildNumber, buildDate, apkVersionCode };
}

/**
 * Compares two semver strings like "4.4.1" vs "4.4.0".
 */
export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

/**
 * Determines whether remote version.json represents a newer build than current.
 */
export function isNewerBuild(
  remote: Partial<AppVersionInfo>,
  current: BuildIdentity,
  appliedCommit?: string | null
): { hasUpdate: boolean; hasNewerApk: boolean; updateKey: string } {
  const remoteVer = (remote.version || '').trim();
  const remoteCommit = (remote.commit || '').trim().slice(0, 7);
  const currentCommit = (current.commit || '').trim().slice(0, 7);
  const remoteBuildNum = Number(remote.buildNumber || 0);
  const remoteApkCode = Number(remote.apkVersionCode || 0);

  const hasNewerApk =
    remoteApkCode > 0 && current.apkVersionCode > 0 && remoteApkCode > current.apkVersionCode;

  const updateKey = `${remoteVer}:${remoteCommit || remoteBuildNum}`;
  if (appliedCommit && remoteCommit && appliedCommit === remoteCommit) {
    return { hasUpdate: hasNewerApk, hasNewerApk, updateKey };
  }

  const semverNewer = Boolean(remoteVer && compareSemver(remoteVer, current.version) > 0);
  const buildNumNewer = remoteBuildNum > 0 && current.buildNumber > 0 && remoteBuildNum > current.buildNumber;
  const commitChanged = Boolean(
    remoteCommit &&
    currentCommit &&
    remoteCommit !== 'local' &&
    remoteCommit !== 'dev' &&
    currentCommit !== 'local' &&
    currentCommit !== 'dev' &&
    remoteCommit !== currentCommit
  );

  // Guard against showing an older remote cache when current local build is ahead
  const remoteDateMs = remote.buildDate ? Date.parse(remote.buildDate) : NaN;
  const currentDateMs = current.buildDate ? Date.parse(current.buildDate) : NaN;
  const remoteIsOlder =
    Number.isFinite(remoteDateMs) &&
    Number.isFinite(currentDateMs) &&
    remoteDateMs + 10000 < currentDateMs &&
    !semverNewer &&
    !buildNumNewer;

  const hasUpdate = !remoteIsOlder && (semverNewer || buildNumNewer || commitChanged || hasNewerApk);
  return { hasUpdate, hasNewerApk, updateKey };
}

class AppUpdateService {
  private registration: ServiceWorkerRegistration | null = null;
  private listeners: UpdateCallback[] = [];
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private lastNotifiedKey: string | null = null;
  private isInitialized = false;

  constructor() {
    this.init();
  }

  public init() {
    if (typeof window === 'undefined' || this.isInitialized) return;
    this.isInitialized = true;

    // Register Service Worker in browser & WebView
    if ('serviceWorker' in navigator) {
      const registerSw = () => {
        navigator.serviceWorker
          .register('/sw.js', { updateViaCache: 'none' })
          .then((reg) => {
            this.registration = reg;
            reg.update().catch(() => { });

            if (reg.waiting) {
              this.checkForRemoteVersion(true);
            }

            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    this.checkForRemoteVersion(true);
                  }
                });
              }
            });
          })
          .catch((err) => {
            console.debug('[AppUpdate] ServiceWorker registration skipped:', err?.message || err);
          });

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });
      };

      if (document.readyState === 'complete') {
        registerSw();
      } else {
        window.addEventListener('load', registerSw, { once: true });
      }
    }

    // Poll every 3 minutes + on window focus/online/visibility
    this.checkInterval = setInterval(() => void this.checkForRemoteVersion(), 3 * 60 * 1000);
    window.addEventListener('focus', () => void this.checkForRemoteVersion());
    window.addEventListener('online', () => void this.checkForRemoteVersion());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.checkForRemoteVersion();
      }
    });

    // Initial check shortly after boot
    setTimeout(() => void this.checkForRemoteVersion(), 2500);
  }

  /**
   * Poll version.json (origin + live site if running inside local offline Capacitor shell)
   * and check for Service Worker updates.
   */
  public async checkForRemoteVersion(forceSwNotification = false): Promise<AppVersionInfo | null> {
    if (typeof window === 'undefined') return null;
    const current = getCurrentBuildIdentity();
    const appliedCommit = (() => {
      try { return localStorage.getItem(APPLIED_COMMIT_KEY); } catch { return null; }
    })();

    const candidateUrls = [`/version.json?t=${Date.now()}`];
    if (window.location.origin !== LIVE_SITE_ORIGIN && window.location.hostname !== 'localhost') {
      // Same-origin already points to deployed host
    } else if (window.location.hostname === 'localhost' && (window as any).Capacitor) {
      candidateUrls.push(`${LIVE_SITE_ORIGIN}/version.json?t=${Date.now()}`);
    }

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) continue;

        const remoteInfo: AppVersionInfo = await res.json();
        const check = isNewerBuild(remoteInfo, current, appliedCommit);

        if (check.hasUpdate || forceSwNotification) {
          const dismissedKey = (() => {
            try { return sessionStorage.getItem(DISMISSED_KEY); } catch { return null; }
          })();
          if (!forceSwNotification && dismissedKey === check.updateKey) {
            return null;
          }
          if (this.lastNotifiedKey === check.updateKey && !forceSwNotification) {
            return remoteInfo;
          }
          this.lastNotifiedKey = check.updateKey;
          const enriched: AppVersionInfo = {
            ...remoteInfo,
            hasNewerApk: check.hasNewerApk,
            apkDownloadUrl: remoteInfo.apkDownloadUrl || DEFAULT_APK_RELEASE_URL,
            source: forceSwNotification ? 'sw' : 'remote',
          };
          this.notifyUpdateAvailable(enriched);
          return enriched;
        }
      } catch {
        // Offline or network error - fails gracefully
      }
    }

    if (forceSwNotification) {
      const fallbackInfo: AppVersionInfo = {
        version: current.version,
        buildDate: new Date().toISOString(),
        buildNumber: current.buildNumber + 1,
        commit: 'latest',
        channel: 'stable',
        appName: 'SEVA.GIS',
        author: 'N. Akshit Vinay',
        apkVersionCode: current.apkVersionCode,
        apkDownloadUrl: DEFAULT_APK_RELEASE_URL,
        changelog: ['Updated web bundle ready to activate'],
        source: 'sw',
      };
      this.notifyUpdateAvailable(fallbackInfo);
      return fallbackInfo;
    }

    return null;
  }

  public onUpdateAvailable(callback: UpdateCallback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  public dismissCurrentUpdate(info: AppVersionInfo) {
    const key = `${info.version}:${(info.commit || '').slice(0, 7) || info.buildNumber}`;
    try {
      sessionStorage.setItem(DISMISSED_KEY, key);
    } catch { }
  }

  /**
   * Clears stale Service Worker caches, activates waiting SW, and reloads into the newest build.
   */
  public async applyUpdate(info?: AppVersionInfo | null): Promise<void> {
    try {
      if (info?.commit) {
        localStorage.setItem(APPLIED_COMMIT_KEY, info.commit.slice(0, 7));
      }
    } catch { }

    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch { }

    try {
      if (this.registration) {
        await this.registration.update();
        const target = this.registration.waiting || this.registration.active;
        target?.postMessage({ type: 'CLEAR_ALL_CACHES' });
        if (this.registration.waiting) {
          this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }
    } catch { }

    // If running inside offline Capacitor localhost while online, navigate to live site URL
    if (
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost' &&
      (window as any).Capacitor &&
      navigator.onLine
    ) {
      window.location.href = `${LIVE_SITE_ORIGIN}/?updated=${Date.now()}`;
      return;
    }

    if (typeof window !== 'undefined') {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('v', String(info?.buildNumber || Date.now()));
      window.location.replace(nextUrl.toString());
    }
  }

  private notifyUpdateAvailable(info: AppVersionInfo) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('seva:update-available', {
        detail: info,
      })
    );
    this.listeners.forEach((cb) => {
      try {
        cb(info);
      } catch (err) {
        console.warn('[AppUpdate] Callback error:', err);
      }
    });
  }

  public getVersion(): string {
    return getCurrentBuildIdentity().version;
  }

  public getBuildIdentity(): BuildIdentity {
    return getCurrentBuildIdentity();
  }
}

export const appUpdateService = new AppUpdateService();
export default appUpdateService;
