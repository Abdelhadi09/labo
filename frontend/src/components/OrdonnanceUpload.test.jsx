import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import OrdonnanceUpload from './OrdonnanceUpload';
import { server } from '../test/mocks/server';
import { http, HttpResponse } from 'msw';

// vi.mock is hoisted above imports by Vitest — this runs BEFORE AuthContext
// loads supabaseClient, so the real Supabase client is never created and its
// network calls never trip MSW's onUnhandledRequest:'error'.
vi.mock('@/services/supabaseClient', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
  },
}));

const mockOnSuccess = vi.fn();

const renderWithProviders = (component) =>
  render(
    <BrowserRouter>
      <AuthProvider>{component}</AuthProvider>
    </BrowserRouter>
  );

// ─── Manual mode ───────────────────────────────────────────────────────────
describe('OrdonnanceUpload — manual mode', () => {
  beforeEach(() => {
    mockOnSuccess.mockClear();
  });

  it('filters services by search query', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdonnanceUpload onSuccess={mockOnSuccess} />);

    await user.click(screen.getByText(/Sélection manuelle/i));

    const search = screen.getByPlaceholderText(/Rechercher une analyse/i);
    await user.type(search, 'vitamine');

    await waitFor(() => {
      expect(screen.getByText('Vitamine D')).toBeInTheDocument();
    });
    expect(screen.queryByText('AFP')).not.toBeInTheDocument();
  });

  it('disables submit button when no services selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdonnanceUpload onSuccess={mockOnSuccess} />);

    await user.click(screen.getByText(/Sélection manuelle/i));

    const submitBtn = screen.queryByRole('button', { name: /Soumettre la demande/i });
    expect(submitBtn).not.toBeInTheDocument();
  });

  it('enables submit button after selecting services', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdonnanceUpload onSuccess={mockOnSuccess} />);

    await user.click(screen.getByText(/Sélection manuelle/i));

    // Wait for services to load from MSW
    const vitamineDCheckbox = await screen.findByRole('checkbox', { name: /Vitamine D/i });
    await user.click(vitamineDCheckbox);

    await waitFor(() => {
      const submitBtn = screen.getByRole('button', { name: /Soumettre la demande/i });
      expect(submitBtn).not.toBeDisabled();
    });
  });

  it('submits with selected services and calls onSuccess', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdonnanceUpload onSuccess={mockOnSuccess} />);

    await user.click(screen.getByText(/Sélection manuelle/i));

    const vitamineDCheckbox = await screen.findByRole('checkbox', { name: /Vitamine D/i });
    await user.click(vitamineDCheckbox);

    const submitBtn = await screen.findByRole('button', { name: /Soumettre la demande/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'demand-1', status: 'processed' })
      );
    });
  });

  it('shows confirmation modal for services with remarques', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdonnanceUpload onSuccess={mockOnSuccess} />);

    await user.click(screen.getByText(/Sélection manuelle/i));

    const nfsCheckbox = await screen.findByRole('checkbox', { name: /NFS/i });
    await user.click(nfsCheckbox);

    const submitBtn = await screen.findByRole('button', { name: /Soumettre la demande/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/À jeun préférable/i)).toBeInTheDocument();
    });
  });
});

// ─── File rejection ─────────────────────────────────────────────────────────
describe('OrdonnanceUpload — file rejection', () => {
  it('rejects non-image file types', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdonnanceUpload onSuccess={mockOnSuccess} />);

    await user.click(screen.getByText(/Ordonnance imprimée/i));

    const dropzoneDiv = screen.getByText(/Glissez votre ordonnance/i).closest('div');
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    await user.upload(dropzoneDiv, file);

    await waitFor(() => {
      expect(screen.getByText(/Format non supporté/i)).toBeInTheDocument();
    });
  });

  it('rejects files larger than 10MB', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdonnanceUpload onSuccess={mockOnSuccess} />);

    await user.click(screen.getByText(/Ordonnance imprimée/i));

    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
    const dropzoneDiv = screen.getByText(/Glissez votre ordonnance/i).closest('div');
    await user.upload(dropzoneDiv, largeFile);

    await waitFor(() => {
      expect(screen.getByText(/trop volumineux/i)).toBeInTheDocument();
    });
  });
});

// ─── Network error handling ──────────────────────────────────────────────────
describe('OrdonnanceUpload — network error handling', () => {
  it('displays error on submission failure', async () => {
    server.use(
      http.post('http://localhost:5000/api/demands', () =>
        HttpResponse.json({ error: 'Server error' }, { status: 500 })
      )
    );

    const user = userEvent.setup();
    renderWithProviders(<OrdonnanceUpload onSuccess={mockOnSuccess} />);

    await user.click(screen.getByText(/Sélection manuelle/i));

    const vitamineDCheckbox = await screen.findByRole('checkbox', { name: /Vitamine D/i });
    await user.click(vitamineDCheckbox);

    const submitBtn = await screen.findByRole('button', { name: /Soumettre la demande/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Server error/i)).toBeInTheDocument();
    });
  });
});

// ─── Empty selection validation ──────────────────────────────────────────────
describe('OrdonnanceUpload — empty selection validation', () => {
  it('shows no submit button when no services selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdonnanceUpload onSuccess={mockOnSuccess} />);

    await user.click(screen.getByText(/Sélection manuelle/i));

    const submitBtn = screen.queryByRole('button', { name: /Soumettre la demande/i });
    expect(submitBtn).not.toBeInTheDocument();
  });
});

// ─── OCR flow ────────────────────────────────────────────────────────────────
describe('OrdonnanceUpload — OCR flow', () => {
  it('accepts valid image file and submits', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdonnanceUpload onSuccess={mockOnSuccess} />);

    await user.click(screen.getByText(/Ordonnance imprimée/i));

    const file = new File(['image'], 'scan.jpg', { type: 'image/jpeg' });
    const dropzone = screen.getByText(/Glissez votre ordonnance/i).closest('div');
    await user.upload(dropzone, file);

    await waitFor(() => {
      expect(screen.getByText('scan.jpg')).toBeInTheDocument();
    });

    const submitBtn = await screen.findByRole('button', { name: /Soumettre la demande/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });
});