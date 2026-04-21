import { Card } from '@heroui/react';

export default function SectionCardHeader({ section, title, description, action }) {
  return (
    <Card.Header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-col items-start gap-1">
        {section ? (
          <Card.Description className="text-xs tracking-[0.16em] uppercase">{section}</Card.Description>
        ) : null}
        <Card.Title>{title}</Card.Title>
        {description ? <Card.Description>{description}</Card.Description> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </Card.Header>
  );
}
