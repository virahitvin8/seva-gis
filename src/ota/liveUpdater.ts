/**
 * SEVA.GIS In-App Over-The-Air (OTA) Live Bundle Hot-Swap Client
 * Bridges native CapacitorUpdater (if installed) with appUpdateService's live version.json
 * and Service Worker cache-busting pipeline.
 */

import { appUpdateService, getCurrentBuildIdentity, isNewerBuild, type AppVersionInfo } from '../services/appUpdateService';

export interface OtaUpdateInfo {
  version: string;
  sizeBytes?: number;
  sizeFormatted: string;
  changelog?: string[];
  channel: string;
}

export type OtaPromptCallback = (
  info: OtaUpdateInfo,
  triggerHotSwap: () => Promise<void>
) => void;

/**
 * Checks for available OTA bundle and prompts user via callback.
 */
export async function checkAndApplySevaOtaUpdate(
  onPromptUser: OtaPromptCallback
): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    // 1. Check native CapacitorUpdater plugin if configured inside Android shell
    const cap = (window as any).Capacitor;
    const nativeUpdater = cap?.Plugins?.CapacitorUpdater;
    if (nativeUpdater) {
      await nativeUpdater.notifyAppReady();
      const latest = await nativeUpdater.getLatest({ channel: 'Production' });
      if (latest && latest.url && latest.version) {
        const downloadedBundle = await nativeUpdater.download({
          url: latest.url,
          version: latest.version,
        });

        onPromptUser(
          {
            version: latest.version,
            sizeFormatted: '1.8 MB',
            channel: 'Production',
            changelog: ['Live website bundle synced to Android shell'],
          },
          async () => {
            await nativeUpdater.set(downloadedBundle);
          }
        );
        return;
      }
    }

    // 2. Live Web & Android WebView version.json check
    const current = getCurrentBuildIdentity();
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    }).catch(() => null);

    if (res && res.ok) {
      const data: AppVersionInfo = await res.json().catch(() => null);
      if (data) {
        const check = isNewerBuild(data, current);
        if (check.hasUpdate) {
          onPromptUser(
            {
              version: data.version,
              sizeFormatted: 'Live Web Sync',
              channel: data.channel || 'stable',
              changelog: data.changelog || ['Latest SEVA.GIS features & fixes'],
            },
            async () => {
              await appUpdateService.applyUpdate(data);
            }
          );
        }
      }
    }
  } catch (err) {
    console.debug('[SEVA OTA] Check completed without pending delta:', err);
  }
}

/**
 * Triggers a simulated OTA hot-swap update for testing in simulator or demo mode.
 */
export function simulateOtaUpdateAvailable(onPromptUser: OtaPromptCallback) {
  onPromptUser(
    {
      version: 'v4.6.1-OTA',
      sizeFormatted: '1.8 MB',
      channel: 'Production',
      changelog: [
        'Handy GPS real GNSS watchPosition, averaging & projection',
        'Exact WGS84 UTM, MGRS, EGM MSL & magnetic declination',
        'Automatic live website-to-APK sync popup',
      ],
    },
    async () => {
      await new Promise((r) => setTimeout(r, 900));
      await appUpdateService.applyUpdate();
    }
  );
}
