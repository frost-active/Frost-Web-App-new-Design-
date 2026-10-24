import * as React from 'react';
import { useState } from 'react';
import type { ChallengeDeviceJson } from '../types';

type Props = { deviceJson: ChallengeDeviceJson | null; pendingMessage: string; fileName: string; note?: string };

export default function ChallengeJsonActions({ deviceJson, pendingMessage, fileName, note }: Props) {
  const [expanded, setExpanded] = useState(false);
  const jsonText = deviceJson ? JSON.stringify(deviceJson, null, 2) : '';
  const exportJson = () => {
    if (!deviceJson) return;
    const url = URL.createObjectURL(new Blob([jsonText], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="challenge-json-actions">
      {!deviceJson && <p className="challenge-json-preview-note" role="status">{pendingMessage}</p>}
      {deviceJson && note && <p className="challenge-json-preview-note">{note}</p>}
      <button type="button" aria-expanded={expanded} disabled={!deviceJson} onClick={() => setExpanded((value) => !value)}>
        {expanded ? 'Hide device JSON' : 'View device JSON'}
      </button>
      {expanded && deviceJson && <pre aria-label="Challenge device JSON">{jsonText}</pre>}
      <button type="button" disabled={!deviceJson} onClick={exportJson}>Export JSON</button>
    </div>
  );
}
