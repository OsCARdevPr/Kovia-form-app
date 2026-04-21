import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Card, Description, Spinner, Surface } from '@heroui/react';
import { useAuth } from '../context/AuthContext';
import AdminDashboardPage from '../pages/AdminDashboardPage';
import AdminFormBuilderPage from '../pages/AdminFormBuilderPage';
import AdminFormsTemplatesPage from '../pages/AdminFormsTemplatesPage';
import AdminLoginPage from '../pages/AdminLoginPage';
import AdminShellPage from '../pages/AdminShellPage';
import AdminSubmissionDetailPage from '../pages/AdminSubmissionDetailPage';
import AdminSubmissionsPage from '../pages/AdminSubmissionsPage';
import AdminTemplateFormsPage from '../pages/AdminTemplateFormsPage';
import AdminUsersPage from '../pages/AdminUsersPage';
import AdminWebhookFormConfigPage from '../pages/AdminWebhookFormConfigPage';
import AdminWebhookLogsPage from '../pages/AdminWebhookLogsPage';
import AdminWebhooksPage from '../pages/AdminWebhooksPage';

function FullscreenLoader({ label = 'Cargando...' }) {
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

function GuestRoute() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <FullscreenLoader label="Preparando inicio de sesión..." />;
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
        <Route path="/" element={<Navigate to="/overview" replace />} />

        <Route element={<AdminShellPage />}>
          <Route path="/overview" element={<AdminDashboardPage />} />
          <Route path="/forms" element={<AdminFormsTemplatesPage />} />
          <Route path="/forms/:templateId" element={<AdminTemplateFormsPage />} />
          <Route path="/forms/:templateId/:formId/builder" element={<AdminFormBuilderPage />} />
          <Route path="/submissions" element={<AdminSubmissionsPage />} />
          <Route path="/submissions/:id" element={<AdminSubmissionDetailPage />} />
          <Route path="/webhooks" element={<AdminWebhooksPage />} />
          <Route path="/webhooks/:webhookId/logs" element={<AdminWebhookLogsPage />} />
          <Route path="/webhooks/:webhookId" element={<AdminWebhookFormConfigPage />} />
          <Route path="/users" element={<AdminUsersPage />} />
        </Route>

        <Route path="/login" element={<GuestRoute />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
