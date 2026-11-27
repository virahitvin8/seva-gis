import test from 'node:test';
import assert from 'node:assert/strict';
import { compareSemver, isNewerBuild, type BuildIdentity } from '../../services/appUpdateService';

const baseCurrent: BuildIdentity = {
  version: '4.4.0',
  commit: 'abc1234',
  buildNumber: 44,
  buildDate: '2026-11-27T18:00:00Z',
  apkVersionCode: 44,
};

test('compareSemver orders semantic versions correctly', () => {
  assert.equal(compareSemver('4.4.1', '4.4.0'), 1);
  assert.equal(compareSemver('4.5.0', '4.4.9'), 1);
  assert.equal(compareSemver('v4.4.0', '4.4.0'), 0);
  assert.equal(compareSemver('4.3.0', '4.4.0'), -1);
});

test('isNewerBuild detects git commit change on website deploy', () => {
  const res = isNewerBuild(
    {
      version: '4.4.0',
      commit: 'def5678',
      buildNumber: 44,
      buildDate: '2026-11-27T18:05:00Z',
      apkVersionCode: 44,
    },
    baseCurrent
  );
  assert.equal(res.hasUpdate, true);
  assert.equal(res.hasNewerApk, false);
});

test('isNewerBuild detects buildNumber increment and newer APK versionCode', () => {
  const res = isNewerBuild(
    {
      version: '4.4.0',
      commit: 'abc1234',
      buildNumber: 45,
      buildDate: '2026-11-27T18:05:00Z',
      apkVersionCode: 45,
    },
    baseCurrent
  );
  assert.equal(res.hasUpdate, true);
  assert.equal(res.hasNewerApk, true);
});

test('isNewerBuild returns false when remote matches current or was already applied', () => {
  const same = isNewerBuild(
    {
      version: '4.4.0',
      commit: 'abc1234',
      buildNumber: 44,
      buildDate: '2026-11-27T18:00:00Z',
      apkVersionCode: 44,
    },
    baseCurrent
  );
  assert.equal(same.hasUpdate, false);

  const alreadyApplied = isNewerBuild(
    {
      version: '4.4.0',
      commit: 'def5678',
      buildNumber: 45,
      buildDate: '2026-11-27T18:05:00Z',
      apkVersionCode: 44,
    },
    baseCurrent,
    'def5678'
  );
  assert.equal(alreadyApplied.hasUpdate, false);
});

