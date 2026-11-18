// Phase engine: derives the cycle phase from a LOCKED birth date + home time zone.
// Phases (Master Document §2): supporter, countdown, vault, reveal, afterglow.

function partsInZone(date, tz) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const [y, m, d] = f.format(date).split('-').map(Number);
  return { y, m, d };
}

const dayNumber = (y, m, d) => Date.UTC(y, m - 1, d) / 86400000;

// birthDate: 'YYYY-MM-DD'. Returns whole days until the next birthday occurrence
// (0 = today), computed in the owner's time zone.
export function daysUntilBirthday(birthDate, tz, now = new Date()) {
  const [, bm, bd] = birthDate.split('-').map(Number);
  const t = partsInZone(now, tz);
  const today = dayNumber(t.y, t.m, t.d);
  let next = dayNumber(t.y, bm, bd);
  // Feb 29 births celebrate Feb 28 in non-leap years
  if (bm === 2 && bd === 29 && new Date(Date.UTC(t.y, 1, 29)).getUTCMonth() !== 1) next = dayNumber(t.y, 2, 28);
  if (next < today) {
    const y2 = t.y + 1;
    next = (bm === 2 && bd === 29 && new Date(Date.UTC(y2, 1, 29)).getUTCMonth() !== 1)
      ? dayNumber(y2, 2, 28) : dayNumber(y2, bm, bd);
  }
  return next - today;
}

// Days since the most recent birthday (0 = today).
export function daysSinceBirthday(birthDate, tz, now = new Date()) {
  const [, bm, bd] = birthDate.split('-').map(Number);
  const t = partsInZone(now, tz);
  const today = dayNumber(t.y, t.m, t.d);
  let last = dayNumber(t.y, bm, bd);
  if (last > today) last = dayNumber(t.y - 1, bm, bd);
  return today - last;
}

export function getPhase(birthDate, tz, now = new Date()) {
  const until = daysUntilBirthday(birthDate, tz, now);
  const since = daysSinceBirthday(birthDate, tz, now);
  if (until === 0) return 'reveal';
  if (since >= 1 && since <= 30) return 'afterglow';
  if (until >= 91 && until <= 100) return 'countdown';
  if (until >= 1 && until <= 90) return 'vault';
  return 'supporter';
}

// Is the vault readable? Only on the birthday itself and afterwards (afterglow).
export function vaultUnlocked(phase) {
  return phase === 'reveal' || phase === 'afterglow';
}

// Can guests send new wishes right now? Late wishes only if the owner allows it.
export function canSendWishes(phase, allowLate) {
  if (phase === 'vault' || phase === 'reveal') return true;
  if (phase === 'afterglow') return !!allowLate;
  return false;
}

export function isAdult(birthDate, now = new Date()) {
  const [y, m, d] = birthDate.split('-').map(Number);
  if (!y || !m || !d) return false;
  let age = now.getUTCFullYear() - y;
  const had = now.getUTCMonth() + 1 > m || (now.getUTCMonth() + 1 === m && now.getUTCDate() >= d);
  if (!had) age -= 1;
  return age >= 18;
}

// Master Doc §7: cash gifts stay off for Uganda and Kenya until a payout route is decided.
export const cashEnabledFor = (country) => !['uganda', 'kenya'].includes(String(country).trim().toLowerCase());

// Master Doc §4: Birthday deals unlock 30 days before a birthday and close 7 days after.
export function dealsUnlocked(birthDate, tz, now = new Date()) {
  const until = daysUntilBirthday(birthDate, tz, now);
  const since = daysSinceBirthday(birthDate, tz, now);
  return until <= 30 || since <= 7;
}

export function getZodiac(birthDate) {
  const [, m, d] = String(birthDate || '').split('-').map(Number);
  if (!m || !d) return 'Unknown';
  const signs = [
    [1, 19, 'Capricorn'], [2, 18, 'Aquarius'], [3, 20, 'Pisces'], [4, 19, 'Aries'],
    [5, 20, 'Taurus'], [6, 20, 'Gemini'], [7, 22, 'Cancer'], [8, 22, 'Leo'],
    [9, 22, 'Virgo'], [10, 22, 'Libra'], [11, 21, 'Scorpio'], [12, 21, 'Sagittarius'],
    [12, 31, 'Capricorn'],
  ];
  for (const [sm, sd, name] of signs) {
    if (m < sm || (m === sm && d <= sd)) return name;
  }
  return 'Capricorn';
}

export function validTimeZone(tz) {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}
