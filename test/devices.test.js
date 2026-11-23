import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURES, GLADYS_AC_MODE, buildDevice, idsFor } from '../src/devices/heatPump.js';
import { setup } from './helpers/setup.js';

test('every feature carries the fields Gladys stores NOT NULL', async () => {
  const { fleet } = setup();
  await fleet.refresh();
  for (const device of fleet.discoveredDevices()) {
    for (const feature of device.features) {
      for (const field of ['name', 'min', 'max', 'read_only', 'has_feedback']) {
        assert.notEqual(feature[field], undefined, `${feature.external_id}.${field}`);
        assert.notEqual(feature[field], null, `${feature.external_id}.${field}`);
      }
    }
  }
});

test('the discovery is accepted by Gladys (categories, units, poll frequency)', async () => {
  const { gladys, fleet } = setup();
  await fleet.refresh();
  await gladys.publishDiscoveredDevices(fleet.discoveredDevices());
  const [device] = gladys.fake.discoveredDevices;
  assert.equal(device.name, 'Pool');
  assert.equal(device.external_id, 'ext:aqua-temp:heat-pump:abc123');
  assert.deepEqual(
    device.features.map((feature) => feature.external_id.split(':').pop()),
    [
      FEATURES.POWER,
      FEATURES.MODE,
      FEATURES.TARGET_TEMPERATURE,
      FEATURES.SILENT,
      FEATURES.WATER_INLET,
      FEATURES.WATER_OUTLET,
      FEATURES.AMBIENT,
    ],
  );
});

test('a Hi Temp water heater has no mode and no silent mode', async () => {
  const { gladys, fleet } = setup({
    pumps: [{ code: 'HT1', productId: '1245226668902080512', values: { MO6: '1', R01: '55' } }],
  });
  await fleet.refresh();
  const keys = buildDevice(gladys, fleet.list()[0]).features.map((f) =>
    f.external_id.split(':').pop(),
  );
  assert.ok(!keys.includes(FEATURES.MODE));
  assert.ok(!keys.includes(FEATURES.SILENT));
  assert.ok(!keys.includes(FEATURES.WATER_OUTLET));
});

test('device codes stay readable and stable in the external id', async () => {
  const { gladys } = setup();
  assert.equal(idsFor(gladys, { code: 'AB:12 cd' }).device, 'ext:aqua-temp:heat-pump:ab-12-cd');
});

test('the Gladys AC modes the pump modes map to', () => {
  assert.deepEqual(GLADYS_AC_MODE, { auto: 0, cool: 1, heat: 2 });
});
