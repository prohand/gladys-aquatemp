// -----------------------------------------------------------------------------
// Entry point of the Aqua Temp integration for Gladys Assistant.
//
// This file only wires the SDK to the modules (no cloud logic here):
//   1. instantiate the SDK (connection, auth, reconnection: handled by it);
//   2. register every handler BEFORE connect();
//   3. on each connection: read the config, list the heat pumps, publish them.
//
// The Gladys supervisor injects GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN
// and GLADYS_INTEGRATION_SELECTOR: `new GladysIntegration()` reads them.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { hasCredentials, normalizeConfig } from './src/config.js';
import { Fleet } from './src/aquatemp/fleet.js';
import { MESSAGES, describeError, testConnection } from './src/connection.js';
import { SCENE_ACTIONS, SCENE_ACTION_KEYS } from './src/capabilities/scenes.js';
import {
  HEAT_PUMP_WIDGET,
  buildHeatPumpWidget,
  handleWidgetAction,
} from './src/capabilities/widget.js';

const gladys = new GladysIntegration();
const fleet = new Fleet({ gladys });
let config = normalizeConfig();

// Last status sent to the Configuration screen: polls run every minute, and
// an unchanged status is not worth a request each time.
let lastStatus = null;
async function reportStatus(connected, message) {
  const key = JSON.stringify([connected, message ?? null]);
  if (key === lastStatus) {
    return;
  }
  await gladys.setConnectionStatus(connected, message);
  lastStatus = key;
}

/**
 * Log in, list the heat pumps, publish them and their transport badge, and
 * report the outcome in the Configuration screen.
 */
async function synchronize() {
  fleet.configure(config);
  if (!hasCredentials(config)) {
    await reportStatus(false, MESSAGES.NOT_CONFIGURED);
    return;
  }
  try {
    await fleet.refresh();
    await gladys.publishDiscoveredDevices(fleet.discoveredDevices());
    const transports = fleet.transportEntries();
    if (transports.length > 0) {
      await gladys.publishTransports(transports);
    }
    await reportStatus(true);
  } catch (err) {
    logger.error(`Aqua Temp synchronization failed: ${err.message}`);
    await reportStatus(false, describeError(err)).catch(() => {});
  }
  gladys.requestWidgetRefresh(HEAT_PUMP_WIDGET);
}

// --- Discovery: Gladys asks for the list of devices --------------------------
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> listing the heat pumps');
  await synchronize();
});

// --- Command: the user acts on a feature (power, mode, setpoint, silent) -----
gladys.onSetValue(async (device, feature, value) => {
  logger.info(`onSetValue <- ${feature.external_id} = ${value}`);
  await fleet.setValue(device.external_id, feature.external_id, value);
  gladys.requestWidgetRefresh(HEAT_PUMP_WIDGET);
});

// --- Polling: Gladys polls each heat pump once a minute ----------------------
// The fleet reads it at the interval the user chose, and skips the rest.
gladys.onPoll(async (device) => {
  try {
    if (await fleet.poll(device.external_id)) {
      gladys.requestWidgetRefresh(HEAT_PUMP_WIDGET);
      await reportStatus(true);
    }
  } catch (err) {
    await reportStatus(false, describeError(err)).catch(() => {});
    throw err;
  }
});

// --- Configuration screen button ---------------------------------------------
gladys.onAction('test_connection', async () => {
  logger.info('Action test_connection');
  fleet.configure(config);
  return testConnection(fleet, config);
});

// --- Scene actions (Gladys 5.1+) ---------------------------------------------
// Scene triggers need no handler: the fleet fires them (src/aquatemp/fleet.js).
gladys.onSceneAction(SCENE_ACTION_KEYS.SET_MODE, (fields) =>
  SCENE_ACTIONS[SCENE_ACTION_KEYS.SET_MODE](fleet, fields),
);
gladys.onSceneAction(SCENE_ACTION_KEYS.SET_SILENT_MODE, (fields) =>
  SCENE_ACTIONS[SCENE_ACTION_KEYS.SET_SILENT_MODE](fleet, fields),
);
gladys.onSceneAction(SCENE_ACTION_KEYS.READ_STATUS, (fields) =>
  SCENE_ACTIONS[SCENE_ACTION_KEYS.READ_STATUS](fleet, fields),
);

// --- Dashboard widget (Gladys 5.1+) ------------------------------------------
gladys.onWidgetGet(HEAT_PUMP_WIDGET, ({ settings }) =>
  buildHeatPumpWidget({ gladys, fleet, settings }),
);
gladys.onWidgetAction(HEAT_PUMP_WIDGET, (actionKey, params) =>
  handleWidgetAction({ fleet, actionKey, params }),
);

// --- Configuration updated by the user ---------------------------------------
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> new configuration received');
  config = normalizeConfig(newConfig);
  await synchronize();
});

// --- Connection lifecycle ----------------------------------------------------
gladys.on('connected', async () => {
  try {
    lastStatus = null;
    config = normalizeConfig(await gladys.getConfig());
    await synchronize();
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
  }
});

gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
});

logger.info('Starting the Aqua Temp integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
