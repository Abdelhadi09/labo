import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { authAPI, TOKEN_KEY, REFRESH_TOKEN_KEY } from '../services/api';

const AuthContext = createContext(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const saveSession = (accessToken, refreshToken, user) => {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem('user', JSON.stringify(user));
};

const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  // Remove legacy key if still present from previous build
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  // Ref prevents the Supabase listener from triggering a redundant /client/session
  // exchange when we already have a valid backend access token.
  const hasBackendToken = useRef(!!localStorage.getItem(TOKEN_KEY));

  // ── On mount: verify stored access token with the backend ──────────────────
  // We call /auth/me rather than blindly trusting localStorage. If the token is
  // expired the axios interceptor will silently refresh it; if the refresh token
  // is also invalid, it will clear storage and redirect to /login.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem('token');
    if (token) {
      authAPI.me()
        .then(res => {
          setUser(res.data);
          hasBackendToken.current = true;
        })
        .catch(() => {
          // Interceptor already cleared storage if refresh failed
          clearSession();
          hasBackendToken.current = false;
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // ── Supabase auth listener (Google OAuth redirect, email OTP confirmation) ──
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        clearSession();
        hasBackendToken.current = false;
        setUser(null);
        return;
      }

      if (
        session?.access_token &&
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') &&
        !hasBackendToken.current
      ) {
        try {
          const res = await authAPI.clientSession(session.access_token);
          const { accessToken, refreshToken, user: backendUser } = res.data;
          saveSession(accessToken, refreshToken, backendUser);
          hasBackendToken.current = true;
          setUser(backendUser);
        } catch (err) {
          console.error('Session exchange error:', err);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Worker: username + password ────────────────────────────────────────────
  const workerLogin = async (credentials) => {
    const res = await authAPI.workerLogin(credentials);
    const { accessToken, refreshToken, user: backendUser } = res.data;
    saveSession(accessToken, refreshToken, backendUser);
    hasBackendToken.current = true;
    setUser(backendUser);
    return backendUser;
  };

  // ── Client: email + password sign-up ──────────────────────────────────────
  const signUpEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  };

  // ── Client: email + password sign-in ──────────────────────────────────────
  const signInEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error('No session returned from Supabase');

    const res = await authAPI.clientSession(accessToken);
    const { accessToken: backendAccess, refreshToken, user: backendUser } = res.data;
    saveSession(backendAccess, refreshToken, backendUser);
    hasBackendToken.current = true;
    setUser(backendUser);
    return backendUser;
  };

  // ── Client: passwordless email OTP ────────────────────────────────────────
  const sendEmailOTP = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  };

  const verifyEmailOTP = async (email, token) => {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;

    const session = data?.session ?? (await supabase.auth.getSession()).data?.session;
    if (!session?.access_token) throw new Error('OTP verified but no session was created');

    const res = await authAPI.clientSession(session.access_token);
    const { accessToken: backendAccess, refreshToken, user: backendUser } = res.data;
    saveSession(backendAccess, refreshToken, backendUser);
    hasBackendToken.current = true;
    setUser(backendUser);
    return backendUser;
  };

  // ── Client: Google OAuth ───────────────────────────────────────────────────
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/client` },
    });
    if (error) throw error;
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = async ({ allDevices = false } = {}) => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    try {
      // Revoke the refresh token server-side before clearing locally
      await authAPI.logout(refreshToken, allDevices);
    } catch {
      // Best-effort — clear locally regardless
    }
    await supabase.auth.signOut();
    clearSession();
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