const { withAndroidStyles } = require('expo/config-plugins');

// Android dialog buttons default to textAllCaps, which uppercases with the system locale ("HEDEFI KALDIR").
// Keep the translated label as written.
const button = { $: { name: 'KlodaAlertButton', parent: 'Widget.AppCompat.Button.ButtonBar.AlertDialog' }, item: [{ $: { name: 'android:textAllCaps' }, _: 'false' }] };
const dialog = {
  $: { name: 'KlodaAlertDialog', parent: 'Theme.AppCompat.DayNight.Dialog.Alert' },
  item: ['buttonBarPositiveButtonStyle', 'buttonBarNegativeButtonStyle', 'buttonBarNeutralButtonStyle'].map((name) => ({ $: { name }, _: '@style/KlodaAlertButton' })),
};

module.exports = (config) => withAndroidStyles(config, (mod) => {
  const styles = mod.modResults.resources.style ??= [];
  const named = (name) => styles.find((style) => style.$.name === name);
  for (const style of [button, dialog]) if (!named(style.$.name)) styles.push(style);
  const theme = named('AppTheme');
  if (theme) {
    const items = theme.item ??= [];
    if (!items.some((item) => item.$.name === 'alertDialogTheme')) items.push({ $: { name: 'alertDialogTheme' }, _: '@style/KlodaAlertDialog' });
  }
  return mod;
});
