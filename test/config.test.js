import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, hasCredentials, normalizeConfig } from '../src/config.js';

test('an empty config gets the defaults', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.equal(hasCredentials(normalizeConfig()), false);
});

test('the types are forced, whatever the form sent', () => {
  const config = normalizeConfig({
    username: '  me@example.com ',
    password: 'p',
    poll_frequency: '120',
    strict_tls: 'false',
    api_type: 'nope',
  });
  assert.equal(config.username, 'me@example.com');
  assert.equal(config.poll_frequency, 120);
  assert.equal(config.strict_tls, false);
  assert.equal(config.api_type, 'aqua_temp');
  assert.equal(hasCredentials(config), true);
});

test('the refresh interval stays between one minute and one hour', () => {
  assert.equal(normalizeConfig({ poll_frequency: 5 }).poll_frequency, 60);
  assert.equal(normalizeConfig({ poll_frequency: 99999 }).poll_frequency, 3600);
  assert.equal(normalizeConfig({ poll_frequency: 'abc' }).poll_frequency, 60);
});
