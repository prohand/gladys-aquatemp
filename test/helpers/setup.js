// A fake Gladys (SDK) + a fake Aqua Temp cloud + the fleet between them.

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { AquaTempClient } from '../../src/aquatemp/api.js';
import { Fleet } from '../../src/aquatemp/fleet.js';
import { normalizeConfig } from '../../src/config.js';
import { createFakeCloud, HEATING_VALUES } from './fakeCloud.js';

export function setup({ pumps = [{ code: 'ABC123', name: 'Pool', values: HEATING_VALUES }] } = {}) {
  const gladys = createFakeGladys({ selector: 'aqua-temp' });
  const cloud = createFakeCloud();
  for (const pump of pumps) cloud.addPump(pump);
  const clock = { now: 1_000_000 };
  const fleet = new Fleet({
    gladys,
    now: () => clock.now,
    createClient: (config) =>
      new AquaTempClient({
        username: config.username,
        password: config.password,
        apiType: config.api_type,
        post: cloud.post,
      }),
  });
  const config = normalizeConfig({ username: 'me@example.com', password: 'secret' });
  fleet.configure(config);
  return { gladys, cloud, clock, fleet, config };
}

/** Let fire-and-forget calls (scene events) land. */
export const settle = () => new Promise((resolve) => setImmediate(resolve));
