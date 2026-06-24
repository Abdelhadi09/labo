import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// IMPORTANT: axios uses VITE_API_URL from .env which is 'http://localhost:5000/api'.
// MSW must match the full URL the axios instance actually sends, not a relative path.
const BASE = 'http://localhost:5000/api';

export const server = setupServer(
  http.get(`${BASE}/services`, () =>
    HttpResponse.json({
      data: [
        { id: 'uuid-1', name: 'Vitamine D', code: 'VIT_D', price: 2450, description: null,              keywords: 'vitamine d' },
        { id: 'uuid-2', name: 'AFP',        code: 'AFP',   price: 1350, description: null,              keywords: 'alpha foetoproteine' },
        { id: 'uuid-3', name: 'NFS',        code: 'NFS',   price: 1200, description: 'À jeun préférable', keywords: 'numération formule sanguine' },
      ]
    })
  ),

  http.post(`${BASE}/demands`, () =>
    HttpResponse.json({ id: 'demand-1', status: 'processed' }, { status: 201 })
  ),

  http.get(`${BASE}/demands`, () =>
    HttpResponse.json({
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
          demand_items: [],
        }
      ],
      total: 1,
      page: 1,
      limit: 20,
      total_pages: 1,
    })
  ),

  http.get(`${BASE}/auth/me`, () =>
    HttpResponse.json({ id: 'user-1', username: 'testuser', role: 'client' })
  ),

  http.post(`${BASE}/auth/worker/login`, () =>
    HttpResponse.json({ token: 'test-jwt', user: { id: 'worker-1', role: 'worker' } })
  ),
);