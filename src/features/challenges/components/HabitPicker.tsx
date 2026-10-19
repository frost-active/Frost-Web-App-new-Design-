import * as React from 'react';
import type { ChallengeableHabit } from '../services/challengeRules';

type Props = { habits: ChallengeableHabit[]; value: string; onChange: (habitId: string) => void };

export default function HabitPicker({ habits, value, onChange }: Props) {
  return (
    <fieldset className="challenge-form-field">
      <legend>Choose a custom habit</legend>
      <div className="challenge-habit-options">
        {habits.map((habit) => {
          const id = habit.id || habit.habitId || '';
          const label = habit.label || habit.name || 'Custom habit';
          return <label key={id} className="challenge-habit-option">
            <input type="radio" name="challenge-habit" value={id} checked={value === id} onChange={() => onChange(id)} />
            <span>{label}</span>
          </label>;
        })}
        {!habits.length && <p className="challenge-muted">Add and sync a custom habit before starting a challenge.</p>}
      </div>
    </fieldset>
  );
}