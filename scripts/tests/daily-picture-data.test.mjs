import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { DAILY_PICTURES, dailyPictureDay, normalizeDailyPictureConfig, getDailyPicture, nextDailyPicturePatch } from '../../src/personalized-home-2-0/board/daily-picture-data.js';

test('a daily picture is stable throughout a local day and changes at midnight', () => {
  const morning = new Date(2026, 10, 11, 0, 0, 0);
  const night = new Date(2026, 10, 11, 23, 59, 59);
  const tomorrow = new Date(2026, 10, 12, 0, 0, 0);
  assert.equal(dailyPictureDay(morning), '2026-11-11');
  assert.equal(getDailyPicture({}, morning).src, getDailyPicture({}, night).src);
  assert.notEqual(getDailyPicture({}, morning).id, getDailyPicture({}, tomorrow).id);
});

test('refresh persists on the same day, cycles without immediate repetition, and expires next day', () => {
  const now = new Date(2026, 10, 11, 12);
  const initial = getDailyPicture({}, now);
  const patch = nextDailyPicturePatch({}, now);
  assert.notEqual(patch.pictureId, initial.id);
  assert.equal(getDailyPicture(JSON.parse(JSON.stringify(patch)), now).id, patch.pictureId);
  assert.equal(nextDailyPicturePatch(patch, now).pictureId, initial.id);
  const later = new Date(2026, 10, 13, 12);
  assert.equal(getDailyPicture(patch, later).id, getDailyPicture({}, later).id);
});

test('theme changes lighting while preserving the current scene and refresh selection', () => {
  const now = new Date(2026, 10, 11);
  const patch = nextDailyPicturePatch({}, now);
  const light = getDailyPicture(patch, now, 'light');
  const dark = getDailyPicture(patch, now, 'dark');
  assert.equal(light.id, dark.id);
  assert.notEqual(light.src, dark.src);
  assert.match(light.src, /-morning\.webp$/);
  assert.match(dark.src, /-dusk\.webp$/);
});

test('legacy uploaded photos are retained and can be explicitly returned to the daily collection', () => {
  const uploaded = { photo: 'data:image/jpeg;base64,YQ==', caption: 'A memory' };
  assert.equal(normalizeDailyPictureConfig(uploaded).source, 'photo');
  const daily = normalizeDailyPictureConfig({ ...uploaded, source: 'daily' });
  assert.equal(daily.source, 'daily');
  assert.equal(daily.photo, uploaded.photo);
  assert.equal(daily.caption, uploaded.caption);
  assert.equal(normalizeDailyPictureConfig({ ...daily, source: 'photo' }).source, 'photo');
});

test('invalid stored dates, picture identities and photo inputs fall back safely', () => {
  for (const pictureDay of ['2026-02-30', '2026-13-01', '2026-00-11', '2026-11-00', {}, null]) {
    const config = normalizeDailyPictureConfig({ pictureDay, pictureId: '../secret', photo: 'https://external.invalid/p.jpg', source: 'photo' });
    assert.equal(config.pictureDay, '');
    assert.equal(config.pictureId, '');
    assert.equal(config.photo, '');
    assert.equal(config.source, 'daily');
  }
  assert.equal(normalizeDailyPictureConfig({ pictureDay: '2028-02-29' }).pictureDay, '2028-02-29');
  assert.equal(normalizeDailyPictureConfig({ pictureDay: '2027-02-29' }).pictureDay, '');
  assert.equal(dailyPictureDay(new Date(NaN)), '');
  assert.ok(DAILY_PICTURES.some(entry => entry.id === getDailyPicture({}, new Date(NaN)).id));
});

test('daily rotation follows local calendar dates across daylight-saving changes', () => {
  const script = `
    import { dailyPictureDay, getDailyPicture } from './src/personalized-home-2-0/board/daily-picture-data.js';
    const times = [new Date(2026,2,8,0,0),new Date(2026,2,8,23,59),new Date(2026,2,9,0,0),new Date(2026,10,1,0,0),new Date(2026,10,1,23,59),new Date(2026,10,2,0,0)];
    process.stdout.write(JSON.stringify(times.map(date=>({day:dailyPictureDay(date),id:getDailyPicture({},date).id}))));
  `;
  const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: new URL('../../', import.meta.url), env: { ...process.env, TZ: 'America/New_York' }, encoding: 'utf8' }));
  assert.equal(result[0].day, result[1].day);
  assert.equal(result[0].id, result[1].id);
  assert.notEqual(result[1].id, result[2].id);
  assert.equal(result[3].day, result[4].day);
  assert.equal(result[3].id, result[4].id);
  assert.notEqual(result[4].id, result[5].id);
});
