import { useCallback, useState } from 'react';
import { Card, Separator, Surface } from '@heroui/react';
import { useAuth } from '../context/AuthContext';
import AdminLoginForm from '../components/auth/AdminLoginForm';

export default function AdminLoginPage() {
  const { signIn, errorMessage: sessionError } = useAuth();
  const [isPending, setIsPending] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = useCallback(async (credentials) => {
    setIsPending(true);
    setFormError('');

    try {
      await signIn(credentials);
    } catch (error) {
      setFormError(error?.message || 'Could not sign in');
    } finally {
      setIsPending(false);
    }
  }, [signIn]);

  return (
    <Surface className="flex min-h-screen items-center justify-center p-4 md:p-8" variant="default">
      <Card className="w-full max-w-lg" variant="secondary">
        <Card.Header className="flex flex-col items-start gap-1">
          <Card.Description className="text-xs tracking-[0.16em] uppercase">Kovia</Card.Description>
          <Card.Title>Admin Console</Card.Title>
          <Card.Description>
            Access the standalone admin application with your secured account.
          </Card.Description>
        </Card.Header>
        <Separator />
        <Card.Content>
          <AdminLoginForm
            errorMessage={formError || sessionError}
            isPending={isPending}
            onSubmit={handleSubmit}
          />
        </Card.Content>
      </Card>
    </Surface>
  );
}
