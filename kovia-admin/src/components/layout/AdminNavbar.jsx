import { Button, Description, Label, Surface, Switch, Toolbar } from '@heroui/react';

export default function AdminNavbar({ user, isDarkMode, onToggleTheme, onLogout, isLoggingOut }) {
  return (
    <Surface className="rounded-none px-4 py-3 md:px-6" variant="secondary">
      <Toolbar aria-label="Admin actions" className="flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <Description className="text-xs font-medium tracking-[0.18em] uppercase">Kovia</Description>
          <Label className="text-base">Consola administrativa</Label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Switch isSelected={isDarkMode} onChange={onToggleTheme}>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Content>
              <Label className="text-sm">{isDarkMode ? 'Modo oscuro' : 'Modo claro'}</Label>
            </Switch.Content>
          </Switch>

          <Surface className="rounded-full px-3 py-1 text-xs" variant="default">
            {user?.email || 'admin'}
          </Surface>

          <Button isPending={isLoggingOut} size="sm" variant="danger-soft" onPress={onLogout}>
            Cerrar sesión
          </Button>
        </div>
      </Toolbar>
    </Surface>
  );
}
