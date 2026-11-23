// -----------------------------------------------------------------------------
// The heat pumps of the account, as the integration last saw them.
//
// One place owns the cloud client and the state of every heat pump (list
// flags, last values read, fault text), so the devices, the scene actions and
// the widget all read and command the same thing. Transitions seen here
// (fault raised or cleared, heat pump back online or gone) become scene
// events, once per transition.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { hasCredentials } from '../config.js';
import { AquaTempClient } from './api.js';
import { PUMP_MODES, profileFor, readCodes } from './profiles.js';
import {
  FEATURES,
  buildDevice,
  featureKeyOf,
  idsFor,
  modeFromGladys,
  readingsOf,
  statesOf,
} from '../devices/heatPump.js';
import { SCENE_TRIGGERS } from '../capabilities/triggers.js';

const logger = createLogger({ name: 'fleet' });

/** Unchanged values are re-sent this often, so they stay recently dated in Gladys. */
const STATE_HEARTBEAT_MS = 30 * 60 * 1000;

/** Gladys' poll ticks drift: a read due within half a minute runs now. */
const POLL_TOLERANCE_MS = 30 * 1000;

/** The pump modes a user can ask for, `off` included. */
export const MODE_CHOICES = ['off', PUMP_MODES.HEAT, PUMP_MODES.COOL, PUMP_MODES.AUTO];

export class Fleet {
  /**
   * @param {object} options
   * @param {object} options.gladys the SDK instance
   * @param {(config: object) => object} [options.createClient] cloud client factory (tests)
   * @param {() => number} [options.now] clock (tests)
   */
  constructor({ gladys, createClient, now = Date.now }) {
    this.gladys = gladys;
    this.createClient =
      createClient ??
      ((config) =>
        new AquaTempClient({
          username: config.username,
          password: config.password,
          apiType: config.api_type,
          strictTls: config.strict_tls,
        }));
    this.now = now;
    this.config = null;
    this.client = null;
    this.pumps = new Map();
    this.listedAt = null;
    this.lastReads = new Map();
    this.lastError = null;
  }

  /** Apply a (new) configuration: new credentials mean a new login. */
  configure(config) {
    const previous = this.config;
    this.config = config;
    const same =
      previous &&
      previous.username === config.username &&
      previous.password === config.password &&
      previous.api_type === config.api_type &&
      previous.strict_tls === config.strict_tls;
    if (!same) {
      this.client = hasCredentials(config) ? this.createClient(config) : null;
      this.pumps.clear();
      this.listedAt = null;
      this.lastReads.clear();
    }
  }

  get configured() {
    return this.client !== null;
  }

  requireClient() {
    if (!this.client) {
      throw new Error('Aqua Temp account not configured');
    }
    return this.client;
  }

  list() {
    return [...this.pumps.values()];
  }

  /** The heat pump behind a Gladys device external id, or undefined. */
  byExternalId(externalId) {
    return this.list().find((pump) => idsFor(this.gladys, pump).device === externalId);
  }

  requirePump(externalId) {
    const pump = this.byExternalId(externalId);
    if (!pump) {
      throw new Error(`Unknown heat pump: ${externalId}`);
    }
    return pump;
  }

  discoveredDevices() {
    return this.list().map((pump) => buildDevice(this.gladys, pump));
  }

  /** One transport badge per heat pump: cloud when the cloud sees it. */
  transportEntries() {
    return this.list().map((pump) => ({
      external_id: idsFor(this.gladys, pump).device,
      transport: pump.online ? 'cloud' : 'unreachable',
    }));
  }

  /** Re-read the list of heat pumps (online and fault flags included). */
  async refresh() {
    const client = this.requireClient();
    try {
      const devices = await client.listDevices();
      const seen = new Set();
      for (const device of devices) {
        seen.add(device.code);
        const known = this.pumps.get(device.code);
        if (!known) {
          this.pumps.set(device.code, {
            ...device,
            profile: profileFor(device.productId),
            values: {},
            faultText: null,
            readAt: null,
          });
          continue;
        }
        const wasOnline = known.online;
        Object.assign(known, device, { profile: profileFor(device.productId) });
        if (wasOnline !== device.online) {
          this.fire(SCENE_TRIGGERS.CONNECTION_CHANGED, known, {
            status: device.online ? 'online' : 'offline',
          });
        }
      }
      for (const code of [...this.pumps.keys()]) {
        if (!seen.has(code)) {
          this.pumps.delete(code);
        }
      }
      this.listedAt = this.now();
      this.lastError = null;
      return this.list();
    } catch (err) {
      this.lastError = err;
      throw err;
    }
  }

  isDue(at, seconds) {
    return at === null || at === undefined || this.now() - at >= seconds * 1000 - POLL_TOLERANCE_MS;
  }

  /**
   * Handler of a Gladys poll: read the heat pump when the user's interval is
   * due (and the list with it). Resolves false when the poll was skipped.
   */
  async poll(externalId) {
    if (!this.config || !this.client) {
      return false;
    }
    const known = this.byExternalId(externalId);
    if (known && !this.isDue(this.lastReads.get(known.code), this.config.poll_frequency)) {
      return false;
    }
    // The list is re-read at the same pace: it carries the online and fault
    // flags, and it is what recovers a start-up whose first listing failed.
    if (this.isDue(this.listedAt, this.config.poll_frequency)) {
      await this.refresh();
    }
    const pump = this.byExternalId(externalId);
    if (!pump) {
      return false;
    }
    await this.read(pump);
    return true;
  }

