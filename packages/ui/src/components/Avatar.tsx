import React from 'react';
import { cn } from '../index';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy' | 'away';
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 'md',
  status,
  className,
  ...props
}) => {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const sizeStyles = {
    sm: 'h-7 w-7 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-11 w-11 text-base',
    xl: 'h-14 w-14 text-lg font-bold',
  };

  const statusSize = {
    sm: 'h-2 w-2 border',
    md: 'h-2.5 w-2.5 border-2',
    lg: 'h-3 w-3 border-2',
    xl: 'h-3.5 w-3.5 border-2',
  };

  const statusColors = {
    online: 'bg-success',
    offline: 'bg-muted',
    busy: 'bg-danger',
    away: 'bg-warning',
  };

  return (
    <div className={cn('relative inline-flex shrink-0 select-none', className)} {...props}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={cn('rounded-full object-cover border border-border', sizeStyles[size])}
        />
      ) : (
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-primary-soft text-primary font-bold border border-primary/20',
            sizeStyles[size]
          )}
        >
          {initials || '?'}
        </div>
      )}
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-card',
            statusSize[size],
            statusColors[status]
          )}
        />
      )}
    </div>
  );
};
