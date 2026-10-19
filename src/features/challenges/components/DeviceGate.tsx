import * as React from 'react';

export default function DeviceGate({ connected }: { connected: boolean }) {
  if (connected) return null;
  return <div className="challenge-device-gate" role="status">Connect your Frost device to send or accept a challenge.</div>;
}