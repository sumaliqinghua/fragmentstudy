import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { resolveEmailDeliveryEnabled } from './config';
import { resetDataServiceState } from './dataService';
import { clearGuestData } from './guestStorage';
import { isSupabaseConfigured, supabase, supabaseConfigError } from './supabase';

const emailDeliveryEnabled = resolveEmailDeliveryEnabled(
  process.env.EXPO_PUBLIC_AUTH_EMAIL_DELIVERY_ENABLED
);

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isGuest: boolean;
  isLoading: boolean;
  configError: string | null;
  emailDeliveryEnabled: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null; requiresEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const activeUserId = useRef<string | null | undefined>(undefined);

  const applySession = useCallback((nextSession: Session | null) => {
    const nextUserId = nextSession?.user.id ?? null;
    if (activeUserId.current !== nextUserId) {
      clearGuestData();
      resetDataServiceState();
      activeUserId.current = nextUserId;
    }
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      applySession(null);
      return;
    }

    let isActive = true;
    supabase.auth.getSession().then(({ data: { session: restored } }) => {
      if (isActive) applySession(restored);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isActive) applySession(nextSession);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (supabaseConfigError) return { error: new Error(supabaseConfigError) };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (supabaseConfigError) {
      return { error: new Error(supabaseConfigError), requiresEmailConfirmation: false };
    }
    const redirectTo = Linking.createURL('/');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    return {
      error: error as Error | null,
      requiresEmailConfirmation: !error && !data.session,
    };
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) {
      applySession(null);
      return;
    }
    await supabase.auth.signOut();
  }, [applySession]);

  const resetPassword = useCallback(async (email: string) => {
    if (!emailDeliveryEnabled) {
      return { error: new Error('开发阶段暂未开放邮件找回密码') };
    }
    if (supabaseConfigError) return { error: new Error(supabaseConfigError) };
    const redirectTo = Linking.createURL('/auth');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error: error as Error | null };
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      isGuest: !user,
      isLoading,
      configError: supabaseConfigError,
      emailDeliveryEnabled,
      signIn,
      signUp,
      signOut,
      resetPassword,
    }),
    [user, session, isLoading, signIn, signUp, signOut, resetPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
