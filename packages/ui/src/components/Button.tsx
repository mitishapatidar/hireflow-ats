import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../index';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';

    const sizeStyles = {
      sm: 'h-8 px-3 text-xs rounded-input gap-1.5',
      md: 'h-10 px-4 text-sm rounded-input gap-2',
      lg: 'h-12 px-6 text-base rounded-input gap-2.5',
    };

    const variantStyles = {
      primary: 'bg-primary text-white hover:bg-[#4d3cc0] shadow-sm',
      secondary: 'bg-primary-soft text-primary hover:bg-[#e2dcf9]',
      outline: 'border border-border bg-card text-text hover:bg-page-bg',
      ghost: 'text-text hover:bg-page-bg hover:text-primary',
      danger: 'bg-danger text-white hover:bg-[#cf383d] shadow-sm',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
