import type { I18nKey } from '../../core/i18n';

export type AuthMode = 'signIn' | 'signUp';
export type AuthField = 'name' | 'email' | 'password';
export type AuthValues = Record<AuthField, string>;
export type AuthErrors = Partial<Record<AuthField, I18nKey>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 8;

export function validateField(mode: AuthMode, field: AuthField, value: string): I18nKey | undefined {
  if (field === 'name') return mode === 'signUp' && value.trim().length < 2 ? 'auth.errNameRequired' : undefined;
  if (field === 'email') return EMAIL.test(value.trim()) ? undefined : 'auth.errEmailInvalid';
  return value.length >= MIN_PASSWORD ? undefined : 'auth.errPasswordShort';
}

export function validateAuth(mode: AuthMode, values: AuthValues): AuthErrors {
  const errors: AuthErrors = {};
  (['name', 'email', 'password'] as const).forEach((field) => {
    const error = validateField(mode, field, values[field]);
    if (error) errors[field] = error;
  });
  return errors;
}
