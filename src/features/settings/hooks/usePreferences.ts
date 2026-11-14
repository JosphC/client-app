import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { setLocale, type AppLocale } from '../../../core/i18n';
import { useThemeStore, type ThemePreference } from '../../../core/theme/themeStore';

interface PreferencesState {
  locale: AppLocale;
  theme: ThemePreference;
  setLocale: (locale: AppLocale) => void;
  setTheme: (theme: ThemePreference) => void;
}

/** Limba și tema alese de utilizator, păstrate între porniri și aplicate în i18n / themeStore. */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      locale: 'ro',
      theme: 'system',
      setLocale: (locale) => {
        setLocale(locale);
        set({ locale });
      },
      setTheme: (theme) => {
        useThemeStore.getState().setPreference(theme);
        set({ theme });
      },
    }),
    {
      name: 'echopass-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ locale: s.locale, theme: s.theme }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        setLocale(state.locale);
        useThemeStore.getState().setPreference(state.theme);
      },
    },
  ),
);
