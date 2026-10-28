const assert = require('node:assert/strict');
const plugin = require('../apps/mobile/plugins/with-optional-camera.cjs');

(async () => {
  for (const existing of [[], [{ $: { 'android:name': 'android.hardware.camera', 'android:required': 'true' } }]]) {
    const config = plugin({});
    let mod = { modResults: { manifest: { 'uses-feature': existing } }, modRequest: {} };
    mod = await config.mods.android.manifest(mod);
    mod = await config.mods.android.manifest(mod);
    assert.equal(mod.modResults.manifest['uses-feature'].length, 1);
    assert.equal(mod.modResults.manifest['uses-feature'][0].$['android:required'], 'false');
  }
  const config = plugin({});
  const mod = await config.mods.android.manifest({ modResults: { manifest: {} }, modRequest: {} });
  assert.equal(mod.modResults.manifest['uses-feature'][0].$['android:name'], 'android.hardware.camera');
  console.log('PASS: optional camera manifest creation, update and idempotence');
})().catch((error) => { console.error(error); process.exitCode = 1; });
