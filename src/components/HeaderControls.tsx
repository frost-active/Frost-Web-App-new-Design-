type Props = {
  volume: number;
  dndEnabled: boolean;
  isDeviceConnected: boolean;
  onVolumeChange: (value: number) => void;
  onDnd: () => void;
};

export default function HeaderControls({ volume, dndEnabled, isDeviceConnected, onVolumeChange, onDnd }: Props) {
  const safeVolume = Math.min(30, Math.max(0, Number(volume) || 0));

  return (
    <div className="header-controls" aria-label="Device controls">
      <label className="header-volume" htmlFor="headerVolume">
        <span>Volume</span>
        <output htmlFor="headerVolume">{safeVolume}</output>
        <input
          id="headerVolume"
          type="range"
          min="0"
          max="30"
          step="1"
          value={safeVolume}
          aria-label="Volume from 0 to 30"
          aria-valuemin={0}
          aria-valuemax={30}
          aria-valuenow={safeVolume}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
        />
      </label>
      <button
        className={`gridtog dnd-toggle${dndEnabled ? ' on' : ''}`}
        type="button"
        onClick={onDnd}
        disabled={!isDeviceConnected}
        aria-label={`Do Not Disturb ${dndEnabled ? 'on' : 'off'}`}
        aria-pressed={dndEnabled}
        title={isDeviceConnected ? `Do Not Disturb ${dndEnabled ? 'on' : 'off'}` : 'Connect a FROST Aura to change Do Not Disturb'}
      >
        DND<span className="sw" aria-hidden="true" />
      </button>
    </div>
  );
}