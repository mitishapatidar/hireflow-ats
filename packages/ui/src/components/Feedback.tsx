import React from 'react';
import { Check, Clock } from 'lucide-react';
import { cn } from '../index';
import { Button } from './Button';

export interface StepperProps {
  steps: { label: string; description?: string }[];
  currentStep: number;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({ steps, currentStep, className }) => {
  return (
    <div className={cn('flex items-center w-full', className)}>
      {steps.map((step, idx) => {
        const isCompleted = idx < currentStep;
        const isCurrent = idx === currentStep;
        const isLast = idx === steps.length - 1;

        return (
          <React.Fragment key={idx}>
            <div className="flex items-center gap-2.5 shrink-0">
              <div
                className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  isCompleted && 'bg-success text-white',
                  isCurrent && 'bg-primary text-white ring-4 ring-primary-soft',
                  !isCompleted && !isCurrent && 'bg-page-bg border border-border text-muted'
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
              </div>
              <div className="flex flex-col">
                <span
                  className={cn(
                    'text-xs font-semibold',
                    isCurrent ? 'text-primary' : isCompleted ? 'text-text' : 'text-muted'
                  )}
                >
                  {step.label}
                </span>
                {step.description && (
                  <span className="text-[10px] text-muted">{step.description}</span>
                )}
              </div>
            </div>
            {!isLast && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-3 transition-colors',
                  idx < currentStep ? 'bg-success' : 'bg-border'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className,
  style,
  ...props
}) => {
  const variantStyles = {
    text: 'h-4 w-full rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-card',
  };

  return (
    <div
      className={cn('animate-pulse bg-[#E6E8F0]/70', variantStyles[variant], className)}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
      {...props}
    />
  );
};

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-card border border-dashed border-border bg-page-bg/40',
        className
      )}
    >
      {icon && (
        <div className="h-12 w-12 rounded-full bg-primary-soft text-primary flex items-center justify-center mb-3">
          {icon}
        </div>
      )}
      <h4 className="text-sm font-bold text-navy mb-1">{title}</h4>
      <p className="text-xs text-muted max-w-sm mb-4 leading-relaxed">{description}</p>
      {actionText && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};

export interface TimelineItem {
  id: string;
  title: string;
  timestamp: string;
  description?: string;
  author?: string;
  icon?: React.ReactNode;
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ items, className }) => {
  return (
    <div className={cn('relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border', className)}>
      {items.map((item) => (
        <div key={item.id} className="relative group">
          <div className="absolute -left-6 top-1 h-5 w-5 rounded-full bg-card border-2 border-primary flex items-center justify-center text-primary shadow-sm">
            {item.icon || <Clock className="w-2.5 h-2.5" />}
          </div>
          <div className="flex flex-col">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-bold text-text group-hover:text-primary transition-colors">
                {item.title}
              </span>
              <span className="text-[10px] text-muted whitespace-nowrap">{item.timestamp}</span>
            </div>
            {item.description && (
              <p className="text-xs text-muted mt-0.5 leading-relaxed">{item.description}</p>
            )}
            {item.author && (
              <span className="text-[10px] text-primary font-medium mt-1">by {item.author}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
