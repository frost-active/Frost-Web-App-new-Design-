import * as React from 'react';
import DeviceGate from './DeviceGate';

type Props = { connected: boolean; disabled: boolean; progress: string | null; onSend: () => void; onRetry?: () => void };

export default function SendChallengeButton({ connected, disabled, progress, onSend, onRetry }: Props) {
  return <div className="challenge-send-area">
    <DeviceGate connected={connected} />
    {progress && <p role="status" aria-live="polite">{progress}</p>}
    {onRetry ? <button type="button" className="challenge-primary" disabled={!connected || disabled} onClick={onRetry}>Retry device sync</button>
      : <button type="button" className="challenge-primary" disabled={!connected || disabled} onClick={onSend}>Send Challenge</button>}
  </div>;
}