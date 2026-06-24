vi.mock('@/services/supabaseClient', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
  },
}));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { server } from '../test/mocks/server';
import { http, HttpResponse } from 'msw';

describe('AuthContext — workerLogin', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores token and user in localStorage on successful login', async () => {
    const wrapper = ({ children }) => (
      <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.workerLogin({ username: 'worker1', password: 'pass' });
    });

    expect(localStorage.getItem('token')).toBe('test-jwt');
    expect(result.current.user.role).toBe('worker');
    expect(result.current.user.id).toBe('worker-1');
  });

  it('handles 401 error by clearing state', async () => {
    server.use(
      http.post('/api/auth/worker/login', () =>
        HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      )
    );

    const wrapper = ({ children }) => (
      <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(
      act(async () => {
        await result.current.workerLogin({ username: 'x', password: 'y' });
      })
    ).rejects.toThrow();

    expect(result.current.user).toBeNull();
  });
});

describe('AuthContext — logout', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-jwt');
    localStorage.setItem('user', JSON.stringify({ id: '1', role: 'worker' }));
  });

  it('clears token and user from localStorage', async () => {
    const wrapper = ({ children }) => (
      <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(result.current.user).toBeNull();
  });
});

describe('AuthContext — initialization', () => {
  it('hydrates user from valid stored token', async () => {
    localStorage.setItem('token', 'test-jwt');

    const wrapper = ({ children }) => (
      <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).not.toBeNull();
    expect(result.current.user.role).toBe('client');
  });

  it('clears invalid token from localStorage', async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    );

    localStorage.setItem('token', 'invalid-token');

    const wrapper = ({ children }) => (
      <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(localStorage.getItem('token')).toBeNull();
    expect(result.current.user).toBeNull();
  });
});