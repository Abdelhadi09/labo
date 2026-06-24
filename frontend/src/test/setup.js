import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { server } from './mocks/server';

// NOTE: Supabase is mocked via vi.mock() inside each test file, NOT here.
// vi.mock() is only hoisted (runs before imports) when called in test files.
// Calling it in setupFiles runs too late — test imports are already resolved.

// ─── MSW server ───────────────────────────────────────────────────────────
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ─── localStorage mock ────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store = {};
  return {
    getItem:    vi.fn((key)        => store[key] ?? null),
    setItem:    vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key)        => { delete store[key]; }),
    clear:      vi.fn(()           => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });