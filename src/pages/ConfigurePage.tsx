import { useState } from 'react';
import '../components/configure/configure.css';
import ConfigureDial, { DialHint } from '../components/configure/ConfigureDial';
import HabitRail from '../components/configure/HabitRail';
import HabitEditor from '../components/configure/HabitEditor';
import Challenges from '../components/configure/Challenges';
import { useMyDay } from '../components/configure/useMyDay';
import type { MyDayStore } from '../components/configure/store';

type Props = { store: MyDayStore };

/* Left column, top: the day clock (with its hint). It sits inside the dial card that
   the dashboard shell owns, next to the "Sync Now" button. */
export function ConfigureClockPanel({ store }: Props) {
  const snap = useMyDay(store);
  return (
    <>
      <ConfigureDial snap={snap} store={store} />
      <DialHint snap={snap} />
    </>
  );
}

/* Left column, below the dial card: challenges — same column as the clock, per the
   "My day" prototype's own layout. */
export function ConfigureChallengesPanel({ store }: Props) {
  const snap = useMyDay(store);
  return <Challenges snap={snap} store={store} />;
}

/* Right column: your habits, and the editor for whichever is selected (or the "Add a
   habit" chooser). The Aura chat card that follows is still owned by the shell. */
export function ConfigureSidePanel({ store }: Props) {
  const snap = useMyDay(store);
  const [addOpen, setAddOpen] = useState(false);
  return (
    <>
      <HabitRail snap={snap} store={store} addOpen={addOpen} onAddOpen={() => setAddOpen(true)} onSelect={() => setAddOpen(false)} />
      <HabitEditor snap={snap} store={store} addOpen={addOpen} onAddClose={() => setAddOpen(false)} />
    </>
  );
}

/* All three panels as one page — handy for tests or if the shell is ever moved to React. */
export default function ConfigurePage({ store }: Props) {
  return (
    <section id="page-configure">
      <div className="ptitle">My day</div>
      <p className="psub">Every habit you add becomes an arc on the dial — that is when Aura cues it — and a loop on the rim — that is how far into your streak you are.</p>
      <div className="cfg-daygrid">
        <div className="cfg-daycol">
          <div className="clockcard cfg-dialcard"><ConfigureClockPanel store={store} /></div>
          <ConfigureChallengesPanel store={store} />
        </div>
        <div className="cfg-daycol cfg-side">
          <div className="cfg-daycol"><ConfigureSidePanel store={store} /></div>
        </div>
      </div>
    </section>
  );
}
