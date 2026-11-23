import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idsFor } from '../src/devices/heatPump.js';
import { SCENE_TRIGGERS } from '../src/capabilities/triggers.js';
import { setup, settle } from './helpers/setup.js';

async function ready(options) {
  const env = setup(options);
  await env.fleet.refresh();
  const pump = env.fleet.list()[0];
  const ids = idsFor(env.gladys, pump);
  return { ...env, pump, ids };
}

test('a poll publishes what the heat pump reads', async () => {
  const { gladys, fleet, ids } = await ready();
  assert.equal(await fleet.poll(ids.device), true);
  assert.equal(gladys.fake.lastState(ids.feature('power')), 1);
  assert.equal(gladys.fake.lastState(ids.feature('mode')), 2); // heating
  assert.equal(gladys.fake.lastState(ids.feature('target-temperature')), 28);
  assert.equal(gladys.fake.lastState(ids.feature('silent-mode')), 0);
  assert.equal(gladys.fake.lastState(ids.feature('water-inlet-temperature')), 24.5);
  assert.equal(gladys.fake.lastState(ids.feature('ambient-temperature')), 18.3);
});

test('polls between two reads are skipped, at the interval of the config', async () => {
  const { fleet, clock, ids, config } = await ready();
  fleet.configure({ ...config, poll_frequency: 300 });
  assert.equal(await fleet.poll(ids.device), true);
  clock.now += 60_000;
  assert.equal(await fleet.poll(ids.device), false);
  clock.now += 240_000;
  assert.equal(await fleet.poll(ids.device), true);
});

test('a first listing that failed is retried by the next poll', async () => {
  const env = setup();
  env.cloud.down = true;
  await assert.rejects(env.fleet.refresh());
  env.cloud.down = false;
  const device = 'ext:aqua-temp:heat-pump:abc123';
  assert.equal(await env.fleet.poll(device), true);
  assert.equal(env.gladys.fake.lastState(`${device}:power`), 1);
});

test('turning off writes the lower-case power code and publishes 0', async () => {
  const { gladys, cloud, fleet, ids } = await ready();
  await fleet.poll(ids.device);
  await fleet.setValue(ids.device, ids.feature('power'), 0);
  assert.deepEqual(cloud.controls, [{ device: 'ABC123', code: 'power', value: '0' }]);
  assert.equal(gladys.fake.lastState(ids.feature('power')), 0);
});

test('a setpoint writes the setpoint of the current mode and the display one', async () => {
  const { gladys, cloud, fleet, ids } = await ready();
  await fleet.poll(ids.device);
  await fleet.setValue(ids.device, ids.feature('target-temperature'), 30);
  assert.deepEqual(cloud.controls, [
    { device: 'ABC123', code: 'R02', value: '30' },
    { device: 'ABC123', code: 'Set_Temp', value: '30' },
  ]);
  assert.equal(gladys.fake.lastState(ids.feature('target-temperature')), 30);
});

test('a setpoint outside the range of the mode is brought back into it', async () => {
  const { cloud, fleet, ids } = await ready();
  await fleet.poll(ids.device);
  await fleet.setValue(ids.device, ids.feature('target-temperature'), 12);
  assert.equal(cloud.controls[0].value, '15'); // R10: heating minimum
});

test('a mode change from Gladys writes the mode and the setpoint it shows', async () => {
  const { gladys, cloud, fleet, ids } = await ready();
  await fleet.poll(ids.device);
  await fleet.setValue(ids.device, ids.feature('mode'), 1); // cooling
  assert.deepEqual(cloud.controls, [
    { device: 'ABC123', code: 'Mode', value: '0' },
    { device: 'ABC123', code: 'Set_Temp', value: '27' },
  ]);
  assert.equal(gladys.fake.lastState(ids.feature('mode')), 1);
  assert.equal(gladys.fake.lastState(ids.feature('target-temperature')), 27);
});

test('a mode on a heat pump turned off turns it on first', async () => {
  const { cloud, fleet, pump } = await ready();
  cloud.values.ABC123.Power = '0';
  await fleet.read(pump);
  await fleet.setMode(pump, 'auto');
  assert.deepEqual(
    cloud.controls.map(({ code, value }) => `${code}=${value}`),
    ['power=1', 'Mode=2', 'Set_Temp=27'],
  );
});

test('a fault fires fault_detected once, then fault_cleared once', async () => {
  const { gladys, cloud, fleet, clock, ids } = await ready();
  await fleet.poll(ids.device); // learns: no fault
  cloud.setPump('ABC123', { fault: true });
  cloud.faults.ABC123 = 'E03 water flow';
  clock.now += 60_000;
  await fleet.poll(ids.device);
  clock.now += 60_000;
  await fleet.poll(ids.device);
  cloud.setPump('ABC123', { fault: false });
  clock.now += 60_000;
  await fleet.poll(ids.device);
  await settle();
  assert.deepEqual(gladys.fake.sceneEvents, [
    {
      key: SCENE_TRIGGERS.FAULT_DETECTED,
      data: { device: ids.device, device_name: 'Pool', fault: 'E03 water flow' },
    },
    { key: SCENE_TRIGGERS.FAULT_CLEARED, data: { device: ids.device, device_name: 'Pool' } },
  ]);
});

test('a fault already there at start-up is learned, not replayed', async () => {
  const { gladys, fleet, ids } = await ready({
    pumps: [{ code: 'ABC123', name: 'Pool', fault: true, values: {} }],
  });
  await fleet.poll(ids.device);
  await settle();
  assert.deepEqual(gladys.fake.sceneEvents, []);
  assert.equal(fleet.list()[0].faultText, 'Fault');
});

test('a heat pump the cloud loses fires connection_changed offline, then online', async () => {
  const { gladys, cloud, fleet, ids } = await ready();
  cloud.setPump('ABC123', { online: false });
  await fleet.refresh();
  await fleet.refresh();
  cloud.setPump('ABC123', { online: true });
  await fleet.refresh();
  await settle();
  assert.deepEqual(
    gladys.fake.sceneEvents.map(({ key, data }) => `${key}:${data.status}:${data.device}`),
    [`connection_changed:offline:${ids.device}`, `connection_changed:online:${ids.device}`],
  );
});

test('the transport badge says cloud, or unreachable when the cloud lost it', async () => {
  const { cloud, fleet, ids } = await ready();
  assert.deepEqual(fleet.transportEntries(), [{ external_id: ids.device, transport: 'cloud' }]);
  cloud.setPump('ABC123', { online: false });
  await fleet.refresh();
  assert.deepEqual(fleet.transportEntries(), [
    { external_id: ids.device, transport: 'unreachable' },
  ]);
});

test('new credentials start from a clean slate', async () => {
  const { fleet, config } = await ready();
  fleet.configure({ ...config, password: 'other' });
  assert.equal(fleet.list().length, 0);
  fleet.configure({ ...config, username: '' });
  assert.equal(fleet.configured, false);
});
