import React from 'react';
import { ArrowUpRight, ArrowDownRight, MoreHorizontal } from 'lucide-react';
import { cn } from '../index';
import { Badge, StageVariant } from './Badge';

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  timeframe?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  trend = 'neutral',
  timeframe = 'vs last month',
  icon,
  className,
}) => {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/30',
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">{title}</span>
        {icon && (
          <div className="h-8 w-8 rounded-input bg-primary-soft text-primary flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <h3 className="text-2xl font-bold text-navy">{value}</h3>
      </div>

      {change && (
        <div className="flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              'inline-flex items-center font-semibold rounded-pill px-1.5 py-0.5',
              trend === 'up' && 'bg-success-soft text-[#0E7A47]',
              trend === 'down' && 'bg-danger-soft text-[#B91C1C]',
              trend === 'neutral' && 'bg-page-bg text-muted'
            )}
          >
            {trend === 'up' && <ArrowUpRight className="w-3 h-3 mr-0.5 inline" />}
            {trend === 'down' && <ArrowDownRight className="w-3 h-3 mr-0.5 inline" />}
            {change}
          </span>
          <span className="text-muted">{timeframe}</span>
        </div>
      )}
    </div>
  );
};

export interface SectionCardProps {
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  headerAction,
  children,
  className,
}) => {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-card shadow-sm overflow-hidden',
        className
      )}
    >
      {(title || headerAction) && (
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            {title && <h2 className="text-base font-bold text-navy">{title}</h2>}
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};

export interface CandidateCardProps {
  name: string;
  currentRole: string;
  company?: string;
  experience?: string;
  location?: string;
  expectedSalary?: string;
  stage?: StageVariant;
  matchScore?: number;
  avatarUrl?: string;
  tags?: string[];
  onAction?: () => void;
  className?: string;
}

export const CandidateCard: React.FC<CandidateCardProps> = ({
  name,
  currentRole,
  company,
  experience,
  location,
  expectedSalary,
  stage = 'Sourced',
  matchScore,
  tags = [],
  onAction,
  className,
}) => {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        'rounded-card border border-border bg-card p-4 shadow-sm hover:border-primary/40 hover:shadow-md transition-all cursor-pointer',
        className
      )}
      onClick={onAction}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary-soft text-primary font-bold text-sm flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div>
            <h4 className="text-sm font-bold text-navy hover:text-primary transition-colors">
              {name}
            </h4>
            <p className="text-xs text-muted truncate max-w-[180px]">
              {currentRole} {company && `• ${company}`}
            </p>
          </div>
        </div>
        <button
          className="text-muted hover:text-text p-1 rounded-input"
          onClick={(e) => {
            e.stopPropagation();
            onAction?.();
          }}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-muted mb-3">
        <span>{experience || '3.5 yrs exp'}</span>
        <span>•</span>
        <span>{location || 'Mumbai, India'}</span>
        {expectedSalary && (
          <>
            <span>•</span>
            <span className="font-semibold text-text">{expectedSalary}</span>
          </>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Badge stage={stage} dot size="sm" />
        {matchScore !== undefined && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-pill bg-primary-soft text-primary">
            {matchScore}% match
          </span>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {tags.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded bg-page-bg text-muted border border-border"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
