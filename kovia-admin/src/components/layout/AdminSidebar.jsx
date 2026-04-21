import { Description, Label, ListBox, Surface } from '@heroui/react';
import { useLocation, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { id: 'overview',    href: '/overview',    label: 'Resumen',       description: 'Estado general y actividad' },
  { id: 'forms',       href: '/forms',       label: 'Formularios',   description: 'Plantillas y estado' },
  { id: 'submissions', href: '/submissions', label: 'Respuestas',    description: 'Respuestas recientes' },
  { id: 'webhooks',    href: '/webhooks',    label: 'Webhooks',      description: 'Integraciones y notificaciones' },
  { id: 'users',       href: '/users',       label: 'Usuarios',      description: 'Usuarios y roles administrativos' },
];

function resolveSelection(pathname) {
  if (pathname.startsWith('/forms'))       return 'forms';
  if (pathname.startsWith('/submissions')) return 'submissions';
  if (pathname.startsWith('/webhooks'))    return 'webhooks';
  if (pathname.startsWith('/users'))       return 'users';
  return 'overview';
}

export default function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const selected = resolveSelection(location.pathname);

  return (
    <Surface className="h-full rounded-none p-3 md:p-4" variant="secondary">
      <ListBox
        aria-label="Navegación administrativa"
        className="w-full"
        onSelectionChange={(keys) => {
          const [firstKey] = Array.from(keys);
          const item = NAV_ITEMS.find((entry) => entry.id === firstKey);
          if (item) {
            navigate(item.href);
          }
        }}
        selectedKeys={[selected]}
        selectionMode="single"
      >
        {NAV_ITEMS.map((item) => (
          <ListBox.Item key={item.id} id={item.id} textValue={item.label}>
            <div className="flex flex-col">
              <Label>{item.label}</Label>
              <Description>{item.description}</Description>
            </div>
            <ListBox.ItemIndicator />
          </ListBox.Item>
        ))}
      </ListBox>
    </Surface>
  );
}
