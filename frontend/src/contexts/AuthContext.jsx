import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Start as null — hydrate only after backend verification to avoid stale state
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Prevent the Supabase listener from redundantly calling /client/session
  // when we already have a valid backend token (e.g. on TOKEN_REFRESHED events)
  const hasBackendToken = useRef(!!localStorage.getItem('token'));

  // On mount: verify any stored token with the backend
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authAPI.me()
        .then(res => {
          setUser(res.data);
          hasBackendToken.current = true;
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          hasBackendToken.current = false;
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Listen for Supabase auth state changes (Google OAuth redirect, email confirmation)
  // Only exchange for a backend JWT when we don't already have one — this prevents
  // hammering /client/session on every TOKEN_REFRESHED tab-focus event.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        hasBackendToken.current = false;
        setUser(null);
        return;
      }

      // Only exchange when signing in fresh (not on token refresh if we already have a JWT)
      if (
        session?.access_token &&
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') &&
        !hasBackendToken.current
      ) {
        try {
          const res = await authAPI.clientSession(session.access_token);
          const { token, user: backendUser } = res.data;
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(backendUser));
          hasBackendToken.current = true;
          setUser(backendUser);
        } catch (err) {
          console.error('Session exchange error:', err);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Worker: username + password → our JWT ──────────────────────────────────
  const workerLogin = async (credentials) => {
    const res = await authAPI.workerLogin(credentials);
    const { token, user: backendUser } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(backendUser));
    hasBackendToken.current = true;
    setUser(backendUser);
    return backendUser;
  };

  // ── Client: email + password sign-up (Supabase sends confirmation email) ───
  const signUpEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  };

  // ── Client: email + password sign-in ──────────────────────────────────────
  // Explicitly exchanges the Supabase session for a backend JWT so login is
  // instant and doesn't rely on the async onAuthStateChange callback.
  const signInEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error('No session returned from Supabase');

    const res = await authAPI.clientSession(accessToken);
    const { token, user: backendUser } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(backendUser));
    hasBackendToken.current = true;
    setUser(backendUser);
    return backendUser;
  };

  // ── Client: send passwordless email OTP ───────────────────────────────────
  const sendEmailOTP = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  };

  // ── Client: verify email OTP then exchange for backend JWT ────────────────
  const verifyEmailOTP = async (email, token) => {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;

    const session = data?.session ?? (await supabase.auth.getSession()).data?.session;
    if (!session?.access_token) throw new Error('OTP verified but no session was created');

    const res = await authAPI.clientSession(session.access_token);
    const { token: jwt, user: backendUser } = res.data;
    localStorage.setItem('token', jwt);
    localStorage.setItem('user', JSON.stringify(backendUser));
    hasBackendToken.current = true;
    setUser(backendUser);
    return backendUser;
  };

  // ── Client: Google OAuth ───────────────────────────────────────────────────
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) throw error;
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    hasBackendToken.current = false;
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user, loading,
      workerLogin, logout,
      signUpEmail, signInEmail,
      sendEmailOTP, verifyEmailOTP,
      signInWithGoogle,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
