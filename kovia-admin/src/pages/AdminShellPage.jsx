import { useCallback, useMemo } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Card, Description, Spinner, Surface } from '@heroui/react';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../hooks/useThemeMode';
import AdminLayout from '../components/layout/AdminLayout';

function FullscreenLoader({ label }) {
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

export default function AdminShellPage() {
  const { status, user, signOut } = useAuth();
  const { isDarkMode, ready, toggleTheme } = useThemeMode();

  const isLoading = useMemo(() => status === 'loading' || !ready, [status, ready]);

  const handleLogout = useCallback(async () => {
    await signOut();
  }, [signOut]);

  if (isLoading) {
    return <FullscreenLoader label="Preparando espacio administrativo..." />;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }

  return (
    <AdminLayout
      isDarkMode={isDarkMode}
      isLoggingOut={false}
      user={user}
      onLogout={handleLogout}
      onToggleTheme={toggleTheme}
    >
      <Outlet />
    </AdminLayout>
  );
}
