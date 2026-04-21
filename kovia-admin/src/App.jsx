import { AuthProvider } from './context/AuthContext';
import { Toast } from '@heroui/react';
import AppRouter from './router/AppRouter';

export default function App() {
  return (
    <AuthProvider>
      <Toast.Provider placement="top end" />
      <AppRouter />
    </AuthProvider>
  );
}
