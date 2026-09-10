type SettingsProps = {
  displaySeconds: number;
  onDisplaySecondsChange: (seconds: number) => void;
};

export default function Settings({ displaySeconds, onDisplaySecondsChange }: SettingsProps) {
  return (
    <section className="settings-page" aria-label="Settings">
      <div className="ptitle">Settings</div>
      <p className="psub">Configure how FROST Aura presents your reminders.</p>
      <div className="settings-stack">
        <article className="card settings-card">
          <h2>Display Setting</h2>
          <p className="settings-lead">Centralized display duration for all reminders.</p>
          <label className="settings-field" htmlFor="displayDuration">
            <span>Display Duration</span>
            <div className="settings-number">
              <input
                id="displayDuration"
                type="number"
                min="1"
                max="3600"
                step="1"
                value={displaySeconds}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value) && value >= 1 && value <= 3600) onDisplaySecondsChange(Math.round(value));
                }}
                aria-describedby="displayDurationHelp"
              />
              <span>seconds</span>
            </div>
          </label>
          <p className="settings-help" id="displayDurationHelp">How long reminder messages are shown on the device display. Applies to all features and reminders.</p>
        </article>
      </div>
    </section>
  );
}
