// -----------------------------------------------------------------------------
// Client of the Aqua Temp cloud (cloud.linked-go.com), the server behind the
// Aqua Temp and Hi Temp mobile apps.
//
// The API is undocumented. What this client relies on, the same calls as the
// app and the community clients:
//   - login with the account e-mail and the MD5 of the password, answered by
//     an `x-token` sent back in a header on every other call;
//   - the account's own heat pumps, plus the ones shared with it;
//   - a read of chosen "protocol codes" (`Power`, `T02`...) and a control
//     call writing some of them;
//   - the fault text of a heat pump in fault.
// Every answer carries `error_msg` ("Success" when it worked) and
// `error_code` ("-100" when the token expired: the app logged in elsewhere).
//
// Two generations of the server exist: the current one (port 449, camelCase
// keys) and the legacy one (accounts created with app 1.5.8 or older,
// snake_case keys and a `.json` suffix). Hi Temp accounts use the current one.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import { createLogger } from '@gladysassistant/integration-sdk';
import { API_TYPES } from '../config.js';
import { PRODUCT_IDS } from './profiles.js';
import { postJson } from './http.js';

const logger = createLogger({ name: 'aquatemp-api' });

const CURRENT = {
  url: 'https://cloud.linked-go.com:449/crmservice/api',
  suffix: '',
  keepAlive: false,
  keys: {
    userName: 'userName',
    userId: 'userId',
    objectResult: 'objectResult',
    productIds: 'productIds',
    pageIndex: 'pageIndex',
    pageSize: 'pageSize',
    toUser: 'toUser',
    deviceCode: 'deviceCode',
    protocalCodes: 'protocalCodes', // sic: the server's spelling
    protocolCode: 'protocolCode',
    isFault: 'isFault',
    nickName: 'deviceNickName',
    productId: 'productId',
    status: 'deviceStatus',
    model: 'custModel',
  },
};

const LEGACY = {
  url: 'https://cloud.linked-go.com/cloudservice/api',
  suffix: '.json',
  // The legacy server stops refreshing a heat pump nobody queries: the app
  // sends this Modbus read first, so does this client.
  keepAlive: true,
  keys: {
    userName: 'user_name',
    userId: 'user_id',
    objectResult: 'object_result',
    productIds: 'product_ids',
    pageIndex: 'page_index',
    pageSize: 'page_size',
    toUser: 'to_user',
    deviceCode: 'device_code',
    protocalCodes: 'protocal_codes',
    protocolCode: 'protocol_code',
    isFault: 'is_fault',
    nickName: 'device_nick_name',
    productId: 'product_id',
    status: 'device_status',
    model: 'cust_model',
  },
};

export const ENDPOINTS = {
  LOGIN: 'app/user/login',
  USER_INFO: 'app/user/getUserInfo',
  OWN_DEVICES: 'app/device/deviceList',
  SHARED_DEVICES: 'app/device/getMyAppectDeviceShareDataList',
  DATA: 'app/device/getDataByCode',
  CONTROL: 'app/device/control',
  FAULT: 'app/device/getFaultDataByDeviceCode',
  KEEP_ALIVE: 'device/sendDevicePassthroughInstruction',
};

const SUCCESS = 'Success';
const TOKEN_EXPIRED = '-100';
const KEEP_ALIVE_INSTRUCTION = '630300040001CD89';

/** The server generation an account type talks to. */
export function variantFor(apiType) {
  return apiType === API_TYPES.AQUA_TEMP_LEGACY ? LEGACY : CURRENT;
}

/** Login refused: wrong e-mail or password, or an account on another server. */
export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

/** The cloud answered, but not with "Success". */
export class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

function md5(text) {
  return createHash('md5').update(text, 'utf8').digest('hex');
}

