# Security policy

## Supported versions

Only the latest release of the Aqua Temp integration receives security fixes.
Update the integration from the Gladys store before reporting an issue.

| Version      | Supported |
| ------------ | --------- |
| 1.x (latest) | Yes       |
| older        | No        |

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Report it privately through GitHub: open the **Security** tab of
[prohand/gladys-aquatemp](https://github.com/prohand/gladys-aquatemp/security), then
**Report a vulnerability**.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- any log line that helps (remove e-mails, tokens, passwords and device codes first).

You should get a first answer within 7 days. A fix is released as a new version of
the integration, and the advisory is published once users can update.

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (report to
[GladysAssistant/Gladys](https://github.com/GladysAssistant/Gladys/security)), the
Aqua Temp cloud and mobile apps (report to their vendor), and the heat pumps.

## How the integration handles your account

- The password is stored by Gladys in a **secret** field and never logged. Like the
  Aqua Temp app, the integration only sends its MD5 fingerprint to the cloud; MD5 is
  weak, so treat a leaked fingerprint as a leaked password.
- The session token is kept in memory only, never written to disk or to the logs.
- Every request goes over HTTPS, and the server certificate is checked. The **Check
  the cloud certificate** option turns that check off for a broken cloud certificate:
  leave it on unless the connection test asks for it.

## Good practices for users

- Use a dedicated Aqua Temp account for Gladys, with the heat pump shared to it: a
  leak then exposes an account that owns nothing.
- Use a password you do not use anywhere else.
- Keep Gladys and the integration up to date.
