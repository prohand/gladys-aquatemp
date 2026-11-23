// -----------------------------------------------------------------------------
// What the integration tells the user about its link to the Aqua Temp cloud:
// the connection status of the Configuration screen, and the report of the
// "Test the connection" button. Every text in the four languages of Gladys.
// -----------------------------------------------------------------------------

import { AuthError } from './aquatemp/api.js';
import { hasCredentials } from './config.js';
import { localize, pick } from './i18n.js';

export const MESSAGES = {
  NOT_CONFIGURED: {
    en: 'Enter the e-mail and the password of your Aqua Temp account.',
    fr: 'Saisissez l’e-mail et le mot de passe de votre compte Aqua Temp.',
    de: 'Gib die E-Mail-Adresse und das Passwort deines Aqua-Temp-Kontos ein.',
    es: 'Introduzca el correo electrónico y la contraseña de su cuenta Aqua Temp.',
  },
  AUTH_FAILED: {
    en: 'Login refused: check the e-mail, the password and the account type.',
    fr: 'Connexion refusée : vérifiez l’e-mail, le mot de passe et le type de compte.',
    de: 'Anmeldung abgelehnt: Prüfe E-Mail, Passwort und Kontotyp.',
    es: 'Inicio de sesión rechazado: compruebe el correo, la contraseña y el tipo de cuenta.',
  },
  TLS_FAILED: {
    en: 'The certificate of the Aqua Temp cloud was refused. See the documentation (strict TLS option).',
    fr: 'Le certificat du cloud Aqua Temp a été refusé. Voir la documentation (option TLS strict).',
    de: 'Das Zertifikat der Aqua-Temp-Cloud wurde abgelehnt. Siehe Dokumentation (Option striktes TLS).',
    es: 'Se ha rechazado el certificado de la nube Aqua Temp. Vea la documentación (opción TLS estricto).',
  },
  UNREACHABLE: {
    en: 'The Aqua Temp cloud cannot be reached. Retrying at the next refresh.',
    fr: 'Le cloud Aqua Temp est injoignable. Nouvel essai au prochain rafraîchissement.',
    de: 'Die Aqua-Temp-Cloud ist nicht erreichbar. Neuer Versuch bei der nächsten Aktualisierung.',
    es: 'No se puede acceder a la nube Aqua Temp. Se reintentará en la próxima actualización.',
  },
};

const TLS_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

/** The message that explains a failure, in every language. */
export function describeError(err) {
  if (err instanceof AuthError) {
    return MESSAGES.AUTH_FAILED;
  }
  if (TLS_CODES.has(err?.code)) {
    return MESSAGES.TLS_FAILED;
  }
  return MESSAGES.UNREACHABLE;
}

/**
 * Handler of the "Test the connection" action: log in, list the heat pumps,
 * and say what was found — or why it failed.
 */
export async function testConnection(fleet, config) {
  if (!hasCredentials(config)) {
    return MESSAGES.NOT_CONFIGURED;
  }
  try {
    const pumps = await fleet.refresh();
    const names = pumps.map((pump) => pump.name).join(', ');
    const online = pumps.filter((pump) => pump.online).length;
    return localize((language) =>
      pick(language, {
        en: `Connected. ${pumps.length} heat pump(s) found, ${online} online${names ? `: ${names}` : ''}.`,
        fr: `Connecté. ${pumps.length} pompe(s) à chaleur trouvée(s), ${online} en ligne${names ? ` : ${names}` : ''}.`,
        de: `Verbunden. ${pumps.length} Wärmepumpe(n) gefunden, ${online} online${names ? `: ${names}` : ''}.`,
        es: `Conectado. ${pumps.length} bomba(s) de calor encontrada(s), ${online} en línea${names ? `: ${names}` : ''}.`,
      }),
    );
  } catch (err) {
    return describeError(err);
  }
}
