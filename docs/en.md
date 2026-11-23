# Aqua Temp

Control your **Aqua Temp** heat pumps from Gladys: pool heat pumps (Phnix and the many brands
built on the same controller) and **Hi Temp** water heaters, through the Aqua Temp cloud — the
one the Aqua Temp mobile app uses.

## Before you start

- A heat pump already working in the **Aqua Temp** app (Wi-Fi set up, visible in the app).
- The e-mail and the password of the Aqua Temp account.
- Gladys 5.3 or newer.

> **Tip: use a second account.** The Aqua Temp app keeps **one session per account**: when
> Gladys logs in, the app may log you out (and the other way round). Create a second Aqua Temp
> account, share your heat pump with it from the app (_Device → Share_), accept the share, and
> enter **that** account in Gladys. Shared heat pumps are found like your own.

## Configuration

Open **Integrations → Aqua Temp → Configuration**:

| Field                       | What to enter                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| E-mail                      | The e-mail of the Aqua Temp account.                                                          |
| Password                    | Its password. Only its MD5 fingerprint is sent to the cloud, as the app does.                 |
| Account type                | **Aqua Temp** (default), **Hi Temp**, or **Aqua Temp (app 1.5.8 or older)** for old accounts. |
| Refresh interval (s)        | How often each heat pump is read, 60 to 3600 seconds (default 60).                            |
| Check the cloud certificate | Keep it on (see _Troubleshooting_).                                                           |

Click **Test the connection**: the answer lists the heat pumps found. Then open the **Discover**
tab and add the heat pumps you want in Gladys.

## What you get

Each heat pump is one Gladys device:

| Feature                    | Type                     | Control |
| -------------------------- | ------------------------ | ------- |
| Power                      | Air conditioning on/off  | Yes     |
| Mode                       | Cooling / heating / auto | Yes     |
| Target temperature         | Setpoint, °C             | Yes     |
| Silent mode                | Switch (low-noise mode)  | Yes     |
| Water temperature (inlet)  | Temperature sensor       | No      |
| Water temperature (outlet) | Temperature sensor       | No      |
| Outdoor temperature        | Temperature sensor       | No      |

Hi Temp water heaters have no mode and no silent mode: only power, setpoint and temperatures.

The setpoint is written for the **current mode** (heating, cooling and auto each keep their own
setpoint) and kept inside the range the heat pump accepts. The badge of each device says
**cloud**, or **unreachable** when the Aqua Temp cloud has lost the heat pump.

## Scenes

**Triggers** (_Integrations_ category of the trigger picker):

- **A heat pump reports a fault** — variables: heat pump name, fault text.
- **A heat pump fault is cleared**.
- **A heat pump goes online or offline** — filter on the status; variables: name, status.

A fault already present when the integration starts is learned, not replayed.

**Actions**:

- **Set the heat pump mode** — off, heating, cooling or auto (turns the heat pump on if needed).
- **Set the silent mode** — on or off. Output `applied` is false on a heat pump without one.
- **Read the heat pump status** — a fresh read; outputs: `online`, `power`, `mode`,
  `water_temperature`, `target_temperature`, `in_fault`, `fault`. Use them in the next
  conditions (e.g. _water below 26 °C_).

## Dashboard widget

Add the **Heat pump** widget to a dashboard: water temperature, setpoint and outdoor temperature
(live), cloud status, mode, silent mode and fault, plus **Turn on / Turn off** and **Refresh**
buttons. Its setting picks the heat pump (the first one by default).

## Troubleshooting

- **Login refused** — check the e-mail and the password in the app. An account created with the
  app 1.5.8 or older needs the account type **Aqua Temp (app 1.5.8 or older)**.
- **The app logs me out / Gladys loses the connection** — use a second account (see the tip
  above).
- **Certificate refused** — the Aqua Temp cloud has served certificates other clients had to
  skip. If the connection test reports it, turn **Check the cloud certificate** off. Your
  password fingerprint then travels without proof of the server's identity: turn it back on
  when you can.
- **Values do not move** — the cloud only knows what the heat pump sends; check that the app
  shows fresh values too.

The Aqua Temp cloud API is not public: this integration speaks it like the app does, and a
change on Aqua Temp's side can break it. Report problems on
[GitHub](https://github.com/prohand/gladys-aquatemp/issues).
