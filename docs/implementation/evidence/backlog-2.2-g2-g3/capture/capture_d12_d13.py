"""One-off isolated D12/D13 capture for 2.2/G2-G3 (G23-07).

Not a durable project command (2.5 remains open). Serves the already-built
renderer (apps/desktop/dist/renderer) over 127.0.0.1 and injects a disposable
synthetic `window.kloda` stub; no Electron, userData, OS tray or network access.
Usage: python3 -I capture_d12_d13.py <renderer_dir> <out_dir> <port>
"""
import functools, http.server, json, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

renderer, out, port = Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(renderer))
handler.log_message = lambda *a: None
server = http.server.ThreadingHTTPServer(('127.0.0.1', port), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()

STUB = """
(() => {
  const base = { receiver: { available: true, activeTransfers: 0 }, backup: { active: false, failed: false },
    autostart: { enabled: false, supported: true }, autostartChoice: false, canHide: true,
    environmentLimited: false, shutdownError: false, appVersion: '0.0.0' };
  const variant = new URLSearchParams(location.search).get('state');
  const status = variant === 'error'
    ? { ...base, receiver: { available: true, activeTransfers: 0, errorCode: 'lan_unavailable' }, canHide: false, environmentLimited: true }
    : base;
  window.__calls = [];
  const rec = (name, value) => (...args) => { window.__calls.push(name); return Promise.resolve(value); };
  window.kloda = {
    background: { status: async () => status, setAutostart: rec('setAutostart', status), quit: rec('quit') },
    getDraft: async () => ({ intervalHours: 12, localTime: '12:00', sources: [], storage: null, storageTested: false }),
    getProgress: async () => null, pickSources: rec('pickSources', []), saveSchedule: rec('saveSchedule'),
    saveStorage: rec('saveStorage'), startSync: rec('startSync'), testStorage: rec('testStorage'),
  };
})();
"""

MEASURE = """
() => {
  const doc = document.documentElement;
  const root = document.querySelector('[role=group]') || document.querySelector('.desktop-background');
  const clipped = root ? [...root.querySelectorAll('*')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible').length : -1;
  const outside = root ? [...root.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(), p = root.getBoundingClientRect(); return r.right > p.right + 1 || r.left < p.left - 1; }).length : -1;
  return {
    lang: doc.lang, theme: doc.classList.contains('dark') ? 'dark' : doc.classList.contains('light') ? 'light' : 'none',
    headings: [...document.querySelectorAll('h1')].filter(h => !h.closest('[hidden]')).map(h => h.textContent),
    pageOverflow: doc.scrollWidth > doc.clientWidth, clippedChildren: clipped, childrenOutsideCard: outside,
    inlineStyles: root ? [...root.querySelectorAll('[style]')].filter(e => e.getAttribute('style').trim()).length : -1,
    styled: root ? [...root.querySelectorAll('[style]')].map(e => e.outerHTML.slice(0, 160)) : [],
    buttons: root ? [...root.querySelectorAll('button')].map(b => ({ name: b.textContent.trim(), disabled: b.disabled,
      described: b.getAttribute('aria-describedby') ? document.getElementById(b.getAttribute('aria-describedby'))?.textContent : null })) : [],
    status: root ? [...root.querySelectorAll('[role=status],[role=alert]')].map(e => e.getAttribute('role') + ':' + e.textContent) : [],
    calls: window.__calls,
  };
}
"""

LANG_LABEL = {'tr': 'Türkçe', 'en': 'English', 'de': 'Deutsch'}
results, errors = [], []
with sync_playwright() as p:
    browser = p.chromium.launch()
    for mode in ('light', 'dark'):
        for width, height in ((1440, 1000), (640, 900)):
            for lang in ('tr', 'en', 'de'):
                for state in (('normal', 'error') if (mode, width, lang) == ('light', 1440, 'tr') else ('normal',)):
                    ctx = browser.new_context(viewport={'width': width, 'height': height}, color_scheme=mode, reduced_motion='reduce')
                    ctx.add_init_script(STUB)
                    ctx.add_init_script(f"localStorage.setItem('kloda.appearance', '{mode}')")
                    page = ctx.new_page()
                    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
                    page.on('pageerror', lambda e: errors.append(str(e)))
                    page.goto(f'http://127.0.0.1:{port}/index.html?state={state}#/settings')
                    page.wait_for_selector('.appearance-settings')
                    page.get_by_text(LANG_LABEL[lang], exact=True).click()
                    page.evaluate('document.fonts.ready')
                    for surface in ('settings', 'tray'):
                        page.evaluate(f"location.hash = '#/{surface}'")
                        if surface == 'tray': page.wait_for_selector('[role=group] [role=status]')
                        else: page.wait_for_selector('.desktop-background dl dd')
                        page.wait_for_timeout(200)
                        name = f'{surface}-{lang}-{mode}-{width}' + ('' if state == 'normal' else f'-{state}')
                        page.screenshot(path=str(out / f'{name}.png'), full_page=True)
                        m = page.evaluate(MEASURE)
                        if surface == 'tray':
                            page.locator('[role=group] button').first.focus()
                            m['openFocusable'] = page.evaluate("document.activeElement?.closest('[role=group]') !== null")
                            page.keyboard.press('Tab')
                            m['tabAfterOpen'] = page.evaluate("document.activeElement?.textContent?.trim()")
                        m.update(name=name, surface=surface, mode=mode, width=width, state=state)
                        results.append(m)
                    ctx.close()
    browser.close()
server.shutdown()
(out / 'measurements.json').write_text(json.dumps({'results': results, 'consoleErrors': errors}, ensure_ascii=False, indent=1))
bad = [r['name'] for r in results if r['theme'] != r['mode'] or r['lang'] != r['name'].split('-')[1] or r['pageOverflow'] or r['clippedChildren'] or r['childrenOutsideCard'] or r['inlineStyles'] or r['calls']]
print(json.dumps({'captures': len(results), 'consoleErrors': len(errors), 'flagged': bad}))
