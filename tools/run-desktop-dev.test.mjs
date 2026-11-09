import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProfile } from './run-desktop-dev.mjs';
const valid = () => ({ platform: ['OSX'], expires: '2099-01-01T00:00:00Z', devices: ['mac'], certificates: ['cert'],
  teams: ['TEAM123456'], prefix: 'PREFIX1234', entitlements: {
    'com.apple.developer.team-identifier': 'TEAM123456',
    'com.apple.application-identifier': 'PREFIX1234.com.kloda.desktop.dev',
    'keychain-access-groups': ['PREFIX1234.*'],
  } });
test('accepts matching Mac development profile, including a distinct App ID prefix', () => {
  assert.deepEqual(validateProfile(valid(), 'mac'), { team: 'TEAM123456', identifier: 'PREFIX1234.com.kloda.desktop.dev' });
});
test('rejects expired, wrong-device, production, missing or foreign Keychain and team bindings', () => {
  const mutations = [p => { p.expires = '2000-01-01'; }, p => { p.devices = []; },
    p => { p.platform = ['iOS']; }, p => { p.certificates = []; },
    p => { p.entitlements['com.apple.application-identifier'] = 'PREFIX1234.com.kloda.desktop'; },
    p => { delete p.entitlements['keychain-access-groups']; },
    p => { p.entitlements['keychain-access-groups'] = ['OTHER12345.*']; },
    p => { p.teams = ['OTHER12345']; }];
  for (const mutate of mutations) { const p = valid(); mutate(p); assert.throws(() => validateProfile(p, 'mac')); }
});
