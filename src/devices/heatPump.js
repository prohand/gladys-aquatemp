// -----------------------------------------------------------------------------
// Device type: HEAT PUMP (one Gladys device per Aqua Temp heat pump).
//
// Gladys has no "heat pump" category; its air-conditioning one carries exactly
// what the Aqua Temp app controls — on/off, a mode (cool / heat / auto) and a
// setpoint — and the Gladys interface renders it as a thermostat card. The
// temperatures the board measures are plain temperature sensors next to it,
// and the silent mode a switch.
//
// A feature is only published when the board of the product has the code it
// reads (see src/aquatemp/profiles.js): a Hi Temp water heater has no mode
// and no silent mode.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { parseFlag } from '../aquatemp/api.js';
import { PUMP_MODES, modeFromRaw } from '../aquatemp/profiles.js';

export const DEVICE_TYPE = 'heat-pump';

/** Feature keys: part of the external ids, never renamed. */
export const FEATURES = {
  POWER: 'power',
  MODE: 'mode',
  TARGET_TEMPERATURE: 'target-temperature',
  SILENT: 'silent-mode',
  WATER_INLET: 'water-inlet-temperature',
  WATER_OUTLET: 'water-outlet-temperature',
  AMBIENT: 'ambient-temperature',
};

/** Gladys air-conditioning modes (AC_MODE of the Gladys core). */
export const GLADYS_AC_MODE = {
  [PUMP_MODES.AUTO]: 0,
  [PUMP_MODES.COOL]: 1,
  [PUMP_MODES.HEAT]: 2,
};

/** Setpoint range published to Gladys: what the Aqua Temp boards accept. */
export const TARGET_RANGE = { min: 5, max: 40 };

const SENSOR_FEATURES = {
  water_inlet: { key: FEATURES.WATER_INLET, name: 'Water temperature (inlet)', min: -20, max: 80 },
  water_outlet: {
    key: FEATURES.WATER_OUTLET,
    name: 'Water temperature (outlet)',
    min: -20,
    max: 80,
  },
  ambient: { key: FEATURES.AMBIENT, name: 'Outdoor temperature', min: -40, max: 60 },
};

/**
 * Device codes come from the cloud: keep them readable in an external id
 * (no `:` separator, no space), and stable — the id is forever.
 */
export function platformId(code) {
  return String(code)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-');
}

export function idsFor(gladys, pump) {
  return gladys.externalIds(DEVICE_TYPE, platformId(pump.code));
}

/** The feature key of a feature external id, or null when it is not ours. */
export function featureKeyOf(gladys, pump, featureExternalId) {
  const prefix = `${idsFor(gladys, pump).device}:`;
  if (!String(featureExternalId).startsWith(prefix)) {
    return null;
  }
  const key = featureExternalId.slice(prefix.length);
  return Object.values(FEATURES).includes(key) ? key : null;
}

function feature(ids, key, fields) {
  // `name`, `min`, `max`, `read_only` and `has_feedback` on EVERY feature:
  // Gladys stores them NOT NULL (HTTP 422 on "Add" otherwise).
  return { external_id: ids.feature(key), keep_history: true, has_feedback: false, ...fields };
}

