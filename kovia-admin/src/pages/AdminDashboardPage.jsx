import { Alert, Card, Description } from '@heroui/react';

export default function AdminDashboardPage() {
  return (
    <Card className="w-full max-w-4xl" variant="default">
      <Card.Header className="flex flex-col items-start gap-1">
        <Card.Description className="text-xs tracking-[0.16em] uppercase">Módulos</Card.Description>
        <Card.Title>La consola administrativa está lista</Card.Title>
        <Card.Description>
          Usa la sección de Formularios para gestionar plantillas, configuraciones importadas y vistas previas.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <Alert status="accent">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>
              El módulo de Formularios trabaja en tres niveles: plantillas, lista de formularios y constructor.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      </Card.Content>
    </Card>
  );
}
