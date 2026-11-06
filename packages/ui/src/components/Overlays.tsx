import React from 'react';
import { X, AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../index';
import { Button } from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
  className,
}) => {
  if (!isOpen) return null;

  const widthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={cn(
          'w-full rounded-card border border-border bg-card shadow-xl overflow-hidden animate-in zoom-in-95 duration-150',
          widthStyles[maxWidth],
          className
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between p-5 border-b border-border">
            <div>
              {title && <h3 className="text-base font-bold text-navy">{title}</h3>}
              {description && <p className="text-xs text-muted mt-1">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-text p-1 rounded-input hover:bg-page-bg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="p-5">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2.5 p-4 bg-page-bg/50 border-t border-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  className?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'w-full max-w-lg',
  className,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy/50 backdrop-blur-sm">
      <div
        className={cn(
          'h-full bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200',
          width,
          className
        )}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            {title && <h3 className="text-base font-bold text-navy">{title}</h3>}
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-text p-1.5 rounded-input hover:bg-page-bg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">{children}</div>

        {footer && (
          <div className="p-4 border-t border-border bg-page-bg/40 flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export interface BannerProps {
  variant?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export const Banner: React.FC<BannerProps> = ({
  variant = 'info',
  title,
  children,
  action,
  onClose,
  className,
}) => {
  const variantStyles = {
    info: 'bg-primary-soft text-navy border-primary/20',
    warning: 'bg-warning-soft text-[#92400E] border-warning/30',
    danger: 'bg-danger-soft text-[#991B1B] border-danger/30',
    success: 'bg-success-soft text-[#065F46] border-success/30',
  };

  const iconStyles = {
    info: <Info className="w-4 h-4 text-primary shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-warning shrink-0" />,
    danger: <AlertCircle className="w-4 h-4 text-danger shrink-0" />,
    success: <CheckCircle2 className="w-4 h-4 text-success shrink-0" />,
  };

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-card border p-3.5 text-xs shadow-sm',
        variantStyles[variant],
        className
      )}
    >
      <div className="mt-0.5">{iconStyles[variant]}</div>
      <div className="flex-1">
        {title && <h5 className="font-bold text-sm mb-0.5">{title}</h5>}
        <div className="leading-relaxed opacity-90">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 rounded-input opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export interface ToastProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  onClose?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  type = 'info',
  title,
  message,
  onClose,
  className,
}) => {
  const iconMap = {
    success: <CheckCircle2 className="w-4 h-4 text-success shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-danger shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-warning shrink-0" />,
    info: <Info className="w-4 h-4 text-primary shrink-0" />,
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-card border border-border bg-card p-4 shadow-lg w-80 text-xs animate-in slide-in-from-top-2 duration-150',
        className
      )}
    >
      <div className="mt-0.5">{iconMap[type]}</div>
      <div className="flex-1">
        <h5 className="font-bold text-text text-sm">{title}</h5>
        {message && <p className="text-muted mt-0.5 leading-normal">{message}</p>}
      </div>
      {onClose && (
        <button onClick={onClose} className="text-muted hover:text-text p-1">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