  /** Read one heat pump now and publish what changed. */
  async read(pump) {
    const client = this.requireClient();
    this.lastReads.set(pump.code, this.now());
    pump.values = {
      ...pump.values,
      ...(await client.readValues(pump.code, readCodes(pump.profile))),
    };
    pump.readAt = this.now();
    await this.updateFault(pump);
    await this.gladys.publishChangedStates(statesOf(this.gladys, pump), {
      heartbeat: STATE_HEARTBEAT_MS,
    });
    return pump;
  }

  async updateFault(pump) {
    const hadFault = pump.faultText !== null;
    let text = null;
    if (pump.fault) {
      try {
        text = (await this.requireClient().readFault(pump.code)) ?? 'Fault';
      } catch (err) {
        logger.warn(`Fault of ${pump.name} unreadable: ${err.message}`);
        text = pump.faultText ?? 'Fault';
      }
    }
    pump.faultText = text;
    const hasFault = text !== null;
    if (pump.faultSeen && hadFault !== hasFault) {
      if (hasFault) {
        this.fire(SCENE_TRIGGERS.FAULT_DETECTED, pump, { fault: text });
      } else {
        this.fire(SCENE_TRIGGERS.FAULT_CLEARED, pump, {});
      }
    }
    // The first read only learns the state: a restart must not replay a
    // fault the scenes already reacted to.
    pump.faultSeen = true;
  }

  fire(key, pump, data) {
    const event = { device: idsFor(this.gladys, pump).device, device_name: pump.name, ...data };
    logger.info(`Scene event ${key} for ${pump.name}`);
    // Fire-and-forget: a scene event lost while Gladys is unreachable is not
    // worth failing the poll that saw it.
    Promise.resolve(this.gladys.publishSceneEvent(key, event)).catch((err) =>
      logger.warn(`Scene event ${key} not delivered: ${err.message}`),
    );
  }

  /** Write codes, then keep (and publish) the written values as the known state. */
  async write(pump, writes) {
    await this.requireClient().control(pump.code, writes);
    for (const { code, value } of writes) {
      // The power is written in lower case but read with its own code.
      const readCode = code === pump.profile.powerControl ? pump.profile.power : code;
      pump.values[readCode] = String(value);
    }
    await this.gladys.publishStates(statesOf(this.gladys, pump));
  }

  async setPower(pump, on) {
    await this.write(pump, [{ code: pump.profile.powerControl, value: on ? 1 : 0 }]);
  }

  /** Set a mode (`off` turns the heat pump off; any other mode turns it on). */
  async setMode(pump, mode) {
    if (mode === 'off') {
      await this.setPower(pump, false);
      return;
    }
    const target = pump.profile.modes[mode];
    if (!target) {
      throw new Error(`Mode "${mode}" not supported by ${pump.name}`);
    }
    if (readingsOf(pump).power !== true) {
      await this.setPower(pump, true);
    }
    if (!pump.profile.mode) {
      return;
    }
    const writes = [{ code: pump.profile.mode, value: target.value }];
    // The display setpoint follows the mode, as the app does.
    const setpoint = pump.values[target.target];
    if (setpoint !== null && setpoint !== undefined && pump.profile.setTemp !== target.target) {
      writes.push({ code: pump.profile.setTemp, value: setpoint });
    }
    await this.write(pump, writes);
  }

  async setTarget(pump, temperature) {
    const readings = readingsOf(pump);
    let value = Number(temperature);
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid temperature: ${temperature}`);
    }
    // The board refuses a setpoint outside the range of its current mode.
    if (readings.targetMin !== null) value = Math.max(readings.targetMin, value);
    if (readings.targetMax !== null) value = Math.min(readings.targetMax, value);
    const mode = readings.mode ?? Object.keys(pump.profile.modes)[0];
    const codes = new Set([pump.profile.modes[mode].target, pump.profile.setTemp].filter(Boolean));
    await this.write(
      pump,
      [...codes].map((code) => ({ code, value })),
    );
    return value;
  }

  async setSilent(pump, on) {
    if (!pump.profile.silent) {
      throw new Error(`${pump.name} has no silent mode`);
    }
    await this.write(pump, [{ code: pump.profile.silent, value: on ? 1 : 0 }]);
  }

  /** Handler of a Gladys command on one feature. */
  async setValue(deviceExternalId, featureExternalId, value) {
    const pump = this.requirePump(deviceExternalId);
    const key = featureKeyOf(this.gladys, pump, featureExternalId);
    switch (key) {
      case FEATURES.POWER:
        return this.setPower(pump, Number(value) === 1);
      case FEATURES.MODE: {
        const mode = modeFromGladys(value);
        if (!mode) {
          throw new Error(`Mode ${value} not supported`);
        }
        return this.setMode(pump, mode);
      }
      case FEATURES.TARGET_TEMPERATURE:
        return this.setTarget(pump, value);
      case FEATURES.SILENT:
        return this.setSilent(pump, Number(value) === 1);
      default:
        throw new Error(`Feature ${featureExternalId} cannot be controlled`);
    }
  }
}
