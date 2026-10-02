import { cn, cssVars, unitFor } from './format';
import { dayOf, type MyDayStore, type Snapshot } from './store';
import { MiniProgress } from './ConfigureDial';

type Props = { snap: Snapshot; store: MyDayStore; addOpen: boolean; onAddOpen: () => void; onSelect: () => void };

export default function HabitRail({ snap, store, addOpen, onAddOpen, onSelect }: Props) {
  const running = snap.onDial.filter((h) => !h.formed).length;
  return (
    <div className={cn('card')}>
      <h2>Your habits <span className={cn('r')}>{running} running</span></h2>
      {!snap.habits.length ? (
        <p className={cn('empty')}>Nothing here yet. Add a habit and it appears on the dial straight away — you decide what it is, how often Aura asks, and how much counts as a day done.</p>
      ) : (
        <>
          <div className={cn('rail')}>
            {snap.habits.map((h) => (
              <button
                key={h.id}
                type="button"
                className={`${cn('hrow')}${h.parked ? ` ${cn('parked')}` : ''}`}
                aria-pressed={snap.selected?.id === h.id}
                style={cssVars({ '--c': h.color })}
                onClick={() => { store.select(h); onSelect(); }}
              >
                <span className={cn('pill')} aria-hidden="true" />
                <span className={cn('mini')}><MiniProgress h={h} /></span>
                <span className={cn('nm')}>
                  {h.label || h.name}
                  <small>{h.done} of {h.target} {unitFor(h.target, h.unit)} · {h.times.length} cue{h.times.length === 1 ? '' : 's'}{h.formed ? ' · formed' : h.parked ? ' · parked' : ''}</small>
                </span>
                <span className={cn('stk')}>{dayOf(h)}<small>DAYS</small></span>
              </button>
            ))}
          </div>
          {!addOpen && (
            <div className={cn('rowbtns')}>
              <button type="button" className={cn('btn pri grow')} onClick={onAddOpen}>Add a habit</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
