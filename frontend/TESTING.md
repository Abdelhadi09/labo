# Testing Guide

This project uses **Vitest** + **React Testing Library** + **MSW** (Mock Service Worker) for comprehensive component testing.

## Setup

Testing dependencies are already installed. If not, run:

```bash
npm install
```

## Running Tests

### Run all tests
```bash
npm test
```

### Watch mode (rerun tests on file changes)
```bash
npm test -- --watch
```

### Run tests with UI
```bash
npm run test:ui
```

### Generate coverage report
```bash
npm run test:coverage
```

## Writing Tests

### Test File Naming
- Place test files next to the component: `Component.jsx` → `Component.test.jsx`
- Use `.test.jsx` or `.spec.jsx` extension

### Test Structure

```jsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', async () => {
    render(<MyComponent />);
    expect(screen.getByText(/hello/i)).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    await waitFor(() => {
      expect(screen.getByText(/clicked/i)).toBeInTheDocument();
    });
  });
});
```

## Key Testing Patterns

### Testing with API Mocks
The MSW server is configured in `src/test/mocks/server.js`. All HTTP requests are intercepted:

```jsx
import { server } from '../test/mocks/server';
import { http, HttpResponse } from 'msw';

it('handles API response', async () => {
  server.use(
    http.get('/api/data', () =>
      HttpResponse.json({ id: 1, name: 'Test' })
    )
  );

  render(<MyComponent />);
  await waitFor(() => {
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

### Testing Error States
```jsx
it('displays error on API failure', async () => {
  server.use(
    http.get('/api/data', () =>
      HttpResponse.json({ error: 'Not found' }, { status: 404 })
    )
  );

  render(<MyComponent />);
  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
```

### Testing User Interactions
```jsx
import userEvent from '@testing-library/user-event';

it('submits form', async () => {
  const user = userEvent.setup();
  const handleSubmit = vi.fn();
  
  render(<MyForm onSubmit={handleSubmit} />);
  
  await user.type(screen.getByRole('textbox'), 'test');
  await user.click(screen.getByRole('button', { name: /submit/i }));
  
  expect(handleSubmit).toHaveBeenCalledWith('test');
});
```

### Testing Async Operations
```jsx
import { waitFor } from '@testing-library/react';

it('loads and displays data', async () => {
  render(<DataComponent />);
  
  // Wait for data to load
  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeInTheDocument();
  });
});
```

## Component Test Coverage

### ✅ AuthContext (src/contexts/AuthContext.test.jsx)
- Worker login success/failure
- Token storage in localStorage
- Session initialization
- Logout flow

### ✅ OrdonnanceUpload (src/components/OrdonnanceUpload.test.jsx)
- Manual mode: service selection & search
- File upload mode: image validation
- Submission with idempotency key
- Error handling
- Confirmation modals

### ✅ WorkerDashboard (src/pages/worker/WorkerDashboard.test.jsx)
- Demand listing and pagination
- Real-time search/filter by client name
- Status display
- Detail modal opening
- Error states

## Best Practices

1. **Use semantic queries**: Prefer `getByRole`, `getByLabelText` over `getByTestId`
2. **Test user behavior**: Focus on what users see and interact with, not implementation details
3. **Avoid testing implementation**: Don't mock internal state or functions
4. **Keep tests isolated**: Each test should be independent
5. **Use `waitFor` for async**: Wait for async operations to complete before assertions
6. **Mock external APIs**: Use MSW for all HTTP requests

## Debugging Tests

### Print component tree
```jsx
import { screen, debug } from '@testing-library/react';
render(<MyComponent />);
screen.debug();
```

### Print specific element
```jsx
const button = screen.getByRole('button');
screen.debug(button);
```

### Run single test
```bash
npm test -- --grep "test name"
```

## CI/CD Integration

Tests run on every push (configure in your CI/CD pipeline):

```bash
npm test -- --run  # Exit with code 1 on failure
```

## Troubleshooting

### "useAuth must be used within AuthProvider"
Wrap component in `AuthProvider`:
```jsx
render(<AuthProvider><MyComponent /></AuthProvider>);
```

### "MSW not intercepting requests"
Ensure `src/test/setup.js` is loading the server:
```bash
npm test -- --no-coverage
```

### "timeout waiting for element"
Use `waitFor` or check query selectors:
```jsx
await waitFor(() => {
  expect(screen.getByText('Text')).toBeInTheDocument();
}, { timeout: 3000 });
```

## Resources

- [Vitest Docs](https://vitest.dev/)
- [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW Docs](https://mswjs.io/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
