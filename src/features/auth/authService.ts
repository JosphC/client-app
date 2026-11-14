export type AuthErrorCode = 'INVALID_CREDENTIALS' | 'NO_ACCOUNT' | 'EMAIL_TAKEN';

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
    this.name = 'AuthError';
  }
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface MockAccount extends AuthUser {
  passwordHash: string;
}

export type MockAccounts = Record<string, MockAccount>;

/** Hash simplu, doar pentru mock și doar în memorie (nu se scrie pe disc). NU e sigur; serverul real (/auth/*) îl înlocuiește cu bcrypt/argon2. */
function hashPassword(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i += 1) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Cont de test pentru modul mock: demo@echopass.ro / parola123. */
export const seedAccounts: MockAccounts = {
  'demo@echopass.ro': { id: 'user-demo', name: 'Ion Popescu', email: 'demo@echopass.ro', passwordHash: hashPassword('parola123') },
};

/**
 * Cont Google de test (mock). Cu serverul real: SDK-ul Google întoarce un `idToken`, trimis la
 * `POST /auth/signin` `{ provider: 'google', idToken }`; contul și numele vin din răspuns.
 */
export function googleMockUser(): AuthUser {
  return { id: 'user-google-demo', name: 'Utilizator Google', email: 'utilizator@gmail.com' };
}

export function toUser({ id, name, email }: MockAccount): AuthUser {
  return { id, name, email };
}

export function authenticate(accounts: MockAccounts, email: string, password: string): AuthUser {
  const account = accounts[normalizeEmail(email)];
  if (!account) throw new AuthError('NO_ACCOUNT');
  if (account.passwordHash !== hashPassword(password)) throw new AuthError('INVALID_CREDENTIALS');
  return toUser(account);
}

export function register(accounts: MockAccounts, name: string, email: string, password: string): MockAccount {
  const key = normalizeEmail(email);
  if (accounts[key]) throw new AuthError('EMAIL_TAKEN');
  return { id: `user-${Date.now().toString(36)}`, name: name.trim(), email: key, passwordHash: hashPassword(password) };
}
