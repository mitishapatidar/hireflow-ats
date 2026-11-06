import React from 'react';
import { Plus, MoreHorizontal } from 'lucide-react';
import { cn } from '../index';
import { Badge, StageVariant } from './Badge';

export interface KanbanCandidate {
  id: string;
  name: string;
  role: string;
  experience?: string;
  expectedSalary?: string;
  matchScore?: number;
  stage: StageVariant;
  tags?: string[];
}

export interface KanbanCardProps {
  candidate: KanbanCandidate;
  onClick?: () => void;
  className?: string;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({ candidate, onClick, className }) => {
  const initials = candidate.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      onClick={onClick}
      className={cn(
        'group rounded-card border border-border bg-card p-3.5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md cursor-grab active:cursor-grabbing select-none',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary-soft text-primary font-bold text-xs flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="truncate">
            <h5 className="text-xs font-bold text-navy truncate group-hover:text-primary transition-colors">
              {candidate.name}
            </h5>
            <p className="text-[11px] text-muted truncate">{candidate.role}</p>
          </div>
        </div>
        <button
          className="text-muted hover:text-text p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted mb-2.5">
        <span>{candidate.experience || '3 yrs'}</span>
        {candidate.expectedSalary && (
          <span className="font-semibold text-text">{candidate.expectedSalary}</span>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/80">
        <Badge stage={candidate.stage} size="sm" dot />
        {candidate.matchScore !== undefined && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-pill bg-primary-soft text-primary">
            {candidate.matchScore}%
          </span>
        )}
      </div>
    </div>
  );
};

export interface KanbanColumnProps {
  id: string;
  title: string;
  stage: StageVariant;
  count: number;
  onAddCandidate?: () => void;
  children: React.ReactNode;
  className?: string;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  title,
  stage,
  count,
  onAddCandidate,
  children,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col w-72 shrink-0 rounded-card bg-page-bg/80 border border-border p-3 max-h-[750px]',
        className
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-navy">{title}</span>
          <span className="h-5 min-w-[20px] px-1.5 rounded-pill bg-card border border-border text-[11px] font-semibold text-muted flex items-center justify-center">
            {count}
          </span>
        </div>
        {onAddCandidate && (
          <button
            onClick={onAddCandidate}
            className="h-6 w-6 rounded-input flex items-center justify-center text-muted hover:text-primary hover:bg-card border border-transparent hover:border-border transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Cards Scroll Area */}
      <div className="flex flex-col gap-2.5 overflow-y-auto pr-1 flex-1">
        {children}
      </div>
    </div>
  );
};
