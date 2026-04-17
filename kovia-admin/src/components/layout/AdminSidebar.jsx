import { Description, Label, ListBox, Surface } from '@heroui/react';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', description: 'Summary and activity' },
  { id: 'forms', label: 'Forms', description: 'Templates and status' },
  { id: 'submissions', label: 'Submissions', description: 'Latest responses' },
  { id: 'users', label: 'Users', description: 'Admin users and roles' },
];

export default function AdminSidebar() {
  return (
    <Surface className="h-full rounded-none p-3 md:p-4" variant="secondary">
      <ListBox
        aria-label="Admin navigation"
        className="w-full"
        selectedKeys={[NAV_ITEMS[0].id]}
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
