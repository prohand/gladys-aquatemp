import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { AquaTempClient, AuthError, parseFlag } from '../src/aquatemp/api.js';
import { API_TYPES } from '../src/config.js';
import { createFakeCloud, HEATING_VALUES } from './helpers/fakeCloud.js';

const client = (cloud, overrides = {}) =>
  new AquaTempClient({
    username: 'me@example.com',
    password: 'secret',
    post: cloud.post,
    ...overrides,
  });

test('the login sends the MD5 of the password, never the password itself', async () => {
  const cloud = createFakeCloud();
  await client(cloud).login();
  const [login] = cloud.calls;
  assert.equal(login.endpoint, 'app/user/login');
  assert.equal(login.body.password, createHash('md5').update('secret').digest('hex'));
  assert.ok(!JSON.stringify(cloud.calls).includes('"secret"'));
});

test('a wrong password is an AuthError', async () => {
  const cloud = createFakeCloud();
  await assert.rejects(client(cloud, { password: 'wrong' }).login(), AuthError);
});

test('every call after the login carries the token', async () => {
  const cloud = createFakeCloud();
  cloud.addPump({ code: 'ABC123', values: HEATING_VALUES });
  await client(cloud).listDevices();
  for (const call of cloud.calls.slice(1)) {
    assert.equal(call.headers['x-token'], 'token-1', call.endpoint);
  }
});

test('an expired token gets one new login and the call is replayed', async () => {
  const cloud = createFakeCloud();
  cloud.addPump({ code: 'ABC123', values: HEATING_VALUES });
  const api = client(cloud);
  await api.listDevices();
  cloud.expireToken();
  const values = await api.readValues('ABC123', ['T02']);
  assert.deepEqual(values, { T02: '24.5' });
  assert.equal(cloud.tokens, 2);
});

test('own and shared heat pumps are listed once each', async () => {
  const cloud = createFakeCloud();
  cloud.addPump({ code: 'OWN1', name: 'Pool' });
  cloud.addPump({ code: 'SHARED1', name: 'Spa', shared: true, online: false, fault: 'true' });
  cloud.addPump({ code: 'OWN1', name: 'Pool again', shared: true });
  const devices = await client(cloud).listDevices();
  assert.deepEqual(
    devices.map(({ code, name, online, fault }) => ({ code, name, online, fault })),
    [
      { code: 'OWN1', name: 'Pool', online: true, fault: false },
      { code: 'SHARED1', name: 'Spa', online: false, fault: true },
    ],
  );
});

test('a control writes every value as a string, in one order', async () => {
  const cloud = createFakeCloud();
  cloud.addPump({ code: 'ABC123', values: HEATING_VALUES });
  await client(cloud).control('ABC123', [
    { code: 'R02', value: 30 },
    { code: 'Set_Temp', value: 30 },
  ]);
  assert.deepEqual(cloud.controls, [
    { device: 'ABC123', code: 'R02', value: '30' },
    { device: 'ABC123', code: 'Set_Temp', value: '30' },
  ]);
});

test('the legacy server: snake_case keys, .json suffix and keep-alive', async () => {
  const cloud = createFakeCloud({ legacy: true });
  cloud.addPump({ code: 'OLD1', values: HEATING_VALUES });
  const api = client(cloud, { apiType: API_TYPES.AQUA_TEMP_LEGACY });
  const [device] = await api.listDevices();
  assert.equal(device.code, 'OLD1');
  const values = await api.readValues('OLD1', ['Power', 'T02']);
  assert.deepEqual(values, { Power: '1', T02: '24.5' });
  assert.ok(
    cloud.calls.some((call) => call.endpoint === 'device/sendDevicePassthroughInstruction'),
  );
});

test('the fault text of a heat pump in fault', async () => {
  const cloud = createFakeCloud();
  cloud.addPump({ code: 'ABC123', fault: true });
  cloud.faults.ABC123 = 'E03 water flow';
  assert.equal(await client(cloud).readFault('ABC123'), 'E03 water flow');
});

test('the cloud flags are read whatever their spelling', () => {
  for (const yes of [true, 1, '1', 'true', 'TRUE']) assert.equal(parseFlag(yes), true);
  for (const no of [false, 0, '0', 'false', '', null, undefined])
    assert.equal(parseFlag(no), false);
});
