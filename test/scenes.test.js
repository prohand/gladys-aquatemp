import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SCENE_ACTIONS, SCENE_ACTION_KEYS } from '../src/capabilities/scenes.js';
import { idsFor } from '../src/devices/heatPump.js';
import { setup } from './helpers/setup.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const declared = (key) => manifest.scene_actions.find((action) => action.key === key);

async function ready(options) {
  const env = setup(options);
  await env.fleet.refresh();
  const pump = env.fleet.list()[0];
  await env.fleet.read(pump);
  return { ...env, pump, device: idsFor(env.gladys, pump).device };
}

test('every output an action returns is declared, and every declared one returned', async () => {
  const { fleet, device } = await ready();
  const runs = {
    [SCENE_ACTION_KEYS.SET_MODE]: { device, mode: 'heat' },
    [SCENE_ACTION_KEYS.SET_SILENT_MODE]: { device, enabled: true },
    [SCENE_ACTION_KEYS.READ_STATUS]: { device },
  };
  for (const [key, fields] of Object.entries(runs)) {
    const outputs = await SCENE_ACTIONS[key](fleet, fields);
    assert.deepEqual(
      Object.keys(outputs).sort(),
      declared(key)
        .outputs.map((output) => output.key)
        .sort(),
      key,
    );
    for (const output of declared(key).outputs) {
      assert.equal(typeof outputs[output.key], output.type, `${key}.${output.key}`);
    }
  }
});

test('set_mode off turns the heat pump off', async () => {
  const { cloud, fleet, device } = await ready();
  await SCENE_ACTIONS.set_mode(fleet, { device, mode: 'off' });
  assert.deepEqual(cloud.controls, [{ device: 'ABC123', code: 'power', value: '0' }]);
});

test('the mode choices of the manifest are the ones the code knows', async () => {
  const { fleet, device } = await ready();
  const choices = declared('set_mode')
    .fields.find((field) => field.key === 'mode')
    .options.map((option) => option.value);
  for (const mode of choices) {
    assert.deepEqual(await SCENE_ACTIONS.set_mode(fleet, { device, mode }), { applied: true });
  }
  await assert.rejects(SCENE_ACTIONS.set_mode(fleet, { device, mode: 'dry' }));
});

test('read_status says what a scene needs to test', async () => {
  const { cloud, fleet, device } = await ready();
  cloud.setPump('ABC123', { fault: true });
  cloud.faults.ABC123 = 'E03 water flow';
  assert.deepEqual(await SCENE_ACTIONS.read_status(fleet, { device }), {
    online: true,
    power: true,
    mode: 'heat',
    water_temperature: 24.5,
    target_temperature: 28,
    in_fault: true,
    fault: 'E03 water flow',
  });
});

test('silent mode on a board without one is an output, not a failure', async () => {
  const { fleet, device } = await ready({
    pumps: [{ code: 'HT1', productId: '1245226668902080512', values: { MO6: '1' } }],
  });
  assert.deepEqual(await SCENE_ACTIONS.set_silent_mode(fleet, { device, enabled: true }), {
    applied: false,
  });
});
