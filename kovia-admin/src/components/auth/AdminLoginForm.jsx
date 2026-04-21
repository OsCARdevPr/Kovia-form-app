import { useCallback, useState } from 'react';
import { Button, Form, Input, Label, TextField } from '@heroui/react';

export default function AdminLoginForm({ onSubmit, isPending }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = useCallback((event) => {
    event.preventDefault();
    onSubmit({ email, password });
  }, [email, password, onSubmit]);

  return (
    <Form className="flex w-full flex-col gap-4" onSubmit={handleSubmit}>
      <TextField isRequired name="email" type="email">
        <Label>Correo electrónico</Label>
        <Input
          autoComplete="email"
          placeholder="admin@kovia.local"
          value={email}
          variant="secondary"
          onChange={(event) => setEmail(event.target.value)}
        />
      </TextField>

      <TextField isRequired name="password" type="password">
        <Label>Contraseña</Label>
        <Input
          autoComplete="current-password"
          placeholder="********"
          value={password}
          variant="secondary"
          onChange={(event) => setPassword(event.target.value)}
        />
      </TextField>

      <Button fullWidth isPending={isPending} size="lg" type="submit" variant="primary">
        Iniciar sesión
      </Button>
    </Form>
  );
}
