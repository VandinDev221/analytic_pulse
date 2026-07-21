import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import type { DashboardTimelineItem } from '../../types';

interface Props {
  items: DashboardTimelineItem[];
}

function iconFor(kind: DashboardTimelineItem['kind']) {
  switch (kind) {
    case 'incident_resolved':
    case 'monitor_up':
      return <CheckCircle2 size={14} color="var(--green)" />;
    case 'incident_opened':
    case 'monitor_down':
      return <ShieldAlert size={14} color="var(--red)" />;
    case 'incident_acknowledged':
      return <AlertTriangle size={14} color="var(--yellow)" />;
    case 'maintenance':
      return <Wrench size={14} color="var(--accent-light)" />;
    case 'alert':
      return <Bell size={14} color="var(--accent-light)" />;
    default:
      return <Calendar size={14} color="var(--text-muted)" />;
  }
}

function formatAt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const EventTimeline: React.FC<Props> = ({ items }) => {
  if (items.length === 0) {
    return <div className="dash-empty">Nenhum evento recente.</div>;
  }

  return (
    <ol className="dash-timeline">
      {items.map((item) => {
        const body = (
          <>
            <span className="dash-timeline__icon">{iconFor(item.kind)}</span>
            <div className="dash-timeline__body">
              <div className="dash-timeline__title">{item.title}</div>
              {item.subtitle && (
                <div className="dash-timeline__sub">{item.subtitle}</div>
              )}
              <div className="dash-timeline__at">{formatAt(item.at)}</div>
            </div>
          </>
        );

        return (
          <li key={item.id} className="dash-timeline__item">
            {item.href ? (
              <Link to={item.href} className="dash-timeline__link">
                {body}
              </Link>
            ) : (
              <div className="dash-timeline__link">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
};
