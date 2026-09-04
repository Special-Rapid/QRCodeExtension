import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type LocalePreference = 'system' | 'ja' | 'en';
export type ResolvedTheme = 'light' | 'dark';
export type ResolvedLocale = 'ja' | 'en';

export const supportedLocales: readonly ResolvedLocale[] = ['ja', 'en'];
export const fallbackLocale: ResolvedLocale = 'ja';

const THEME_KEY = '@qrscan/theme-preference';
const LOCALE_KEY = '@qrscan/locale-preference';

type PreferencesContextValue = {
  themePreference: ThemePreference;
  setThemePreference: (value: ThemePreference) => Promise<void>;
  localePreference: LocalePreference;
  setLocalePreference: (value: LocalePreference) => Promise<void>;
  resolvedTheme: ResolvedTheme;
  locale: ResolvedLocale;
  ready: boolean;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function resolveSystemLocale(locale: string | undefined): ResolvedLocale {
  const normalized = locale?.replace('_', '-').toLowerCase();
  if (normalized === 'ja' || normalized === 'en') return normalized;
  const base = normalized?.split('-')[0];
  if (base === 'ja' || base === 'en') return base;
  return fallbackLocale;
}

function detectSystemLocale(): ResolvedLocale {
  const locale = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().locale : undefined;
  return resolveSystemLocale(locale);
}

export function resolveLocale(preference: LocalePreference, systemLocale = detectSystemLocale()): ResolvedLocale {
  return preference === 'ja' || preference === 'en' ? preference : systemLocale;
}

function resolveTheme(preference: ThemePreference, systemTheme: ResolvedTheme | null): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemTheme ?? 'light';
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const systemTheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [localePreference, setLocalePreferenceState] = useState<LocalePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [storedTheme, storedLocale] = await Promise.all([AsyncStorage.getItem(THEME_KEY), AsyncStorage.getItem(LOCALE_KEY)]);
        if (!active) return;
        if (storedTheme === 'system' || storedTheme === 'light' || storedTheme === 'dark') setThemePreferenceState(storedTheme);
        if (storedLocale === 'system' || storedLocale === 'ja' || storedLocale === 'en') setLocalePreferenceState(storedLocale);
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setThemePreference = async (value: ThemePreference) => {
    setThemePreferenceState(value);
    await AsyncStorage.setItem(THEME_KEY, value);
  };

  const setLocalePreference = async (value: LocalePreference) => {
    setLocalePreferenceState(value);
    await AsyncStorage.setItem(LOCALE_KEY, value);
  };

  const value = useMemo<PreferencesContextValue>(() => ({
    themePreference,
    setThemePreference,
    localePreference,
    setLocalePreference,
    resolvedTheme: resolveTheme(themePreference, systemTheme === 'dark' ? 'dark' : 'light'),
    locale: resolveLocale(localePreference),
    ready,
  }), [localePreference, ready, systemTheme, themePreference]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('PreferencesProvider is missing.');
  return context;
}
