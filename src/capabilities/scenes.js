// -----------------------------------------------------------------------------
// Scene actions (Gladys 5.1+): what a scene can ask a heat pump.
//
// Gladys scenes can already set a device feature (power, setpoint). These
// actions add what a feature cannot say in one step:
//   - set_mode: off / heat / cool / auto in one action (turning the heat pump
//     on first when needed);
//   - set_silent_mode: the silent (low noise) mode, on or off;
//   - read_status: a fresh read from the cloud, returned as outputs a scene can
//     test (online, water temperature, fault...).
//
// The rules of the SDK: `fields` arrive resolved (a `"source": "devices"`
// field is the chosen device external id); the resolved object is the
// declared `outputs`, scalars only; throwing fails this action only.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { MODE_CHOICES } from '../aquatemp/fleet.js';
import { readingsOf } from '../devices/heatPump.js';

const logger = createLogger({ name: 'scenes' });

/** Action keys, as declared in the manifest. Never renamed: scenes store them. */
export const SCENE_ACTION_KEYS = {
  SET_MODE: 'set_mode',
  SET_SILENT_MODE: 'set_silent_mode',
  READ_STATUS: 'read_status',
};

export { MODE_CHOICES };

/** What read_status returns: every output always present, '' / -1 when unknown. */
export function statusOutputs(pump) {
  const readings = readingsOf(pump);
  return {
    online: pump.online === true,
    power: readings.power === true,
    mode: readings.power === false ? 'off' : (readings.mode ?? ''),
    water_temperature: readings.sensors.water_inlet ?? -1,
    target_temperature: readings.target ?? -1,
    in_fault: pump.faultText !== null && pump.faultText !== undefined,
    fault: pump.faultText ?? '',
  };
}

/** Handlers keyed by action key: `(fleet, fields) => outputs`. */
export const SCENE_ACTIONS = {
  async [SCENE_ACTION_KEYS.SET_MODE](fleet, fields) {
    logger.info(`Scene action set_mode <- ${fields.device} ${fields.mode}`);
    if (!MODE_CHOICES.includes(fields.mode)) {
      throw new Error(`Unknown mode: ${fields.mode}`);
    }
    const pump = fleet.requirePump(fields.device);
    await fleet.setMode(pump, fields.mode);
    return { applied: true };
  },

  async [SCENE_ACTION_KEYS.SET_SILENT_MODE](fleet, fields) {
    logger.info(`Scene action set_silent_mode <- ${fields.device} ${fields.enabled}`);
    const pump = fleet.requirePump(fields.device);
    if (!pump.profile.silent) {
      // Not a failure: the scene author can test the output.
      return { applied: false };
    }
    await fleet.setSilent(pump, fields.enabled === true || fields.enabled === 'true');
    return { applied: true };
  },

  async [SCENE_ACTION_KEYS.READ_STATUS](fleet, fields) {
    logger.info(`Scene action read_status <- ${fields.device}`);
    // The list first: it is what says online / in fault.
    await fleet.refresh();
    const pump = fleet.requirePump(fields.device);
    try {
      await fleet.read(pump);
    } catch (err) {
      // An offline heat pump is an answer (online: false), not a failure.
      logger.warn(`read_status: ${pump.name} unreadable: ${err.message}`);
    }
    return statusOutputs(pump);
  },
};
