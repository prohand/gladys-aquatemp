import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import {
  WIDGET_ACTIONS,
  buildHeatPumpWidget,
  handleWidgetAction,
} from '../src/capabilities/widget.js';
import { normalizeConfig } from '../src/config.js';
import { LANGUAGES } from '../src/i18n.js';
import { setup } from './helpers/setup.js';

async function ready(options) {
  const env = setup(options);
  await env.fleet.refresh();
  if (env.fleet.list().length > 0) await env.fleet.read(env.fleet.list()[0]);
  return env;
}

test('the widget content is rendered exactly as sent', async () => {
  const { gladys, fleet, cloud } = await ready();
  assert.deepEqual(validateWidgetContent(buildHeatPumpWidget({ gladys, fleet })), []);
  cloud.setPump('ABC123', { online: false, fault: true });
  cloud.faults.ABC123 = 'E03 water flow, check the filter and the bypass valve now';
  await fleet.refresh();
  await fleet.read(fleet.list()[0]);
  assert.deepEqual(validateWidgetContent(buildHeatPumpWidget({ gladys, fleet })), []);
});

test('the notices (no account, no heat pump) are valid contents too', async () => {
  const { gladys, fleet, config } = await ready({ pumps: [] });
  assert.deepEqual(validateWidgetContent(buildHeatPumpWidget({ gladys, fleet })), []);
  fleet.configure(normalizeConfig({ ...config, username: '' }));
  const content = buildHeatPumpWidget({ gladys, fleet });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.deepEqual(Object.keys(content.components[0].text).sort(), [...LANGUAGES].sort());
});

test('the live tiles reference features the integration publishes', async () => {
  const { gladys, fleet } = await ready();
  const featureIds = new Set(
    fleet.discoveredDevices().flatMap((device) => device.features.map((f) => f.external_id)),
  );
  const tiles = buildHeatPumpWidget({ gladys, fleet }).components.filter((c) => c.device_feature);
  assert.ok(tiles.length >= 2);
  for (const tile of tiles) {
    assert.ok(featureIds.has(tile.device_feature), tile.device_feature);
  }
});

test('the instance setting picks the heat pump', async () => {
  const { gladys, fleet } = await ready({
    pumps: [
      { code: 'P1', name: 'Pool', values: {} },
      { code: 'P2', name: 'Spa', values: {} },
    ],
  });
  const settings = { device: 'ext:aqua-temp:heat-pump:p2' };
  const content = buildHeatPumpWidget({ gladys, fleet, settings });
  assert.equal(content.components[0].text, 'Spa');
});

test('every button is handled and answers a toast in every language', async () => {
  const { gladys, fleet, cloud } = await ready();
  const buttons = buildHeatPumpWidget({ gladys, fleet }).components.filter(
    (c) => c.type === 'button',
  );
  assert.deepEqual(buttons.map((b) => b.action.key).sort(), Object.values(WIDGET_ACTIONS).sort());
  for (const { action } of buttons) {
    const toast = await handleWidgetAction({ fleet, actionKey: action.key, params: action.params });
    assert.deepEqual(Object.keys(toast).sort(), [...LANGUAGES].sort());
  }
  // The heat pump was on: the toggle turned it off.
  assert.deepEqual(cloud.controls, [{ device: 'ABC123', code: 'power', value: '0' }]);
  await assert.rejects(
    handleWidgetAction({ fleet, actionKey: 'nope', params: buttons[0].action.params }),
  );
});
