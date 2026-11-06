import React from 'react';
import { cn } from '../index';

export type StageVariant =
  | 'Sourced'
  | 'Screening'
  | 'Interview'
  | 'Technical'
  | 'Client Review'
  | 'Offer'
  | 'Placed'
  | 'Rejected';

export type SemanticVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: SemanticVariant;
  stage?: StageVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant,
  stage,
  size = 'md',
  dot = false,
  children,
  ...props
}) => {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-medium',
  };

  let colorStyle = 'bg-page-bg text-muted border border-border';
  let dotColor = 'bg-muted';

  if (stage) {
    switch (stage) {
      case 'Sourced':
        colorStyle = 'bg-primary-soft text-primary border-primary/20';
        dotColor = 'bg-primary';
        break;
      case 'Screening':
        colorStyle = 'bg-[#E5F0FF] text-[#2563EB] border-[#3B82F6]/20';
        dotColor = 'bg-[#3B82F6]';
        break;
      case 'Interview':
        colorStyle = 'bg-[#F3E8FF] text-[#7E22CE] border-[#A855F7]/20';
        dotColor = 'bg-[#A855F7]';
        break;
      case 'Technical':
        colorStyle = 'bg-[#E0F2FE] text-[#0369A1] border-[#0EA5E9]/20';
        dotColor = 'bg-[#0EA5E9]';
        break;
      case 'Client Review':
        colorStyle = 'bg-[#FEF3DC] text-[#B45309] border-[#F59E0B]/20';
        dotColor = 'bg-[#F59E0B]';
        break;
      case 'Offer':
        colorStyle = 'bg-[#ECFDF5] text-[#047857] border-[#10B981]/20';
        dotColor = 'bg-[#10B981]';
        break;
      case 'Placed':
        colorStyle = 'bg-success-soft text-[#0E7A47] border-success/30 font-semibold';
        dotColor = 'bg-success';
        break;
      case 'Rejected':
        colorStyle = 'bg-danger-soft text-[#B91C1C] border-danger/30';
        dotColor = 'bg-danger';
        break;
    }
  } else {
    switch (variant) {
      case 'primary':
        colorStyle = 'bg-primary-soft text-primary border-primary/20';
        dotColor = 'bg-primary';
        break;
      case 'success':
        colorStyle = 'bg-success-soft text-[#0E7A47] border-success/20';
        dotColor = 'bg-success';
        break;
      case 'warning':
        colorStyle = 'bg-warning-soft text-[#B45309] border-warning/20';
        dotColor = 'bg-warning';
        break;
      case 'danger':
        colorStyle = 'bg-danger-soft text-[#B91C1C] border-danger/20';
        dotColor = 'bg-danger';
        break;
      case 'info':
        colorStyle = 'bg-info-soft text-[#1D4ED8] border-info/20';
        dotColor = 'bg-info';
        break;
      default:
        colorStyle = 'bg-page-bg text-text border border-border';
        dotColor = 'bg-muted';
        break;
    }
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border transition-colors',
        sizeStyles[size],
        colorStyle,
        className
      )}
      {...props}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColor)} />}
      <span>{stage || children}</span>
    </span>
  );
};
