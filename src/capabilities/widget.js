// -----------------------------------------------------------------------------
// Dashboard widget (Gladys 5.1+): one heat pump at a glance.
//
// Live tiles for the temperatures (bound to the device features: they follow
// the published states, nothing to refresh), a status list computed from what
// the integration knows and no feature carries (cloud connection, mode, silent
// mode, fault text), and two buttons: turn the heat pump on or off, and read
// it now.
//
// The instance setting `device` picks the heat pump; without it the widget
// shows the first one of the account. The content is declarative, rendered by
// the core (see the "Dashboard widgets" section of the SDK README).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS, createLogger } from '@gladysassistant/integration-sdk';
import { PUMP_MODES } from '../aquatemp/profiles.js';
import { FEATURES, idsFor, readingsOf } from '../devices/heatPump.js';
import { localize, pick } from '../i18n.js';

const logger = createLogger({ name: 'widget' });

/** Key of the manifest widget. Never renamed: dashboards store it. */
export const HEAT_PUMP_WIDGET = 'heat_pump';

/** Keys of the button actions. Never renamed: relayed back by key. */
export const WIDGET_ACTIONS = { TOGGLE_POWER: 'toggle_power', REFRESH: 'refresh' };

const MODE_LABELS = {
  off: { en: 'Off', fr: 'Arrêt', de: 'Aus', es: 'Apagada' },
  [PUMP_MODES.HEAT]: { en: 'Heating', fr: 'Chauffage', de: 'Heizen', es: 'Calefacción' },
  [PUMP_MODES.COOL]: { en: 'Cooling', fr: 'Refroidissement', de: 'Kühlen', es: 'Refrigeración' },
  [PUMP_MODES.AUTO]: { en: 'Auto', fr: 'Auto', de: 'Automatik', es: 'Automático' },
};

const UNKNOWN = { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' };

function text(texts) {
  return localize((language) => pick(language, texts));
}

/** The heat pump an instance shows: its setting, else the first one. */
export function pumpForSettings(fleet, settings = {}) {
  if (settings.device) {
    const chosen = fleet.byExternalId(settings.device);
    if (chosen) {
      return chosen;
    }
  }
  return fleet.list()[0] ?? null;
}

function notice(message) {
  return {
    ttl_seconds: 300,
    components: [{ type: 'text', variant: 'caption', text: message }],
  };
}

function statusItems(pump) {
  const readings = readingsOf(pump);
  const items = [
    {
      label: text({ en: 'Cloud', fr: 'Cloud', de: 'Cloud', es: 'Nube' }),
      icon: 'cloud',
      value: pump.online
        ? text({ en: 'Online', fr: 'En ligne', de: 'Online', es: 'En línea' })
        : text({ en: 'Offline', fr: 'Hors ligne', de: 'Offline', es: 'Sin conexión' }),
      color: pump.online ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.DANGER,
    },
  ];
  const modeKey = readings.power === false ? 'off' : readings.mode;
  items.push({
    label: text({ en: 'Mode', fr: 'Mode', de: 'Modus', es: 'Modo' }),
    icon: 'sliders',
    value: text(MODE_LABELS[modeKey] ?? UNKNOWN),
    color: modeKey === 'off' ? WIDGET_COLORS.NEUTRAL : WIDGET_COLORS.PRIMARY,
  });
  if (pump.profile.silent) {
    items.push({
      label: text({ en: 'Silent mode', fr: 'Mode silence', de: 'Leisemodus', es: 'Modo silencio' }),
      icon: 'volume-x',
      value:
        readings.silent === null
          ? text(UNKNOWN)
          : readings.silent
            ? text({ en: 'On', fr: 'Activé', de: 'An', es: 'Activado' })
            : text({ en: 'Off', fr: 'Désactivé', de: 'Aus', es: 'Desactivado' }),
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  items.push({
    label: text({ en: 'Fault', fr: 'Défaut', de: 'Störung', es: 'Avería' }),
    icon: 'alert-triangle',
    // The cloud writes fault texts in one language: shown as it is.
    value: pump.faultText
      ? pump.faultText.slice(0, 40)
      : text({ en: 'None', fr: 'Aucun', de: 'Keine', es: 'Ninguna' }),
    color: pump.faultText ? WIDGET_COLORS.DANGER : WIDGET_COLORS.SUCCESS,
  });
  return items;
}

/** The content of the widget for one instance. */
export function buildHeatPumpWidget({ gladys, fleet, settings = {} }) {
  if (!fleet.configured) {
    return notice(
      text({
        en: 'Enter your Aqua Temp account in the integration configuration.',
        fr: "Saisissez votre compte Aqua Temp dans la configuration de l'intégration.",
        de: 'Gib dein Aqua-Temp-Konto in der Konfiguration der Integration ein.',
        es: 'Introduzca su cuenta Aqua Temp en la configuración de la integración.',
      }),
    );
  }
  const pump = pumpForSettings(fleet, settings);
  if (!pump) {
    return notice(
      text({
        en: 'No heat pump found on this Aqua Temp account.',
        fr: 'Aucune pompe à chaleur trouvée sur ce compte Aqua Temp.',
        de: 'Keine Wärmepumpe in diesem Aqua-Temp-Konto gefunden.',
        es: 'No se ha encontrado ninguna bomba de calor en esta cuenta Aqua Temp.',
      }),
    );
  }
  const ids = idsFor(gladys, pump);
  const readings = readingsOf(pump);
  const components = [{ type: 'text', variant: 'heading', text: pump.name.slice(0, 40) }];
  if (pump.profile.sensors.water_inlet) {
    components.push({
      type: 'value',
      label: text({ en: 'Water', fr: 'Eau', de: 'Wasser', es: 'Agua' }),
      icon: 'droplet',
      device_feature: ids.feature(FEATURES.WATER_INLET),
    });
  }
  components.push({
    type: 'value',
    label: text({ en: 'Setpoint', fr: 'Consigne', de: 'Sollwert', es: 'Consigna' }),
    icon: 'target',
    device_feature: ids.feature(FEATURES.TARGET_TEMPERATURE),
  });
  if (pump.profile.sensors.ambient) {
    components.push({
      type: 'value',
      label: text({ en: 'Outdoor', fr: 'Extérieur', de: 'Außen', es: 'Exterior' }),
      icon: 'sun',
      device_feature: ids.feature(FEATURES.AMBIENT),
    });
  }
  components.push({ type: 'status', items: statusItems(pump) });
  // `params` are written here and sent back as they are: the handler never
  // receives user input (a dashboard can hang on a public wall).
  components.push({
    type: 'button',
    label:
      readings.power === true
        ? text({ en: 'Turn off', fr: 'Éteindre', de: 'Ausschalten', es: 'Apagar' })
        : text({ en: 'Turn on', fr: 'Allumer', de: 'Einschalten', es: 'Encender' }),
    icon: 'power',
    style: readings.power === true ? 'secondary' : 'primary',
    action: { key: WIDGET_ACTIONS.TOGGLE_POWER, params: { device: ids.device } },
  });
  components.push({
    type: 'button',
    label: text({ en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' }),
    icon: 'refresh-cw',
    style: 'secondary',
    action: { key: WIDGET_ACTIONS.REFRESH, params: { device: ids.device } },
  });
  return {
    // The computed rows change with the reads: the TTL follows the poll
    // interval, and index.js nudges the widget after every read it publishes.
    ttl_seconds: 300,
    components,
  };
}

/** A tapped button: resolves the toast shown to the user. */
export async function handleWidgetAction({ fleet, actionKey, params }) {
  logger.info(`Widget action ${actionKey} <- ${params?.device}`);
  const pump = fleet.requirePump(params?.device);
  if (actionKey === WIDGET_ACTIONS.TOGGLE_POWER) {
    const on = readingsOf(pump).power !== true;
    await fleet.setPower(pump, on);
    return on
      ? text({
          en: 'Heat pump turned on.',
          fr: 'Pompe à chaleur allumée.',
          de: 'Wärmepumpe eingeschaltet.',
          es: 'Bomba de calor encendida.',
        })
      : text({
          en: 'Heat pump turned off.',
          fr: 'Pompe à chaleur éteinte.',
          de: 'Wärmepumpe ausgeschaltet.',
          es: 'Bomba de calor apagada.',
        });
  }
  if (actionKey === WIDGET_ACTIONS.REFRESH) {
    await fleet.refresh();
    await fleet.read(pump);
    return text({
      en: 'Values read from the cloud.',
      fr: 'Valeurs relues depuis le cloud.',
      de: 'Werte aus der Cloud gelesen.',
      es: 'Valores leídos de la nube.',
    });
  }
  // Throwing acks the action as failed: the message reaches the user.
  throw new Error(`Unknown widget action: ${actionKey}`);
}
