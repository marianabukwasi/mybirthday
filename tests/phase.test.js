import test from 'node:test';
import assert from 'node:assert/strict';
import { getPhase, daysUntilBirthday, isAdult, canSendWishes, vaultUnlocked } from '../lib/phase.js';

const TZ = 'Europe/Stockholm';
const at = (iso) => new Date(iso);

test('birthday day is the reveal; vault unlocked', () => {
  const p = getPhase('1995-12-17', TZ, at('2026-12-17T12:00:00+01:00'));
  assert.equal(p, 'reveal');
  assert.ok(vaultUnlocked(p));
});

test('last second before midnight is still sealed vault', () => {
  const p = getPhase('1995-12-17', TZ, at('2026-12-16T23:59:59+01:00'));
  assert.equal(p, 'vault');
  assert.ok(!vaultUnlocked(p));
});

test('00:00 in owner time zone flips to reveal (not UTC)', () => {
  // 23:00 UTC on 16 Dec = 00:00 on 17 Dec in Stockholm
  assert.equal(getPhase('1995-12-17', TZ, at('2026-12-16T22:59:59Z')), 'vault');
  assert.equal(getPhase('1995-12-17', TZ, at('2026-12-16T23:00:00Z')), 'reveal');
});

test('countdown is day 100 to 91, vault day 90 to 1', () => {
  assert.equal(daysUntilBirthday('1995-12-17', TZ, at('2026-09-08T12:00:00+02:00')), 100);
  assert.equal(getPhase('1995-12-17', TZ, at('2026-09-08T12:00:00+02:00')), 'countdown');
  assert.equal(getPhase('1995-12-17', TZ, at('2026-09-17T12:00:00+02:00')), 'countdown'); // day 91
  assert.equal(getPhase('1995-12-17', TZ, at('2026-09-18T12:00:00+02:00')), 'vault');     // day 90
});

test('afterglow lasts 30 days, then supporter', () => {
  assert.equal(getPhase('1995-12-17', TZ, at('2026-12-18T12:00:00+01:00')), 'afterglow');
  assert.equal(getPhase('1995-12-17', TZ, at('2027-01-16T12:00:00+01:00')), 'afterglow'); // +30
  assert.equal(getPhase('1995-12-17', TZ, at('2027-01-17T12:00:00+01:00')), 'supporter'); // +31
});

test('wishes: open in vault/reveal, late only if allowed', () => {
  assert.ok(canSendWishes('vault', false));
  assert.ok(canSendWishes('reveal', false));
  assert.ok(!canSendWishes('afterglow', false));
  assert.ok(canSendWishes('afterglow', true));
  assert.ok(!canSendWishes('supporter', true));
  assert.ok(!canSendWishes('countdown', true));
});

test('18+ check', () => {
  const now = at('2026-11-18T12:00:00Z');
  assert.ok(isAdult('2008-11-18', now));
  assert.ok(!isAdult('2008-11-19', now));
  assert.ok(!isAdult('garbage', now));
});