/** `true`, `"true"`, `1`, `"1"` — the cloud is not consistent. */
export function parseFlag(value) {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

export class AquaTempClient {
  /**
   * @param {object} options
   * @param {string} options.username account e-mail
   * @param {string} options.password plain password (only its MD5 is sent)
   * @param {string} [options.apiType] one of API_TYPES
   * @param {boolean} [options.strictTls] verify the server certificate
   * @param {Function} [options.post] HTTP transport, `postJson` by default (tests inject a fake)
   */
  constructor({ username, password, apiType = API_TYPES.AQUA_TEMP, strictTls = true, post }) {
    this.username = username;
    this.passwordHash = md5(password ?? '');
    this.variant = variantFor(apiType);
    this.strictTls = strictTls;
    this.post = post ?? postJson;
    this.token = null;
    this.userId = null;
  }

  get keys() {
    return this.variant.keys;
  }

  url(endpoint) {
    return `${this.variant.url}/${endpoint}${this.variant.suffix}`;
  }

  async send(endpoint, body, withToken = true) {
    const headers = withToken && this.token ? { 'x-token': this.token } : {};
    const { status, body: answer } = await this.post(this.url(endpoint), body, {
      headers,
      strictTls: this.strictTls,
    });
    if (status === 401 || status === 403) {
      throw new ApiError(`HTTP ${status}`, TOKEN_EXPIRED);
    }
    if (status < 200 || status >= 300) {
      throw new ApiError(`HTTP ${status} on ${endpoint}`, String(status));
    }
    if (!answer || typeof answer !== 'object') {
      throw new ApiError(`Unreadable answer on ${endpoint}`, 'parse');
    }
    if (answer.error_msg !== undefined && answer.error_msg !== SUCCESS) {
      throw new ApiError(String(answer.error_msg), String(answer.error_code ?? ''));
    }
    return answer;
  }

  /** Log in and read the user id the shared-device list needs. */
  async login() {
    this.token = null;
    let answer;
    try {
      answer = await this.send(
        ENDPOINTS.LOGIN,
        { [this.keys.userName]: this.username, password: this.passwordHash },
        false,
      );
    } catch (err) {
      if (err instanceof ApiError) {
        throw new AuthError(err.message);
      }
      throw err;
    }
    const token = answer[this.keys.objectResult]?.['x-token'];
    if (!token) {
      throw new AuthError('No token in the login answer');
    }
    this.token = token;
    logger.debug('Logged in to the Aqua Temp cloud');
    const info = await this.send(ENDPOINTS.USER_INFO, {});
    this.userId = info[this.keys.objectResult]?.[this.keys.userId] ?? null;
  }

  /**
   * One authenticated call. An expired token (the app logged in elsewhere,
   * or the server restarted) gets one fresh login and one retry.
   */
  async call(endpoint, body) {
    if (!this.token) {
      await this.login();
    }
    try {
      return await this.send(endpoint, body);
    } catch (err) {
      if (!(err instanceof ApiError) || err.code !== TOKEN_EXPIRED) {
        throw err;
      }
      logger.info('Aqua Temp token expired, logging in again');
      await this.login();
      return this.send(endpoint, body);
    }
  }

  /** A device of a list answer, in the shape the rest of the code uses. */
  normalizeDevice(raw) {
    const k = this.keys;
    const code = raw?.[k.deviceCode];
    if (!code) {
      return null;
    }
    return {
      code: String(code),
      name: String(raw[k.nickName] || raw[k.model] || code),
      productId: raw[k.productId] != null ? String(raw[k.productId]) : null,
      model: raw[k.model] != null ? String(raw[k.model]) : null,
      online: String(raw[k.status] ?? '').toUpperCase() === 'ONLINE',
      fault: parseFlag(raw[k.isFault]),
    };
  }

  /** The account's heat pumps and the ones shared with it, each code once. */
  async listDevices() {
    const k = this.keys;
    const paging = { [k.productIds]: PRODUCT_IDS, [k.pageIndex]: 1, [k.pageSize]: 999 };
    const own = await this.call(ENDPOINTS.OWN_DEVICES, paging);
    const lists = [own[k.objectResult]];
    if (this.userId) {
      try {
        const shared = await this.call(ENDPOINTS.SHARED_DEVICES, {
          ...paging,
          [k.toUser]: this.userId,
        });
        lists.push(shared[k.objectResult]);
      } catch (err) {
        // A failing share list must not hide the account's own heat pumps.
        logger.warn(`Shared heat pumps unavailable: ${err.message}`);
      }
    }
    const devices = new Map();
    for (const list of lists) {
      for (const raw of Array.isArray(list) ? list : []) {
        const device = this.normalizeDevice(raw);
        if (device && !devices.has(device.code)) {
          devices.set(device.code, device);
        }
      }
    }
    return [...devices.values()];
  }

  /**
   * Read protocol codes of one heat pump.
   * @returns {Promise<Record<string, string|null>>} code -> raw value ('' read as null)
   */
  async readValues(deviceCode, codes) {
    const k = this.keys;
    if (this.variant.keepAlive) {
      await this.call(ENDPOINTS.KEEP_ALIVE, {
        [k.deviceCode]: deviceCode,
        query_instruction: KEEP_ALIVE_INSTRUCTION,
      }).catch((err) => logger.debug(`Keep-alive refused: ${err.message}`));
    }
    const answer = await this.call(ENDPOINTS.DATA, {
      [k.deviceCode]: deviceCode,
      [k.protocalCodes]: codes,
    });
    const values = {};
    for (const item of answer[k.objectResult] ?? []) {
      if (item && item.code !== undefined) {
        values[item.code] = item.value === '' || item.value === undefined ? null : item.value;
      }
    }
    return values;
  }

  /** The fault text of a heat pump in fault, null when the cloud has none. */
  async readFault(deviceCode) {
    const answer = await this.call(ENDPOINTS.FAULT, { [this.keys.deviceCode]: deviceCode });
    const faults = answer[this.keys.objectResult];
    const first = Array.isArray(faults) ? faults[0] : null;
    return first?.description ? String(first.description) : null;
  }

  /**
   * Write protocol codes of one heat pump, in one order.
   * @param {string} deviceCode
   * @param {{ code: string, value: string|number }[]} writes
   */
  async control(deviceCode, writes) {
    const k = this.keys;
    logger.info(
      `Control ${deviceCode}: ${writes.map(({ code, value }) => `${code}=${value}`).join(', ')}`,
    );
    await this.call(ENDPOINTS.CONTROL, {
      param: writes.map(({ code, value }) => ({
        [k.deviceCode]: deviceCode,
        [k.protocolCode]: code,
        value: String(value),
      })),
    });
  }
}
