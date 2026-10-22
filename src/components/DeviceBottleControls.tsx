type Props = { isDeviceConnected: boolean };

export default function DeviceBottleControls({ isDeviceConnected }: Props) {
  return (
    <article className="card device-bottle-controls">
      <h2>Bottle Controls</h2>
      <p className="device-bottle-controls-lead">Turn water consumption learning on or off for the connected device.</p>
      <div className="device-bottle-controls-actions">
        <button
          className="btn pri"
          type="button"
          disabled={!isDeviceConnected}
          onClick={() => window.dispatchEvent(new CustomEvent('frost-quick-action', { detail: { type: 'bottle-control', enabled: true } }))}
        >
          Add Bottle
        </button>
        {/*<button
          className="btn"
          type="button"
          disabled={!isDeviceConnected}
          onClick={() => window.dispatchEvent(new CustomEvent('frost-quick-action', { detail: { type: 'bottle-control', enabled: false } }))}
        >
          Disable Water Consumption
        </button> */}
      </div>
      <p className="device-bottle-controls-help">
        {isDeviceConnected
          ? 'Choose whether water consumption learning is enabled on your FROST Aura device.'
          : 'Connect a FROST Aura device to enable  water consumption learning.'}
      </p>
    </article>
  );
}