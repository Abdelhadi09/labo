
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import React, { Suspense, lazy } from 'react';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ClientDashboard = lazy(() => import('./pages/client/ClientDashboard'));
const WorkerDashboard = lazy(() => import('./pages/worker/WorkerDashboard'));
import ErrorBoundary from './components/ErrorBoundry.jsx';
import PageLoader from './components/PageLoader';

const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
};

const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return user.role === 'worker'
    ? <Navigate to="/worker" replace />
    : <Navigate to="/client" replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/client/*" element={
            <ProtectedRoute role="client">
              <ErrorBoundary>
        <ClientDashboard />
      </ErrorBoundary>
              </ProtectedRoute>
          } />
          <Route path="/worker/*" element={
            <ProtectedRoute role="worker">
              <ErrorBoundary>
                <WorkerDashboard />
              </ErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
