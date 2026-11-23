// -----------------------------------------------------------------------------
// An in-memory Aqua Temp cloud, answering the `post` transport of
// AquaTempClient the way cloud.linked-go.com does (current server: camelCase
// keys; legacy server: snake_case keys and a `.json` suffix). No network.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';

const md5 = (text) => createHash('md5').update(text, 'utf8').digest('hex');

const ok = (result) => ({
  status: 200,
  body: { error_code: '0', error_msg: 'Success', ...result },
});
const fail = (code, message) => ({ status: 200, body: { error_code: code, error_msg: message } });

/**
 * @param {object} [options]
 * @param {string} [options.username]
 * @param {string} [options.password] plain password the account expects
 * @param {boolean} [options.legacy] answer like the legacy server
 */
export function createFakeCloud({
  username = 'me@example.com',
  password = 'secret',
  legacy = false,
} = {}) {
  const k = legacy
    ? {
        userName: 'user_name',
        userId: 'user_id',
        result: 'object_result',
        deviceCode: 'device_code',
        codes: 'protocal_codes',
        protocolCode: 'protocol_code',
        nickName: 'device_nick_name',
        productId: 'product_id',
        status: 'device_status',
        isFault: 'is_fault',
        toUser: 'to_user',
      }
    : {
        userName: 'userName',
        userId: 'userId',
        result: 'objectResult',
        deviceCode: 'deviceCode',
        codes: 'protocalCodes',
        protocolCode: 'protocolCode',
        nickName: 'deviceNickName',
        productId: 'productId',
        status: 'deviceStatus',
        isFault: 'isFault',
        toUser: 'toUser',
      };

  const cloud = {
    calls: [],
    controls: [],
    tokens: 0,
    token: null,
    /** Raise to make every call fail the network way. */
    down: false,
    own: [],
    shared: [],
    values: {},
    faults: {},

    /** Add a heat pump; `shared` puts it in the list shared with the account. */
    addPump({
      code,
      name = code,
      productId = '1132174963097280512',
      online = true,
      fault = false,
      shared = false,
      values = {},
    }) {
      const entry = {
        [k.deviceCode]: code,
        [k.nickName]: name,
        [k.productId]: productId,
        [k.status]: online ? 'ONLINE' : 'OFFLINE',
        [k.isFault]: fault,
        custModel: 'AQUA-TEST',
      };
      (shared ? cloud.shared : cloud.own).push(entry);
      cloud.values[code] = { ...values };
      return entry;
    },

    setPump(code, { online, fault }) {
      const entry = [...cloud.own, ...cloud.shared].find((pump) => pump[k.deviceCode] === code);
      if (online !== undefined) entry[k.status] = online ? 'ONLINE' : 'OFFLINE';
      if (fault !== undefined) entry[k.isFault] = fault;
    },

    /** Forget the token, as when the app logs in elsewhere. */
    expireToken() {
      cloud.token = null;
    },

    async post(url, body, { headers = {} } = {}) {
      if (cloud.down) {
        throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
      }
      const base = legacy
        ? 'https://cloud.linked-go.com/cloudservice/api/'
        : 'https://cloud.linked-go.com:449/crmservice/api/';
      if (!url.startsWith(base)) {
        return { status: 404, body: null };
      }
      let endpoint = url.slice(base.length);
      if (legacy) {
        if (!endpoint.endsWith('.json')) return { status: 404, body: null };
        endpoint = endpoint.slice(0, -'.json'.length);
      }
      cloud.calls.push({ endpoint, body, headers });

      if (endpoint === 'app/user/login') {
        if (body[k.userName] !== username || body.password !== md5(password)) {
          return fail('-1', 'Wrong user name or password');
        }
        cloud.tokens += 1;
        cloud.token = `token-${cloud.tokens}`;
        return ok({ [k.result]: { 'x-token': cloud.token } });
      }
      if (!cloud.token || headers['x-token'] !== cloud.token) {
        return fail('-100', 'Token invalid');
      }
      switch (endpoint) {
        case 'app/user/getUserInfo':
          return ok({ [k.result]: { [k.userId]: 'user-1' } });
        case 'app/device/deviceList':
          return ok({ [k.result]: cloud.own.map((pump) => ({ ...pump })) });
        case 'app/device/getMyAppectDeviceShareDataList':
          if (body[k.toUser] !== 'user-1') return fail('-2', 'Unknown user');
          return ok({ [k.result]: cloud.shared.map((pump) => ({ ...pump })) });
        case 'app/device/getDataByCode': {
          const values = cloud.values[body[k.deviceCode]] ?? {};
          return ok({
            [k.result]: body[k.codes]
              .filter((code) => code in values)
              .map((code) => ({ code, value: values[code] })),
          });
        }
        case 'app/device/control':
          for (const write of body.param) {
            cloud.controls.push({
              device: write[k.deviceCode],
              code: write[k.protocolCode],
              value: write.value,
            });
            // The board stores the power under its read code.
            const code = write[k.protocolCode] === 'power' ? 'Power' : write[k.protocolCode];
            cloud.values[write[k.deviceCode]][code] = write.value;
          }
          return ok({});
        case 'app/device/getFaultDataByDeviceCode': {
          const text = cloud.faults[body[k.deviceCode]];
          return ok({ [k.result]: text ? [{ description: text }] : [] });
        }
        case 'device/sendDevicePassthroughInstruction':
          return ok({});
        default:
          return { status: 404, body: null };
      }
    },
  };
  cloud.post = cloud.post.bind(cloud);
  return cloud;
}

/** Typical values of a pool heat pump heating at 28 °C, water at 24.5 °C. */
export const HEATING_VALUES = {
  Power: '1',
  Mode: '1',
  Set_Temp: '28',
  'Manual-mute': '0',
  R01: '27',
  R02: '28',
  R03: '27',
  R08: '8',
  R09: '28',
  R10: '15',
  R11: '40',
  T02: '24.5',
  T03: '26.0',
  T05: '18.3',
};
