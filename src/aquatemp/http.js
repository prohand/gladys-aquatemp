// -----------------------------------------------------------------------------
// The one HTTP call the Aqua Temp cloud needs: POST a JSON body, read a JSON
// answer.
//
// node:https rather than the global fetch: fetch cannot turn the certificate
// check off, and the Aqua Temp cloud has served a certificate other clients
// had to skip (the Home Assistant integration disables the check for good).
// Here the check stays ON unless the user turns `strict_tls` off — the
// password hash travels in these requests.
// -----------------------------------------------------------------------------

import { request } from 'node:https';

/** A request that hangs is a cloud that is down: give up long before Gladys does. */
export const REQUEST_TIMEOUT_MS = 15000;

/** Larger answers are not an Aqua Temp answer: stop reading. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

/** The parsed JSON, or null for an empty or unreadable answer. */
function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/**
 * POST `body` as JSON to `url`.
 *
 * @param {string} url absolute https URL
 * @param {unknown} body serialized as JSON
 * @param {object} [options]
 * @param {Record<string, string>} [options.headers] extra headers
 * @param {boolean} [options.strictTls] verify the server certificate (default true)
 * @param {number} [options.timeoutMs]
 * @returns {Promise<{ status: number, body: any }>} `body` is the parsed JSON, or null
 */
export function postJson(url, body, { headers = {}, strictTls = true, timeoutMs } = {}) {
  const payload = Buffer.from(JSON.stringify(body ?? {}), 'utf8');
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': payload.length,
          Accept: 'application/json',
          ...headers,
        },
        rejectUnauthorized: strictTls,
        timeout: timeoutMs ?? REQUEST_TIMEOUT_MS,
      },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_BODY_BYTES) {
            req.destroy(new Error('Answer too large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode ?? 0, body: parseJson(text) });
        });
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    req.end(payload);
  });
}
