import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthScreenView } from '../../../src/features/auth';
import { useAuthStore } from '../../../src/features/auth/authStore';
import { seedAccounts } from '../../../src/features/auth/authService';
import { validateAuth } from '../../../src/features/auth/validation';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

function renderAuth(onDone = jest.fn()) {
  const screen = render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
      <AuthScreenView onDone={onDone} onBack={jest.fn()} />
    </SafeAreaProvider>,
  );
  return { screen, onDone };
}

beforeEach(() => useAuthStore.setState({ user: null, accounts: seedAccounts }));

describe('validateAuth', () => {
  it('requires name only when signing up and checks email + password', () => {
    expect(validateAuth('signIn', { name: '', email: 'a@b.ro', password: '12345678' })).toEqual({});
    expect(validateAuth('signUp', { name: '', email: 'x', password: '123' })).toEqual({
      name: 'auth.errNameRequired',
      email: 'auth.errEmailInvalid',
      password: 'auth.errPasswordShort',
    });
  });
});

describe('auth screen', () => {
  it('shows field errors and does not sign in with invalid input', async () => {
    const { screen, onDone } = renderAuth();
    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(await screen.findByText('Scrie o adresă de email validă.')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('rejects a wrong password with a form error', async () => {
    const { screen, onDone } = renderAuth();
    fireEvent.changeText(screen.getByTestId('auth-email'), 'demo@echopass.ro');
    fireEvent.changeText(screen.getByTestId('auth-password'), 'gresita123');
    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(await screen.findByText('Email sau parolă greșită.')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('signs in with the seeded demo account', async () => {
    const { screen, onDone } = renderAuth();
    fireEvent.changeText(screen.getByTestId('auth-email'), 'Demo@EchoPass.ro');
    fireEvent.changeText(screen.getByTestId('auth-password'), 'parola123');
    fireEvent.press(screen.getByTestId('auth-submit'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(useAuthStore.getState().user?.email).toBe('demo@echopass.ro');
  });

  it('continues with the Google account', async () => {
    const { screen, onDone } = renderAuth();
    fireEvent.press(screen.getByTestId('auth-google'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(useAuthStore.getState().user?.email).toBe('utilizator@gmail.com');
  });

  it('creates an account, signs in, and blocks a duplicate email', async () => {
    const { screen, onDone } = renderAuth();
    fireEvent.press(screen.getByLabelText('Creează cont'));
    fireEvent.changeText(screen.getByTestId('auth-name'), 'Maria Ionescu');
    fireEvent.changeText(screen.getByTestId('auth-email'), 'maria@exemplu.ro');
    fireEvent.changeText(screen.getByTestId('auth-password'), 'parolaMea1');
    fireEvent.press(screen.getByTestId('auth-submit'));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(useAuthStore.getState().user?.name).toBe('Maria Ionescu');

    act(() => useAuthStore.getState().signOut());
    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(await screen.findByText('Există deja un cont cu acest email. Conectează-te.')).toBeTruthy();
  });
});
