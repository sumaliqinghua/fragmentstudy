import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../services/supabase';
import { resetDataServiceState } from '../services/dataService';
import { clearGuestData } from '../services/guestStorage';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isGuest: boolean;
  isLoading: boolean;
  configError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{
    error: Error | null;
    requiresEmailConfirmation: boolean;
  }>;
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
    supabase.auth.getSession().then(({ data: { session: restoredSession } }) => {
      if (isActive) applySession(restoredSession);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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
      return {
        error: new Error(supabaseConfigError),
        requiresEmailConfirmation: false,
      };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
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
    if (supabaseConfigError) return { error: new Error(supabaseConfigError) };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  }, []);

  const value: AuthContextType = {
    user,
    session,
    isGuest: !user,
    isLoading,
    configError: supabaseConfigError,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
