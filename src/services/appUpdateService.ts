/**
 * SEVA.GIS Mobile & Web Live Auto-Update Service
 * Continuously polls for new versions, handles Service Worker updates,
 * and enables seamless zero-downtime updates for Android (Capacitor) & PWA.
 */

export interface AppVersionInfo {
  version: string;
  buildDate: string;
  buildNumber: number;
  channel: string;
  appName: string;
  author: string;
  changelog: string[];
}

export type UpdateCallback = (info: AppVersionInfo) => void;

class AppUpdateService {
  private currentVersion = '1.0.0';
  private registration: ServiceWorkerRegistration | null = null;
  private listeners: UpdateCallback[] = [];
  private checkInterval: any = null;

  constructor() {
    this.init();
  }

  public init() {
    if (typeof window === 'undefined') return;

    // Register Service Worker in production and mobile WebView
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            this.registration = reg;

            // Check if there's already a worker waiting
            if (reg.waiting) {
              this.notifyUpdateAvailable({
                version: '1.0.1',
                buildDate: new Date().toISOString(),
                buildNumber: Date.now(),
                channel: 'stable',
                appName: 'SEVA.GIS',
                author: 'N. Akshit Vinay',
                changelog: ['New build ready to activate with enhanced performance'],
              });
            }

            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    this.checkForRemoteVersion();
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
      });
    }

    // Periodic remote check (every 10 minutes) + on window focus
    this.checkInterval = setInterval(() => this.checkForRemoteVersion(), 10 * 60 * 1000);
    window.addEventListener('focus', () => this.checkForRemoteVersion());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkForRemoteVersion();
      }
    });

    // Check shortly after boot
    setTimeout(() => this.checkForRemoteVersion(), 5000);
  }

  /**
   * Poll remote version.json to check for new releases
   */
  public async checkForRemoteVersion(): Promise<AppVersionInfo | null> {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;

      const remoteInfo: AppVersionInfo = await res.json();
      if (remoteInfo.version && remoteInfo.version !== this.currentVersion) {
        this.notifyUpdateAvailable(remoteInfo);
        return remoteInfo;
      }
    } catch {
      // Offline or network error - fails gracefully
    }
    return null;
  }

  public onUpdateAvailable(callback: UpdateCallback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  public applyUpdate() {
    if (this.registration && this.registration.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  }

  private notifyUpdateAvailable(info: AppVersionInfo) {
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
    return this.currentVersion;
  }
}

export const appUpdateService = new AppUpdateService();
export default appUpdateService;
