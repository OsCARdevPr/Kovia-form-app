import { useCallback, useEffect, useState } from 'react';
import { Card, Separator, Surface } from '@heroui/react';
import { useAuth } from '../context/AuthContext';
import AdminLoginForm from '../components/auth/AdminLoginForm';
import { notifyError } from '../lib/ui/notifications';

export default function AdminLoginPage() {
  const { signIn, errorMessage: sessionError } = useAuth();
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!sessionError) {
      return;
    }

    notifyError(sessionError, 'No se pudo validar la sesión actual.');
  }, [sessionError]);

  const handleSubmit = useCallback(async (credentials) => {
    setIsPending(true);

    try {
      await signIn(credentials);
    } catch (error) {
      notifyError(error, 'No se pudo iniciar sesión.');
    } finally {
      setIsPending(false);
    }
  }, [signIn]);

  return (
    <Surface className="flex min-h-screen items-center justify-center p-4 md:p-8" variant="default">
      <Card className="w-full max-w-lg" variant="secondary">
        <Card.Header className="flex flex-col items-start gap-1">
          <Card.Description className="text-xs tracking-[0.16em] uppercase">Kovia</Card.Description>
          <Card.Title>Consola administrativa</Card.Title>
          <Card.Description>
            Accede a la aplicación administrativa con tu cuenta segura.
          </Card.Description>
        </Card.Header>
        <Separator />
        <Card.Content>
          <AdminLoginForm isPending={isPending} onSubmit={handleSubmit} />
        </Card.Content>
      </Card>
    </Surface>
  );
}
