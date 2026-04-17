import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Card, Description, Spinner, Surface } from '@heroui/react';
import { useAuth } from '../context/AuthContext';
import AdminDashboardPage from '../pages/AdminDashboardPage';
import AdminLoginPage from '../pages/AdminLoginPage';

function FullscreenLoader({ label = 'Loading...' }) {
  return (
    <Surface className="flex min-h-screen items-center justify-center p-4" variant="default">
      <Card className="w-full max-w-sm" variant="secondary">
        <Card.Content className="flex flex-col items-center gap-3 py-8" aria-live="polite">
          <Spinner size="lg" />
          <Description>{label}</Description>
        </Card.Content>
      </Card>
    </Surface>
  );
}

function ProtectedRoute() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <FullscreenLoader label="Checking session..." />;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }

  return <AdminDashboardPage />;
}

function GuestRoute() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <FullscreenLoader label="Preparing login..." />;
  }

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return <AdminLoginPage />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProtectedRoute />} />
        <Route path="/login" element={<GuestRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
