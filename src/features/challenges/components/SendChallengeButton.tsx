import * as React from 'react';
import DeviceGate from './DeviceGate';

type Props = { connected: boolean; disabled: boolean; progress: string | null; onSend: () => void; label?: string };

export default function SendChallengeButton({ connected, disabled, progress, onSend, label = 'Send Challenge' }: Props) {
  return <div className="challenge-send-area">
    <DeviceGate connected={connected} />
    {progress && <p role="status" aria-live="polite">{progress}</p>}
    <button type="button" className="challenge-primary" disabled={!connected || disabled} onClick={onSend}>{label}</button>
  </div>;
}