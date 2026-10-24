import * as React from 'react';
import type { ChallengeDraftRing } from './ChallengeDial';

export type ChallengeDraftEntry = ChallengeDraftRing;

type Props = {
  drafts: ChallengeDraftEntry[];
  selectedId: string | null;
  headingId?: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove?: (id: string) => void;
  disabled?: boolean;
};

export default function ChallengeDraftRail({ drafts, selectedId, headingId = 'your-challenges-title', onSelect, onAdd, onRemove, disabled = false }: Props) {
  return (
    <section className="challenge-draft-rail" aria-labelledby={headingId}>
      <header>
        <div>
          <h2 id={headingId}>Your Challenges</h2>
          <p>{drafts.length ? `${drafts.length} ${drafts.length === 1 ? 'draft' : 'drafts'}` : 'Set up a challenge for your schedule.'}</p>
        </div>
      </header>
      {drafts.length > 0 && <ul className="challenge-draft-list" aria-label="Challenge drafts">
        {drafts.map((draft, index) => (
          <li key={draft.id}>
            <div className="challenge-draft-row">
              <button
                type="button"
                className={`challenge-draft-option${draft.id === selectedId ? ' is-selected' : ''}`}
                aria-pressed={draft.id === selectedId}
                disabled={disabled}
                onClick={() => onSelect(draft.id)}
              >
                <span className="challenge-draft-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="challenge-draft-label">{draft.name.trim() || 'Untitled challenge'}</span>
                <span className="challenge-draft-status">Draft</span>
              </button>
              {onRemove && <button type="button" className="challenge-draft-remove"
                aria-label={`Delete ${draft.name.trim() || 'untitled challenge'} draft`}
                title="Delete this unsent challenge" disabled={disabled} onClick={() => onRemove(draft.id)}>Delete</button>}
            </div>
          </li>
        ))}
      </ul>}
      {drafts.length === 0 && <p className="challenge-draft-empty">No challenges yet. Add one to start choosing its schedule.</p>}
      <button type="button" className="challenge-add-button" disabled={disabled} onClick={onAdd}>+ Add challenge</button>
    </section>
  );
}
