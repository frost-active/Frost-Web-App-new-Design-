import { useEffect, useState } from 'react';

type SettingsProps = {
  displaySeconds: number;
  onDisplaySecondsChange: (seconds: number) => void;
};

export default function Settings({ displaySeconds, onDisplaySecondsChange }: SettingsProps) {
  const [draftValue, setDraftValue] = useState(String(displaySeconds));

  useEffect(() => {
    setDraftValue(String(displaySeconds));
  }, [displaySeconds]);

  const applyDraft = (nextValue: string) => {
    if (nextValue === '') {
      setDraftValue('');
      return;
    }

    const digitsOnly = nextValue.replace(/\D/g, '');
    const parsed = Number(digitsOnly);

    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 3600) {
      setDraftValue(digitsOnly);
      return;
    }

    const rounded = Math.round(parsed);
    onDisplaySecondsChange(rounded);
    setDraftValue(String(rounded));
  };

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
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={draftValue}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (nextValue === '') {
                    setDraftValue('');
                    return;
                  }

                  const digitsOnly = nextValue.replace(/\D/g, '');
                  setDraftValue(digitsOnly);

                  if (digitsOnly === '') return;

                  const parsed = Number(digitsOnly);
                  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 3600) {
                    onDisplaySecondsChange(Math.round(parsed));
                  }
                }}
                onBlur={() => {
                  if (draftValue === '') {
                    setDraftValue(String(displaySeconds));
                    return;
                  }

                  const parsed = Number(draftValue);
                  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 3600) {
                    setDraftValue(String(displaySeconds));
                    return;
                  }

                  const rounded = Math.round(parsed);
                  onDisplaySecondsChange(rounded);
                  setDraftValue(String(rounded));
                }}
                aria-describedby="displayDurationHelp"
                aria-label="Display duration in seconds"
                style={{ appearance: 'textfield' }}
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
