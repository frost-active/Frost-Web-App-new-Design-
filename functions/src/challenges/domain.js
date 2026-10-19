const PREDEFINED_NAMES = new Set([
  'hydration', 'medication', 'eye break', 'stretch', 'walk',
  'meditation', 'bottle clean', 'healing', 'pomodoro',
]);
const DURATION_PRESETS = new Set([7, 14, 21, 30]);

function isISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function dateInTimezone(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function minuteInTimezone(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

function computeEndDate(startDate, durationDays, activeDays = []) {
  if (!isISODate(startDate)) throw new Error('Start date must use YYYY-MM-DD.');
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 90) {
    throw new Error('Duration must be a whole number between 1 and 90 days.');
  }
  const week = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  if (!Array.isArray(activeDays) || activeDays.some((day) => !week.includes(day)) || new Set(activeDays).size !== activeDays.length) {
    throw new Error('Choose valid active days.');
  }
  const selectedDays = new Set(activeDays.length ? activeDays : week);
  const end = new Date(`${startDate}T00:00:00.000Z`);
  let scheduledDays = 0;
  while (scheduledDays < durationDays) {
    if (selectedDays.has(week[end.getUTCDay()])) scheduledDays += 1;
    if (scheduledDays < durationDays) end.setUTCDate(end.getUTCDate() + 1);
  }
  return end.toISOString().slice(0, 10);
}

function allocateCustomId(events, reservedIds = []) {
  let max = 0;
  [...events.map((event) => event?.id), ...reservedIds].forEach((id) => {
    const match = String(id || '').match(/^custom_(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
  });
  return `custom_${String(max + 1).padStart(3, '0')}`;
}

function chooseCustomId(events, reservedIds, requestedId) {
  const usedIds = new Set([...events.map((event) => event?.id), ...reservedIds]);
  return typeof requestedId === 'string' && /^custom_\d+$/.test(requestedId) && !usedIds.has(requestedId)
    ? requestedId
    : allocateCustomId(events, reservedIds);
}

function validDuration(days) {
  return DURATION_PRESETS.has(days) || (Number.isInteger(days) && days >= 1 && days <= 90);
}

function firstCueMinute(challenge) {
  const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const startWeekday = weekdays[new Date(`${challenge.startDate}T00:00:00.000Z`).getUTCDay()];
  const days = Array.isArray(challenge.habit?.days) ? challenge.habit.days : [];
  if (days.length && !days.includes(startWeekday)) return 1440;
  const times = Array.isArray(challenge.habit?.times) ? challenge.habit.times : [];
  const minutes = times.map(({ h, m }) => h * 60 + m).filter(Number.isFinite);
  return minutes.length ? Math.min(...minutes) : 0;
}

function canAcceptChallenge(challenge, today, currentMinuteOfDay) {
  if (today < challenge.startDate) return true;
  if (today > challenge.startDate) return false;
  return currentMinuteOfDay < firstCueMinute(challenge);
}

function lifecycleAction(challenge, today, acceptedCount, currentMinuteOfDay = 1440) {
  if (challenge.status === 'pending' && today >= challenge.startDate) {
    if (today === challenge.startDate && currentMinuteOfDay < firstCueMinute(challenge)) return null;
    return acceptedCount > 1 ? 'activate' : 'cancel';
  }
  if (challenge.status === 'active' && today > challenge.endDate) return 'complete';
  return null;
}

function meetsLead(startDate, serverToday) {
  if (!isISODate(startDate) || !isISODate(serverToday)) return false;
  return startDate >= serverToday;
}

function isChallengeableEvent(event, metadata) {
  if (!event || typeof event !== 'object' || !event.id) return false;
  if (metadata?.challengeId && (metadata.challengeRole !== 'source' || !['completed', 'cancelled'].includes(metadata.challengeStatus))) return false;
  const label = String(event.label || '').trim().toLowerCase();
  if (PREDEFINED_NAMES.has(label)) return false;
  return true;
}

function addDays(value, amount) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function calculateStanding(participant, checkins, startDate, endDate, today) {
  const completed = new Map();
  checkins.forEach((checkin) => {
    if (isISODate(checkin.day) && checkin.day >= startDate && checkin.day <= endDate) {
      const previous = completed.get(checkin.day);
      if (previous === undefined || checkin.completedAt < previous) completed.set(checkin.day, checkin.completedAt);
    }
  });
  const days = [...completed.keys()].sort();
  let currentStreak = 0;
  const currentDay = today < endDate ? today : endDate;
  for (let day = currentDay; day >= startDate && completed.has(day); day = addDays(day, -1)) currentStreak += 1;

  let longestStreak = 0;
  let streak = 0;
  let previousDay = null;
  days.forEach((day) => {
    streak = previousDay && addDays(previousDay, 1) === day ? streak + 1 : 1;
    longestStreak = Math.max(longestStreak, streak);
    previousDay = day;
  });
  const lastCompletedDay = days.at(-1) || null;
  return {
    uid: participant.uid,
    displayName: participant.displayName,
    photoURL: participant.photoURL || null,
    daysCompleted: days.length,
    currentStreak,
    longestStreak,
    lastCompletedDay,
    lastCompletedAt: lastCompletedDay ? completed.get(lastCompletedDay) : null,
  };
}

function rankStandings(rows) {
  const sorted = rows.slice().sort((left, right) => right.daysCompleted - left.daysCompleted
    || right.longestStreak - left.longestStreak
    || (left.lastCompletedAt ?? Number.POSITIVE_INFINITY) - (right.lastCompletedAt ?? Number.POSITIVE_INFINITY));
  let rank = 0;
  let previous = null;
  return sorted.map((row, index) => {
    const tied = previous
      && row.daysCompleted === previous.daysCompleted
      && row.longestStreak === previous.longestStreak
      && row.lastCompletedAt === previous.lastCompletedAt;
    if (!tied) rank = index + 1;
    const ranked = { ...row, rank };
    previous = ranked;
    return ranked;
  });
}

module.exports = {
  allocateCustomId,
  addDays,
  canAcceptChallenge,
  calculateStanding,
  chooseCustomId,
  computeEndDate,
  dateInTimezone,
  isChallengeableEvent,
  isISODate,
  lifecycleAction,
  minuteInTimezone,
  meetsLead,
  rankStandings,
  validDuration,
};