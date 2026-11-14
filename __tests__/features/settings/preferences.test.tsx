import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getLocale, setLocale, t } from '../../../src/core/i18n';
import { useThemeStore } from '../../../src/core/theme/themeStore';
import { PreferenceSheet, usePreferences } from '../../../src/features/settings';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

function renderSheet(kind: 'language' | 'appearance', onClose = jest.fn()) {
  const screen = render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <PreferenceSheet kind={kind} onClose={onClose} />
    </SafeAreaProvider>,
  );
  return { screen, onClose };
}

afterEach(() => {
  usePreferences.getState().setLocale('ro');
  usePreferences.getState().setTheme('system');
  setLocale('ro');
});

describe('preferences', () => {
  it('language sheet switches the app language and closes', () => {
    const { screen, onClose } = renderSheet('language');
    fireEvent.press(screen.getByLabelText('English'));
    expect(getLocale()).toBe('en');
    expect(usePreferences.getState().locale).toBe('en');
    expect(t('settings.language')).toBe('Language');
    expect(onClose).toHaveBeenCalled();
  });

  it('appearance sheet sets the theme preference', () => {
    const { screen } = renderSheet('appearance');
    fireEvent.press(screen.getByLabelText('Întunecat'));
    expect(useThemeStore.getState().preference).toBe('dark');
    expect(usePreferences.getState().theme).toBe('dark');
  });
});
