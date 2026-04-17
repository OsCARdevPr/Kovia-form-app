import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Description, Skeleton, Spinner, Surface } from '@heroui/react';
import { useAuth } from '../context/AuthContext';
import { verifyAdminAccess } from '../lib/admin/auth';
import { useThemeMode } from '../hooks/useThemeMode';
import AdminLayout from '../components/layout/AdminLayout';

function isUnauthorized(error) {
  return Number(error?.status || 0) === 401;
}

export default function AdminDashboardPage() {
  const { user, signOut } = useAuth();
  const { isDarkMode, ready, toggleTheme } = useThemeMode();
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [accessError, setAccessError] = useState('');

  const runAccessCheck = useCallback(async () => {
    setIsCheckingAccess(true);
    setAccessError('');

    try {
      await verifyAdminAccess();
    } catch (error) {
      if (isUnauthorized(error)) {
        await signOut();
        return;
      }

      setAccessError(error?.message || 'Could not validate admin access');
    } finally {
      setIsCheckingAccess(false);
    }
  }, [signOut]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    void runAccessCheck();
  }, [ready, runAccessCheck]);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);

    try {
      await signOut();
    } finally {
      setIsLoggingOut(false);
    }
  }, [signOut]);

  if (!ready || isCheckingAccess) {
    return (
      <Surface className="flex min-h-screen items-center justify-center p-4" variant="default">
        <Card className="w-full max-w-md" variant="secondary">
          <Card.Content className="flex flex-col items-center gap-3 py-8">
            <Spinner size="lg" />
            <Description>Validating admin access...</Description>
            <Skeleton className="h-2 w-full max-w-52 rounded-full" />
          </Card.Content>
        </Card>
      </Surface>
    );
  }

  if (accessError) {
    return (
      <Surface className="flex min-h-screen items-center justify-center p-4" variant="default">
        <Card className="w-full max-w-xl" variant="secondary">
          <Card.Header>
            <Card.Title>Unable to validate admin access</Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{accessError}</Alert.Description>
              </Alert.Content>
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onPress={runAccessCheck}>
                Retry
              </Button>
              <Button size="sm" variant="danger-soft" onPress={handleLogout}>
                Sign Out
              </Button>
            </div>
          </Card.Content>
        </Card>
      </Surface>
    );
  }

  return (
    <AdminLayout
      isDarkMode={isDarkMode}
      isLoggingOut={isLoggingOut}
      user={user}
      onLogout={handleLogout}
      onToggleTheme={toggleTheme}
    >
      <Card className="w-full max-w-4xl" variant="default">
        <Card.Header className="flex flex-col items-start gap-1">
          <Card.Description className="text-xs tracking-[0.16em] uppercase">Modules</Card.Description>
          <Card.Title>Admin shell is ready</Card.Title>
          <Card.Description>
            Login, session validation, toolbar, navigation list, and dark mode are all active.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <Alert status="accent">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>
                Internal modules can now be added as HeroUI-based views without creating custom UI
                primitives.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        </Card.Content>
      </Card>
    </AdminLayout>
  );
}
