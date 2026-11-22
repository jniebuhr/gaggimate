import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseAutoWakeupSchedules,
  serializeAutoWakeupSchedules,
} from '../src/pages/Settings/settingsForm.js';

const ALL_DAYS = [true, true, true, true, true, true, true];

test('old two-field rows stay readable and keep their form', () => {
  const schedules = parseAutoWakeupSchedules('07:00|1111111');
  assert.deepEqual(schedules, [{ time: '07:00', days: ALL_DAYS, offTime: '' }]);
  assert.equal(serializeAutoWakeupSchedules(schedules), '07:00|1111111');
});

test('an off time round-trips as a third field', () => {
  const raw = '08:00|1111100|12:30;16:00|1111111';
  assert.equal(serializeAutoWakeupSchedules(parseAutoWakeupSchedules(raw)), raw);
});
