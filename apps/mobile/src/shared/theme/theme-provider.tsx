import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, useColorScheme as useSystemColorScheme } from 'react-native';
import { useColorScheme, vars } from 'nativewind';
import * as SecureStore from 'expo-secure-store';
import { themeColors, themeVariables, type Appearance } from './tokens';

export type ThemePreference = Appearance | 'system';
const key = 'kloda.appearance';
const ThemeContext = createContext<{ preference: ThemePreference; mode: Appearance;
  setPreference: (value: ThemePreference) => void; colors: ReturnType<typeof themeColors>
}>({ preference: 'dark', mode: 'dark', setPreference: () => {}, colors: themeColors('dark') });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, update] = useState<ThemePreference>('dark');
  const system = useSystemColorScheme();
  const { setColorScheme } = useColorScheme();
  const revision = useRef(0);
  const mode: Appearance = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  useEffect(() => {
    let current = true;
    void Promise.resolve(SecureStore.getItemAsync(key)).then((stored) => {
      if (current && revision.current === 0 && ['dark', 'light', 'system'].includes(stored ?? '')) update(stored as ThemePreference);
    }).catch(() => undefined);
    return () => { current = false; };
  }, []);
  useEffect(() => { setColorScheme(preference); }, [preference, setColorScheme]);
  const setPreference = (value: ThemePreference) => {
    revision.current += 1; update(value);
    void SecureStore.setItemAsync(key, value).catch(() => undefined);
  };
  const colors = useMemo(() => themeColors(mode), [mode]);
  const variables = useMemo(() => vars(themeVariables(mode)), [mode]);
  // Global token scope only; screen/component styling remains in NativeWind classes.
  return <ThemeContext.Provider value={{ preference, mode, colors, setPreference }}>
    <View className="flex-1 bg-background dark:bg-background" style={variables}>{children}</View>
  </ThemeContext.Provider>;
}
export function useTheme() { return useContext(ThemeContext); }
export function useThemeColors() { return useTheme().colors; }
