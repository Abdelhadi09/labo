// test-utils.jsx — plain JSX (no TypeScript annotations)
// Rename this file to test-utils.tsx if you ever need full TS support.
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const AllTheProviders = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const customRender = (ui, options) =>
  render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };