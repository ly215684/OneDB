import { AlertCircle, Loader2, Inbox } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="mb-4 text-muted-foreground/30">
          {icon || <Inbox size={48} className="mx-auto" />}
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground mb-4">{description}</p>
        )}
        {action && (
          <Button size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message }: LoadingStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center">
        <Loader2 size={32} className="mx-auto mb-3 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{message || 'Loading...'}</p>
      </div>
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <AlertCircle size={48} className="mx-auto mb-4 text-destructive/50" />
        <h3 className="text-sm font-semibold text-foreground mb-1">
          {title || 'Error'}
        </h3>
        <p className="text-xs text-muted-foreground mb-4">{message}</p>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
