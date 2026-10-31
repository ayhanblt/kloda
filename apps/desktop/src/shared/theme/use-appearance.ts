import { useEffect, useState } from 'react';

export type ThemePreference = 'dark' | 'light' | 'system';
const storageKey = 'kloda.appearance';
function savedPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved === 'light' || saved === 'system' ? saved : 'dark';
  } catch { return 'dark'; }
}
export function useAppearance() {
  const [preference, setPreference] = useState<ThemePreference>(savedPreference);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true);
  const mode = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const changed = () => setSystemDark(media.matches);
    changed();
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
    document.documentElement.classList.toggle('light', mode === 'light');
  }, [mode]);
  const choose = (value: ThemePreference) => {
    setPreference(value);
    try { localStorage.setItem(storageKey, value); } catch { /* Public preference remains usable without persistence. */ }
  };
  return { preference, mode, choose };
}