/** The discovery payload of one heat pump. */
export function buildDevice(gladys, pump) {
  const ids = idsFor(gladys, pump);
  const { profile } = pump;
  const features = [
    feature(ids, FEATURES.POWER, {
      name: 'Power',
      category: DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING,
      type: DEVICE_FEATURE_TYPES.AIR_CONDITIONING.BINARY,
      min: 0,
      max: 1,
      read_only: false,
      has_feedback: true,
    }),
  ];
  if (profile.mode) {
    features.push(
      feature(ids, FEATURES.MODE, {
        name: 'Mode',
        category: DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING,
        type: DEVICE_FEATURE_TYPES.AIR_CONDITIONING.MODE,
        min: 0,
        max: 2,
        read_only: false,
        has_feedback: true,
      }),
    );
  }
  features.push(
    feature(ids, FEATURES.TARGET_TEMPERATURE, {
      name: 'Target temperature',
      category: DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING,
      type: DEVICE_FEATURE_TYPES.AIR_CONDITIONING.TARGET_TEMPERATURE,
      unit: DEVICE_FEATURE_UNITS.CELSIUS,
      min: TARGET_RANGE.min,
      max: TARGET_RANGE.max,
      read_only: false,
      has_feedback: true,
    }),
  );
  if (profile.silent) {
    features.push(
      feature(ids, FEATURES.SILENT, {
        name: 'Silent mode',
        category: DEVICE_FEATURE_CATEGORIES.SWITCH,
        type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
        min: 0,
        max: 1,
        read_only: false,
        has_feedback: true,
      }),
    );
  }
  for (const [sensor, code] of Object.entries(profile.sensors)) {
    if (!code) {
      continue;
    }
    const { key, name, min, max } = SENSOR_FEATURES[sensor];
    features.push(
      feature(ids, key, {
        name,
        category: DEVICE_FEATURE_CATEGORIES.TEMPERATURE_SENSOR,
        type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
        unit: DEVICE_FEATURE_UNITS.CELSIUS,
        min,
        max,
        read_only: true,
      }),
    );
  }
  return {
    name: pump.name,
    external_id: ids.device,
    // Gladys calls onPoll once a minute (milliseconds, an enum value); the
    // user's slower interval is applied by skipping polls (src/aquatemp/fleet.js).
    should_poll: true,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
    features,
  };
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** What the last read says, in Gladys terms (null = unknown). */
export function readingsOf(pump) {
  const { profile, values = {} } = pump;
  const rawPower = values[profile.power];
  const power = rawPower === null || rawPower === undefined ? null : parseFlag(rawPower);
  const mode = profile.mode
    ? values[profile.mode] === null || values[profile.mode] === undefined
      ? null
      : modeFromRaw(profile, values[profile.mode])
    : modeFromRaw(profile, null);
  const modeCodes = mode ? profile.modes[mode] : null;
  const target =
    toNumber(modeCodes ? values[modeCodes.target] : null) ?? toNumber(values[profile.setTemp]);
  const silentRaw = profile.silent ? values[profile.silent] : null;
  const sensors = {};
  for (const [sensor, code] of Object.entries(profile.sensors)) {
    sensors[sensor] = code ? toNumber(values[code]) : null;
  }
  return {
    power,
    mode,
    target,
    targetMin: toNumber(modeCodes?.min ? values[modeCodes.min] : null),
    targetMax: toNumber(modeCodes?.max ? values[modeCodes.max] : null),
    silent: silentRaw === null || silentRaw === undefined ? null : parseFlag(silentRaw),
    sensors,
  };
}

/** The states to publish after a read, unknown values left out. */
export function statesOf(gladys, pump) {
  const ids = idsFor(gladys, pump);
  const readings = readingsOf(pump);
  const states = [];
  const push = (key, state) => {
    if (state !== null && state !== undefined) {
      states.push({ device_feature_external_id: ids.feature(key), state });
    }
  };
  push(FEATURES.POWER, readings.power === null ? null : readings.power ? 1 : 0);
  if (pump.profile.mode) {
    push(FEATURES.MODE, readings.mode === null ? null : GLADYS_AC_MODE[readings.mode]);
  }
  push(FEATURES.TARGET_TEMPERATURE, readings.target);
  if (pump.profile.silent) {
    push(FEATURES.SILENT, readings.silent === null ? null : readings.silent ? 1 : 0);
  }
  for (const [sensor, value] of Object.entries(readings.sensors)) {
    if (pump.profile.sensors[sensor]) {
      push(SENSOR_FEATURES[sensor].key, value);
    }
  }
  return states;
}

/** The pump mode of a Gladys AC_MODE value, or null. */
export function modeFromGladys(value) {
  const entry = Object.entries(GLADYS_AC_MODE).find(([, number]) => number === Number(value));
  return entry ? entry[0] : null;
}
