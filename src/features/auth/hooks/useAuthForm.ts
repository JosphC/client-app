import { useState } from 'react';
import type { I18nKey } from '../../../core/i18n';
import { AuthError, type AuthErrorCode } from '../authService';
import { useAuthStore } from '../authStore';
import { validateAuth, validateField, type AuthErrors, type AuthField, type AuthMode, type AuthValues } from '../validation';

const ERROR_KEYS: Record<AuthErrorCode, I18nKey> = {
  INVALID_CREDENTIALS: 'auth.errInvalidCredentials',
  NO_ACCOUNT: 'auth.errNoAccount',
  EMAIL_TAKEN: 'auth.errEmailTaken',
};

export function useAuthForm(onDone: () => void) {
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [values, setValues] = useState<AuthValues>({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<AuthErrors>({});
  const [formError, setFormError] = useState<I18nKey | null>(null);
  const [busy, setBusy] = useState(false);

  function setValue(field: AuthField, value: string): void {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setFormError(null);
  }

  function blurField(field: AuthField): void {
    if (values[field].length > 0) setErrors((e) => ({ ...e, [field]: validateField(mode, field, values[field]) }));
  }

  function changeMode(next: AuthMode): void {
    setMode(next);
    setErrors({});
    setFormError(null);
  }

  async function submit(): Promise<void> {
    const found = validateAuth(mode, values);
    setErrors(found);
    if (Object.keys(found).length > 0 || busy) return;
    setBusy(true);
    try {
      if (mode === 'signIn') await signIn(values.email, values.password);
      else await signUp(values.name, values.email, values.password);
      onDone();
    } catch (e) {
      setFormError(e instanceof AuthError ? ERROR_KEYS[e.code] : 'common.error');
    } finally {
      setBusy(false);
    }
  }

  async function google(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await signInWithGoogle();
      onDone();
    } catch {
      setFormError('common.error');
    } finally {
      setBusy(false);
    }
  }

  return { google, mode, values, errors, formError, busy, setValue, blurField, changeMode, submit };
}
