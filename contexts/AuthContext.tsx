import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';

type AuthResult = { error: string | null; user: User | null };
type SendOtpResult = { error: string | null };

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  operationLoading: boolean;
  initialized: boolean;
  setOperationLoading: (value: boolean) => void;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUpWithPassword: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<AuthResult>;
  sendOTP: (email: string) => Promise<SendOtpResult>;
  verifyOTPAndLogin: (email: string, token: string, options?: { password?: string }) => Promise<AuthResult>;
  logout: () => Promise<{ error: string | null }>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    }).catch(() => mounted && setLoading(false));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    session,
    loading,
    operationLoading,
    initialized: !loading,
    setOperationLoading,
    signInWithPassword: async (email, password) => {
      setOperationLoading(true);
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null, user: data.user ?? null };
      } finally { setOperationLoading(false); }
    },
    signUpWithPassword: async (email, password, metadata) => {
      setOperationLoading(true);
      try {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
        return { error: error?.message ?? null, user: data.user ?? null };
      } finally { setOperationLoading(false); }
    },
    sendOTP: async (email) => {
      setOperationLoading(true);
      try {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
        return { error: error?.message ?? null };
      } finally { setOperationLoading(false); }
    },
    verifyOTPAndLogin: async (email, token) => {
      setOperationLoading(true);
      try {
        const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
        return { error: error?.message ?? null, user: data.user ?? null };
      } finally { setOperationLoading(false); }
    },
    logout: async () => {
      setOperationLoading(true);
      try {
        const { error } = await supabase.auth.signOut();
        return { error: error?.message ?? null };
      } finally { setOperationLoading(false); }
    },
    refreshSession: async () => {
      await supabase.auth.refreshSession();
    },
  }), [session, loading, operationLoading, supabase]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export function useSession() {
  const { session, loading } = useAuth();
  return { session, isLoading: loading };
}