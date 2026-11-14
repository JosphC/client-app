import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { signInWithGoogleOnServer, signOutOnServer, usesServerAuth } from './serverAuth';
import { authenticate, googleMockUser, register, seedAccounts, toUser, type AuthUser, type MockAccounts } from './authService';

interface AuthState {
  /** `null` = vizitator (fără cont). */
  user: AuthUser | null;
  accounts: MockAccounts;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => void;
}

/** Conturile vin de la server când backend-ul e gata; până atunci rulează pe mock local. */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accounts: seedAccounts,
      signIn: async (email, password) => {
        set({ user: authenticate(get().accounts, email, password) });
      },
      signUp: async (name, email, password) => {
        const account = register(get().accounts, name, email, password);
        set((s) => ({ accounts: { ...s.accounts, [account.email]: account }, user: toUser(account) }));
      },
      signInWithGoogle: async () => {
        set({ user: usesServerAuth() ? await signInWithGoogleOnServer() : googleMockUser() });
      },
      signOut: () => {
        if (usesServerAuth()) void signOutOnServer().catch(() => undefined);
        set({ user: null });
      },
    }),
    {
      name: 'echopass-auth',
      storage: createJSONStorage(() => AsyncStorage),
      // Conturile mock (cu hash de parolă) rămân doar în memorie; pe disc se păstrează doar sesiunea.
      partialize: (s) => ({ user: s.user }),
    },
  ),
);
