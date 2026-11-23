// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys from the `config_schema` of
// `gladys-assistant-integration.json`. The SDK fetches it (`getConfig`) and
// pushes every change (`onConfigUpdated`); this module only applies the
// defaults and the types, so the rest of the code never sees `undefined` or a
// number typed as a string.
// -----------------------------------------------------------------------------

/** Which Aqua Temp cloud the account lives on (see src/aquatemp/api.js). */
export const API_TYPES = {
  AQUA_TEMP: 'aqua_temp',
  HI_TEMP: 'hi_temp',
  AQUA_TEMP_LEGACY: 'aqua_temp_legacy',
};

/** Seconds between two reads of a heat pump: Gladys polls at most once a minute. */
export const MIN_POLL_SECONDS = 60;
export const MAX_POLL_SECONDS = 3600;

// MUST stay equal to the `default` values of the manifest (test/manifest.test.js).
export const DEFAULT_CONFIG = {
  username: '',
  password: '',
  api_type: API_TYPES.AQUA_TEMP,
  poll_frequency: 60,
  strict_tls: true,
};

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

/**
 * Merge the user config with the defaults and force the types.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const apiType = Object.values(API_TYPES).includes(raw.api_type)
    ? raw.api_type
    : DEFAULT_CONFIG.api_type;
  return {
    username: typeof raw.username === 'string' ? raw.username.trim() : '',
    password: typeof raw.password === 'string' ? raw.password : '',
    api_type: apiType,
    poll_frequency: clamp(
      raw.poll_frequency,
      MIN_POLL_SECONDS,
      MAX_POLL_SECONDS,
      DEFAULT_CONFIG.poll_frequency,
    ),
    // Anything but an explicit false keeps the certificate check on.
    strict_tls: raw.strict_tls !== false && raw.strict_tls !== 'false',
  };
}

/** Whether the user filled in what a login needs. */
export function hasCredentials(config) {
  return config.username.length > 0 && config.password.length > 0;
}
