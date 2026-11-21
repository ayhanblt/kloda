// Read-only reviewer probe: executes the real presentation module in isolation.
// Run from repository root: node docs/implementation/evidence/backlog-2.2-g2-g3/review-probe.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const req = createRequire(path.resolve('apps/desktop/package.json'));
const ts = req('typescript');
const React = req('react');
const { renderToStaticMarkup } = req('react-dom/server');
const tr = JSON.parse(fs.readFileSync('apps/desktop/src/shared/i18n/locales/tr.json', 'utf8'));
const t = (key) => key.split('.').reduce((value, part) => value?.[part], tr) ?? key;
const source = fs.readFileSync('apps/desktop/src/features/desktop-background/DesktopTray.tsx', 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const exportsObject = {};
vm.runInNewContext(code, {
  exports: exportsObject,
  require(name) {
    if (name === 'react-i18next') return { useTranslation: () => ({ t }) };
    if (name === '../../shared/ui/Brand') return { Brand: () => null };
    if (name === 'lucide-react') return { LogOut: () => null };
    return req(name);
  },
});
const base = {
  receiver: { available: true, activeTransfers: 0 },
  backup: { active: false, failed: false }, shutdownError: false,
};
const cases = [
  ['active FILE + backup failure', { ...base, receiver: { available: true, activeTransfers: 1 }, backup: { active: false, failed: true } }],
  ['active backup + receiver error', { ...base, receiver: { ...base.receiver, errorCode: 'lan_unavailable' }, backup: { active: true, failed: false } }],
  ['active FILE + shutdown failure', { ...base, receiver: { available: true, activeTransfers: 1 }, shutdownError: true }],
];
let failures = 0;
for (const [name, status] of cases) {
  const html = renderToStaticMarkup(React.createElement(exportsObject.DesktopTray, {
    status, unknown: false, onOpen() {}, onQuit() {}, quitDisabled: false,
  }));
  const errorPill = html.includes(t('tray.state.error'));
  const activityAccurate = html.includes(t('background.active')) && !html.includes(t('background.idle'));
  console.log(JSON.stringify({ name, errorPill, activityAccurate, actualActivity: activityAccurate ? t('background.active') : t('background.idle') }));
  if (!errorPill || !activityAccurate) failures += 1;
}
console.log(`G23-01 combined error/activity: ${failures} of ${cases.length} fail the approved observed-status contract`);
process.exitCode = failures ? 1 : 0;
