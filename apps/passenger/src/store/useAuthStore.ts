import '../lib/supabase';
import { create } from 'zustand';
import * as authService from '@trisakay/services';
import type { PublicUser } from '@trisakay/services';
import type { User } from '../types/user';
import { REQUEST_TIMEOUT_MS, withTimeout } from '../utils/withTimeout';

/** `Session | null`, derived from the service so this app needn't depend on supabase-js directly. */
type AuthSession = Awaited<ReturnType<typeof authService.getSession>>;

function toAppUser(profile: PublicUser): User {
  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    phone: profile.contact_no ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
  };
}

interface AuthState {
  user: User | null;
  /**
   * The signed-in user's id, taken straight off the session and set
   * synchronously with every auth event. `user` is not a substitute: it only
   * lands once the profile fetch resolves (and stays null if that fetch
   * fails), so during a user switch `user.id` still reads as the *previous*
   * user. Anything that must re-key when the identity changes — the consent
   * gate — has to watch this field.
   */
  sessionUserId: string | null;
  isAuthenticated: boolean;
  isHydrating: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password: string) => Promise<'signed_in' | 'check_email' | 'error'>;
  logout: () => Promise<void>;
  clearError: () => void;
  /** Re-fetches the profile row and refreshes `user` in place — for updates (e.g. avatar upload) made outside the auth-event flow. */
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => {
  // Staleness guard for async profile fetches. Every auth event (the initial
  // hydration and each onAuthStateChange callback) synchronously claims a new
  // epoch; a profile fetch applies its result only while the epoch it captured
  // is still current. Without this, a fetch started by e.g. TOKEN_REFRESHED
  // could resolve after a later SIGNED_OUT and re-authenticate a user who has
  // already logged out.
  let authEpoch = 0;

  /**
   * Applies one observed auth event. Every path — including failure and a
   * server that accepts the connection but never answers — clears
   * `isHydrating` within REQUEST_TIMEOUT_MS, so no promise can strand the
   * splash screen (which waits on hydration with no deadline of its own) or
   * the auth screens (whose buttons stay busy while `sessionUserId` is set but
   * `isAuthenticated` is still false).
   */
  function applyAuthEvent(session: AuthSession): void {
    const epoch = ++authEpoch;

    if (!session) {
      set({ user: null, sessionUserId: null, isAuthenticated: false, isHydrating: false });
      return;
    }

    // Publish the identity before awaiting anything. The consent gate keys off
    // it, and it must not lag behind the session by the length of a profile
    // fetch — that window is exactly when a second sign-in would otherwise be
    // judged against the previous user's consent verdict.
    set({ sessionUserId: session.user.id });

    // Timed, not merely try/caught. A profile fetch that hangs rather than
    // fails is the dangerous case: it never rejects, so `.catch()` never runs,
    // `isAuthenticated` stays false forever, and both the splash screen and
    // the login/register buttons (which key on `sessionUserId !== null`) wait
    // on it indefinitely. The timeout collapses a hang into the failure path
    // that is already handled.
    withTimeout(authService.getCurrentUserProfile(), REQUEST_TIMEOUT_MS, 'Profile fetch timed out')
      // A failed profile fetch does not invalidate the session, so stay
      // authenticated with a null profile rather than signing the user out.
      .catch(() => null)
      .then((profile) => {
        if (epoch !== authEpoch) return; // superseded by a newer auth event
        set({ user: profile ? toAppUser(profile) : null, isAuthenticated: true, isHydrating: false });
      });
  }

  authService.onAuthStateChange(applyAuthEvent);

  authService
    .getSession()
    // Session unreadable: treat as signed out rather than leaving the app
    // stuck on the splash screen forever.
    .catch(() => null)
    .then(applyAuthEvent);

  return {
    user: null,
    sessionUserId: null,
    isAuthenticated: false,
    isHydrating: true,
    error: null,

    login: async (email, password) => {
      set({ error: null });
      const { error } = await authService.signIn({ email, password });
      if (error) set({ error });
    },

    register: async (name, email, phone, password) => {
      set({ error: null });
      const { session, error } = await authService.signUp({ fullName: name, email, phone, password });
      if (error) {
        set({ error });
        return 'error';
      }
      return session ? 'signed_in' : 'check_email';
    },

    logout: async () => {
      await authService.signOut();
    },

    clearError: () => set({ error: null }),

    refreshProfile: async () => {
      const profile = await authService.getCurrentUserProfile().catch(() => null);
      if (profile) set({ user: toAppUser(profile) });
    },
  };
});
