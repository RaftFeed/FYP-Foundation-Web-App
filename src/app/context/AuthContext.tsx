import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export type UserRole = 'student' | 'tutor' | 'admin';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  isAuthLoading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, role: Exclude<UserRole, 'admin'>) => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeRole(role: unknown): UserRole | null {
  if (role === 'student' || role === 'tutor' || role === 'admin') {
    return role;
  }

  return null;
}

function getRedirectUrl() {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

async function getRoleForUser(user: User | null): Promise<UserRole | null> {
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!error) {
    const roleFromProfile = normalizeRole(data?.role);
    if (roleFromProfile) {
      return roleFromProfile;
    }
  }

  return normalizeRole(user.user_metadata?.role) ?? 'student';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (error) {
        setAuthError(error.message);
      }

      setSession(data.session);
      setRole(await getRoleForUser(data.session?.user ?? null));
      setIsAuthLoading(false);
    }

    loadSession();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsAuthLoading(true);

      getRoleForUser(nextSession?.user ?? null)
        .then((nextRole) => setRole(nextRole))
        .finally(() => setIsAuthLoading(false));
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      role,
      isAuthLoading,
      authError,
      signIn: async (email, password) => {
        setAuthError(null);
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          setAuthError(error.message);
          throw error;
        }
      },
      signInWithGoogle: async () => {
        setAuthError(null);
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: getRedirectUrl(),
          },
        });

        if (error) {
          setAuthError(error.message);
          throw error;
        }
      },
      signUp: async (email, password, selectedRole) => {
        setAuthError(null);
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: selectedRole,
            },
          },
        });

        if (error) {
          setAuthError(error.message);
          throw error;
        }
      },
      signOut: async () => {
        setAuthError(null);
        const { error } = await supabase.auth.signOut();

        if (error) {
          setAuthError(error.message);
          throw error;
        }
      },
      clearAuthError: () => setAuthError(null),
    }),
    [authError, isAuthLoading, role, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
