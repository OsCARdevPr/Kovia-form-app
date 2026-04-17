import { Separator, Surface } from '@heroui/react';
import AdminNavbar from './AdminNavbar';
import AdminSidebar from './AdminSidebar';

export default function AdminLayout({ user, isDarkMode, onToggleTheme, onLogout, isLoggingOut, children }) {
  return (
    <Surface className="min-h-screen" variant="default">
      <AdminNavbar
        isDarkMode={isDarkMode}
        isLoggingOut={isLoggingOut}
        user={user}
        onLogout={onLogout}
        onToggleTheme={onToggleTheme}
      />

      <Separator />

      <div className="grid min-h-[calc(100vh-84px)] grid-cols-1 md:grid-cols-[280px_1fr]">
        <AdminSidebar />
        <Surface className="p-4 md:p-6" variant="transparent">
          {children}
        </Surface>
      </div>
    </Surface>
  );
}
