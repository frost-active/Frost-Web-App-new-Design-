
type Props = {
  volume: number;
  onVolumeChange: (value: number) => void;
  onWifi: () => void;
  onDnd: () => void;
  onSetTime: () => void;
  onUpdate: () => void;
};

export default function QuickActions({
  volume,
  onVolumeChange,
  onWifi,
  onDnd,
  onSetTime,
  onUpdate,
}: Props) {
  // Keep volume safely within the slider range.
  const safeVolume = Math.min(30, Math.max(0, Number(volume) || 0));

  const handleVolumeChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newVolume = Number(event.target.value);

    if (!Number.isNaN(newVolume)) {
      onVolumeChange(Math.min(30, Math.max(0, newVolume)));
    }
  };

  return (
    <section className="quick-actions" aria-label="Quick Actions">
      <div className="quick-heading">
        <h2>Quick Actions</h2>
      </div>

      <div className="quick-controls">
        <label className="volume-control" htmlFor="quickVolume">
          <span>Volume</span>

          <output id="quickVolumeValue" htmlFor="quickVolume">
            {safeVolume}
          </output>

          <input
            id="quickVolume"
            type="range"
            min="0"
            max="30"
            step="1"
            value={safeVolume}
            aria-label="Volume from 0 to 30"
            aria-valuemin={0}
            aria-valuemax={30}
            aria-valuenow={safeVolume}
            onChange={handleVolumeChange}
          />
        </label>

        <button
          className="quick-btn"
          type="button"
          onClick={onWifi}
        >
          <span className="quick-icon">⌁</span>
          Wi-Fi Settings
        </button>

        <button
          className="quick-btn"
          type="button"
          onClick={onDnd}
        >
          <span className="quick-icon">◐</span>
          Do Not Disturb
        </button>

        <button
          className="quick-btn"
          type="button"
          onClick={onSetTime}
        >
          <span className="quick-icon">◷</span>
          Set Time
        </button>

        <button
          className="quick-btn quick-btn-accent"
          type="button"
          onClick={onUpdate}
        >
          <span className="quick-icon">↻</span>
          Update
        </button>
      </div>
    </section>
  );
}
