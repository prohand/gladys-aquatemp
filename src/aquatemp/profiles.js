// -----------------------------------------------------------------------------
// Protocol codes of the heat pumps.
//
// The Aqua Temp cloud exposes every value of a heat pump as a "protocol code"
// (`Power`, `Mode`, `T02`...), and not every model uses the same codes: the
// controller board of the product decides. The cloud tells the product by its
// `productId`; this table maps the products we know to their codes, and every
// other product to the common Aqua Temp board.
//
// Source: the product mappings of the community Home Assistant integration
// (radical-squared/aquatemp), the reference for this undocumented API.
// -----------------------------------------------------------------------------

/** The heat pump modes the integration knows, as Gladys stores them. */
export const PUMP_MODES = { COOL: 'cool', HEAT: 'heat', AUTO: 'auto' };

/** Common Aqua Temp board: pool heat pumps (cool / heat / auto). */
const AQUA_TEMP = {
  id: 'aqua-temp',
  power: 'Power',
  // The cloud reads `Power` but only accepts the lower-case code in a
  // control order (same quirk in every client of this API).
  powerControl: 'power',
  mode: 'Mode',
  // `Set_Temp` is what the display shows; the per-mode setpoints below are
  // what the board regulates on. A setpoint change writes both.
  setTemp: 'Set_Temp',
  silent: 'Manual-mute',
  modes: {
    [PUMP_MODES.COOL]: { value: '0', target: 'R01', min: 'R08', max: 'R09' },
    [PUMP_MODES.HEAT]: { value: '1', target: 'R02', min: 'R10', max: 'R11' },
    [PUMP_MODES.AUTO]: { value: '2', target: 'R03', min: 'R08', max: 'R11' },
  },
  sensors: { water_inlet: 'T02', water_outlet: 'T03', ambient: 'T05' },
};

/** Variant of the same board whose sensors are numbered without the zero. */
const AQUA_TEMP_SHORT = {
  ...AQUA_TEMP,
  id: 'aqua-temp-short',
  sensors: { water_inlet: 'T2', water_outlet: 'T3', ambient: 'T5' },
};

/** Hi Temp water heaters: heating only, one setpoint, tank temperatures. */
const HI_TEMP = {
  id: 'hi-temp',
  power: 'MO6',
  powerControl: 'mo6',
  mode: null,
  setTemp: 'R01',
  silent: null,
  modes: {
    [PUMP_MODES.HEAT]: { value: '0', target: 'R01', min: null, max: null },
  },
  // T10 is the water temperature the display shows; T01 the ambient air.
  sensors: { water_inlet: 'T10', water_outlet: null, ambient: 'T01' },
};

const BY_PRODUCT = {
  '1245226668902080512': HI_TEMP,
  '1442284873216843776': AQUA_TEMP_SHORT,
};

/** Every product id the device lists are filtered on (the app sends the same list). */
export const PRODUCT_IDS = [
  '1245226668902080512',
  '1132174963097280512',
  '1656269521923575808',
  '1663080854333558784',
  '1596427678569979904',
  '1674238226096406528',
  '1650063968998252544',
  '1668781858447085568',
  '1186904563333062656',
  '1158905952238313472',
  '1442284873216843776',
  '1732565142225256450',
  '1548963836789501952',
  '1669159229372477440',
  '1650758828508766208',
  '1664085465655808000',
];

/** The codes of a product; the common board when the product is unknown. */
export function profileFor(productId) {
  return BY_PRODUCT[String(productId ?? '')] ?? AQUA_TEMP;
}

/** Every protocol code a read of this profile asks for. */
export function readCodes(profile) {
  const codes = [profile.power, profile.mode, profile.setTemp, profile.silent];
  for (const mode of Object.values(profile.modes)) {
    codes.push(mode.target, mode.min, mode.max);
  }
  codes.push(...Object.values(profile.sensors));
  return [...new Set(codes.filter(Boolean))];
}

/** The Gladys-side mode of a raw `Mode` value, or null. */
export function modeFromRaw(profile, raw) {
  if (!profile.mode) {
    // Single-mode boards have no `Mode` code: they are in their only mode.
    return Object.keys(profile.modes)[0];
  }
  const entry = Object.entries(profile.modes).find(([, mode]) => mode.value === String(raw));
  return entry ? entry[0] : null;
}
