import { useEffect, useState } from 'react';
import { subscribeDeviceBottleStatus, type DeviceBottleStatus } from '../DeviceBottleSync';

export type BottleControlAction =
  | { type: 'calibrate' }
  | { type: 'set-learning'; enabled: boolean };

type Props = {
  isDeviceConnected: boolean;
  uid: string;
  macAddress: string | null;
  onAction: (action: BottleControlAction) => Promise<void>;
};

export default function DeviceBottleControls({ isDeviceConnected, uid, macAddress, onAction }: Props) {
  const subscriptionKey = `${uid}:${macAddress ?? ''}`;
  const [subscription, setSubscription] = useState<{
    key: string;
    status: DeviceBottleStatus;
    loading: boolean;
    error: string;
  }>({
    key: '',
    status: { calibrated: false, learningEnabled: false },
    loading: true,
    error: '',
  });
  const [busy, setBusy] = useState(false);
  const status = subscription.key === subscriptionKey
    ? subscription.status
    : { calibrated: false, learningEnabled: false };
  const loading = subscription.key !== subscriptionKey || subscription.loading;
  const error = subscription.key === subscriptionKey ? subscription.error : '';

  useEffect(() => {
    return subscribeDeviceBottleStatus(uid, macAddress, (nextStatus) => {
      setSubscription({ key: subscriptionKey, status: nextStatus, loading: false, error: '' });
    }, (cause) => {
      console.error('Unable to load the FROST bottle status.', cause);
      setSubscription({
        key: subscriptionKey,
        status: { calibrated: false, learningEnabled: false },
        loading: false,
        error: 'Bottle status could not be loaded from your account.',
      });
    });
  }, [uid, macAddress, subscriptionKey]);

  const runAction = async (action: BottleControlAction) => {
    setBusy(true);
    try {
      await onAction(action);
    } catch (cause) {
      setSubscription((current) => current.key === subscriptionKey
        ? { ...current, error: cause instanceof Error ? cause.message : 'The bottle command failed.' }
        : current);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="card device-bottle-controls">
      <h2>Bottle Controls</h2>
      <p className="device-bottle-controls-lead">Manage bottle calibration and water consumption learning for the connected device.</p>
      <div className="device-bottle-controls-status" aria-live="polite">
        {loading ? 'Loading saved bottle status…' : status.calibrated ? <>Bottle: <strong>IN USE</strong></> : 'No calibrated bottle'}
        {status.calibrated && <span className={`pill${status.learningEnabled ? ' ok' : ''}`}>Learning {status.learningEnabled ? 'On' : 'Off'}</span>}
      </div>
      <div className="device-bottle-controls-actions">
        <button
          className="btn pri"
          type="button"
          disabled={!isDeviceConnected || loading || busy}
          aria-busy={busy}
          onClick={() => void runAction({ type: 'calibrate' })}
        >
          {busy ? 'Working…' : status.calibrated ? 'Recalibrate' : 'Add Bottle'}
        </button>
        {status.calibrated && !status.learningEnabled && (
          <button
            className="btn"
            type="button"
            disabled={!isDeviceConnected || loading || busy}
            aria-pressed={false}
            onClick={() => void runAction({ type: 'set-learning', enabled: true })}
          >
            Turn learning on
          </button>
        )}
      </div>
      {error && <p className="device-bottle-controls-error" role="alert">{error}</p>}
      <p className="device-bottle-controls-help">{isDeviceConnected
        ? status.calibrated
          ? status.learningEnabled
            ? 'Water consumption learning is on. Recalibrate after changing bottles.'
            : 'Turn water consumption learning on when needed. Recalibrate after changing bottles.'
          : 'Add a bottle to calibrate it and start water consumption learning.'
        : 'Connect your FROST Aura to add or recalibrate a bottle and enable learning.'}</p>
    </article>
  );
}