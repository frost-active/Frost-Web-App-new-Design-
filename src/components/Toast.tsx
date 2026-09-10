import { useEffect } from 'react';

export default function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(onDismiss, 2200);
    return () => window.clearTimeout(timeout);
  }, [message, onDismiss]);

  return <div className={`toast${message ? ' show' : ''}`} id="toast" role="status" aria-live="polite">{message}</div>;
}
