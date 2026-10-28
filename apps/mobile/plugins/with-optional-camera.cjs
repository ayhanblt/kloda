const { withAndroidManifest } = require('expo/config-plugins');

module.exports = (config) => withAndroidManifest(config, (mod) => {
  const features = mod.modResults.manifest['uses-feature'] ??= [];
  const camera = features.find((feature) => feature.$['android:name'] === 'android.hardware.camera');
  if (camera) camera.$['android:required'] = 'false';
  else features.push({ $: { 'android:name': 'android.hardware.camera', 'android:required': 'false' } });
  return mod;
});
