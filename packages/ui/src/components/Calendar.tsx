import React from 'react';
import { ChevronLeft, ChevronRight, Video, MapPin, Clock } from 'lucide-react';
import { cn } from '../index';
import { Badge } from './Badge';

export interface CalendarEvent {
  id: string;
  candidateName: string;
  jobTitle: string;
  roundName: string; // e.g. Technical Round 1, Client Interview
  startTime: string; // e.g. "10:30 AM"
  endTime: string;   // e.g. "11:30 AM"
  dayIndex: number;  // 0 = Mon, 4 = Fri
  status?: 'scheduled' | 'no-show' | 'rescheduled' | 'completed';
  provider?: 'google-meet' | 'zoom' | 'teams';
}

export interface WeekCalendarProps {
  currentWeekLabel?: string;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  className?: string;
}

export const WeekCalendar: React.FC<WeekCalendarProps> = ({
  currentWeekLabel = 'Nov 10 – Nov 16, 2026 (IST)',
  events,
  onEventClick,
  className,
}) => {
  const days = ['Mon, Nov 10', 'Tue, Nov 11', 'Wed, Nov 12', 'Thu, Nov 13', 'Fri, Nov 14'];
  const hours = ['09:00 AM', '11:00 AM', '02:00 PM', '04:00 PM'];

  return (
    <div className={cn('rounded-card border border-border bg-card shadow-sm overflow-hidden', className)}>
      {/* Calendar Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-page-bg/40">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-navy">{currentWeekLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="h-7 w-7 rounded-input flex items-center justify-center text-muted hover:text-text border border-border bg-card">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button className="h-7 w-7 rounded-input flex items-center justify-center text-muted hover:text-text border border-border bg-card">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 divide-x divide-border border-b border-border bg-page-bg/60 text-center">
        {days.map((day, idx) => (
          <div key={idx} className="py-2.5 px-2 text-xs font-semibold text-text">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 divide-x divide-border min-h-[360px] p-2 gap-y-2 bg-card">
        {days.map((_, dayIdx) => {
          const dayEvents = events.filter((e) => e.dayIndex === dayIdx);
          return (
            <div key={dayIdx} className="flex flex-col gap-2 p-1">
              {dayEvents.map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => onEventClick?.(evt)}
                  className={cn(
                    'rounded-input border p-2.5 text-xs shadow-xs transition-all hover:shadow-md cursor-pointer',
                    evt.status === 'no-show'
                      ? 'bg-danger-soft/60 border-danger/30'
                      : evt.status === 'rescheduled'
                      ? 'bg-warning-soft/60 border-warning/30'
                      : 'bg-primary-soft/50 border-primary/20 hover:border-primary/50'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-navy truncate">{evt.candidateName}</span>
                    {evt.status === 'no-show' && (
                      <Badge variant="danger" size="sm">No-show</Badge>
                    )}
                    {evt.status === 'rescheduled' && (
                      <Badge variant="warning" size="sm">Rescheduled</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted truncate">{evt.roundName}</p>
                  <div className="flex items-center gap-1 text-[10px] text-muted mt-1.5 font-medium">
                    <Video className="w-3 h-3 text-primary" />
                    <span>{evt.startTime} – {evt.endTime}</span>
                  </div>
                </div>
              ))}
              {dayEvents.length === 0 && (
                <div className="h-full flex items-center justify-center text-[11px] text-muted/50 italic py-8">
                  No interviews
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
