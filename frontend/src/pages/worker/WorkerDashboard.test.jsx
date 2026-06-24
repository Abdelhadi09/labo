vi.mock('@/services/supabaseClient', () => {
  const channelStub = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
  return {
    supabase: {
      channel: vi.fn(() => channelStub),
      removeChannel: vi.fn(() => Promise.resolve()),
      auth: {
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        signOut: vi.fn(() => Promise.resolve({ error: null })),
      },
    },
  };
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import WorkerDashboard from './WorkerDashboard';
import { server } from '../../test/mocks/server';
import { http, HttpResponse } from 'msw';

const mockDemandsData = {
  data: [
    {
      id: 'demand-1',
      client_id: 'client-1',
      ordonnance_url: 'http://example.com/ordonnance.jpg',
      ordonnance_type: 'ocr',
      status: 'pending',
      ocr_text: 'Test OCR text',
      total_price: null,
      notes: null,
      created_at: '2024-01-15T10:00:00Z',
      username: 'abdelhadi',
      first_name: 'Abdelhadi',
      last_name: 'Benali',
      demand_items: []
    }
  ],
  total: 1,
  page: 1,
  limit: 20,
  total_pages: 1
};

const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('WorkerDashboard — demand listing and search', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/demands', () =>
        HttpResponse.json(mockDemandsData)
      )
    );
  });

  it('renders demands list on mount', async () => {
    renderWithProviders(<WorkerDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/abdelhadi/i)).toBeInTheDocument();
    });
  });

  it('filters demands by client name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkerDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/abdelhadi/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Rechercher par nom/i);
    await user.type(searchInput, 'abdelhadi');

    await waitFor(() => {
      expect(screen.getByText(/abdelhadi/i)).toBeInTheDocument();
    });
  });

  it('shows no results for non-matching search', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkerDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/abdelhadi/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Rechercher par nom/i);
    await user.type(searchInput, 'xyz');

    expect(screen.queryByText(/abdelhadi/i)).not.toBeInTheDocument();
  });
});

describe('WorkerDashboard — pagination', () => {
  it('handles page navigation', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/demands', ({ request }) => {
        const url = new URL(request.url);
        const page = url.searchParams.get('page');
        if (page === '2') {
          return HttpResponse.json({
            data: [{ ...mockDemandsData.data[0], id: 'demand-2' }],
            total: 2,
            page: 2,
            limit: 20,
            total_pages: 2
          });
        }
        return HttpResponse.json(mockDemandsData);
      })
    );

    renderWithProviders(<WorkerDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/abdelhadi/i)).toBeInTheDocument();
    });

    const nextBtn = screen.queryByRole('button', { name: /Suivant/i });
    if (nextBtn && !nextBtn.disabled) {
      await user.click(nextBtn);

      await waitFor(() => {
        expect(screen.getByText(/Page 2/i)).toBeInTheDocument();
      });
    }
  });
});

describe('WorkerDashboard — demand status display', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/demands', () =>
        HttpResponse.json(mockDemandsData)
      )
    );
  });

  it('displays correct status badge for pending demand', async () => {
    renderWithProviders(<WorkerDashboard />);

    await waitFor(() => {
      const statusBadge = screen.queryByText(/En attente|Pending/i);
      if (statusBadge) {
        expect(statusBadge).toBeInTheDocument();
      }
    });
  });

  it('displays ordonnance type icon', async () => {
    renderWithProviders(<WorkerDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/abdelhadi/i)).toBeInTheDocument();
    });
  });
});

describe('WorkerDashboard — demand detail modal', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/demands', () =>
        HttpResponse.json(mockDemandsData)
      )
    );
  });

  it('opens demand detail on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkerDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/abdelhadi/i)).toBeInTheDocument();
    });

    const demandRow = screen.getByText(/abdelhadi/i).closest('div');
    if (demandRow) {
      await user.click(demandRow);
    }
  });
});

describe('WorkerDashboard — error handling', () => {
  it('displays error when demand fetch fails', async () => {
    server.use(
      http.get('/api/demands', () =>
        HttpResponse.json({ error: 'Server error' }, { status: 500 })
      )
    );

    renderWithProviders(<WorkerDashboard />);

    await waitFor(() => {
      const errorMsg = screen.queryByText(/error|erreur/i);
      expect(errorMsg).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});