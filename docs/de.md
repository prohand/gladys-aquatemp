# Aqua Temp

Steuere deine **Aqua-Temp**-Wärmepumpen in Gladys: Pool-Wärmepumpen (Phnix und die vielen Marken
mit derselben Steuerung) und **Hi-Temp**-Warmwasserbereiter, über die Aqua-Temp-Cloud — dieselbe,
die die Aqua-Temp-App verwendet.

## Bevor du anfängst

- Eine Wärmepumpe, die bereits in der **Aqua-Temp**-App funktioniert (WLAN eingerichtet, in der
  App sichtbar).
- E-Mail-Adresse und Passwort des Aqua-Temp-Kontos.
- Gladys 5.3 oder neuer.

> **Tipp: Verwende ein zweites Konto.** Die Aqua-Temp-App hält **nur eine Sitzung pro Konto**:
> Meldet sich Gladys an, kann die App dich abmelden (und umgekehrt). Lege ein zweites
> Aqua-Temp-Konto an, teile deine Wärmepumpe in der App mit ihm (_Gerät → Teilen_), nimm die
> Freigabe an und gib **dieses** Konto in Gladys ein. Geteilte Wärmepumpen werden wie deine
> eigenen gefunden.

## Konfiguration

Öffne **Integrationen → Aqua Temp → Konfiguration**:

| Feld                         | Was einzugeben ist                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| E-Mail                       | Die E-Mail-Adresse des Aqua-Temp-Kontos.                                                         |
| Passwort                     | Sein Passwort. Nur sein MD5-Fingerabdruck geht an die Cloud, wie bei der App.                    |
| Kontotyp                     | **Aqua Temp** (Standard), **Hi Temp** oder **Aqua Temp (App 1.5.8 oder älter)** für alte Konten. |
| Aktualisierungsintervall (s) | Wie oft jede Wärmepumpe gelesen wird, 60 bis 3600 Sekunden (Standard 60).                        |
| Zertifikat der Cloud prüfen  | Eingeschaltet lassen (siehe _Fehlerbehebung_).                                                   |

Klicke auf **Verbindung testen**: Die Antwort listet die gefundenen Wärmepumpen. Öffne dann den
Reiter **Entdecken** und füge die gewünschten Wärmepumpen zu Gladys hinzu.

## Was du bekommst

Jede Wärmepumpe ist ein Gladys-Gerät:

| Funktion                   | Typ                            | Steuerbar |
| -------------------------- | ------------------------------ | --------- |
| Ein/Aus                    | Klimaanlage ein/aus            | Ja        |
| Modus                      | Kühlen / Heizen / Automatik    | Ja        |
| Solltemperatur             | Sollwert, °C                   | Ja        |
| Leisemodus                 | Schalter (geräuscharmer Modus) | Ja        |
| Wassertemperatur (Eingang) | Temperatursensor               | Nein      |
| Wassertemperatur (Ausgang) | Temperatursensor               | Nein      |
| Außentemperatur            | Temperatursensor               | Nein      |

Hi-Temp-Warmwasserbereiter haben weder Modus noch Leisemodus: nur Ein/Aus, Sollwert und
Temperaturen.

Der Sollwert wird für den **aktuellen Modus** geschrieben (Heizen, Kühlen und Automatik haben
jeweils ihren eigenen) und im Bereich gehalten, den die Wärmepumpe akzeptiert. Das Abzeichen jedes
Geräts zeigt **Cloud** oder **nicht erreichbar**, wenn die Aqua-Temp-Cloud die Wärmepumpe verloren
hat.

## Szenen

**Auslöser** (Kategorie _Integrationen_ der Auslöserauswahl):

- **Eine Wärmepumpe meldet eine Störung** — Variablen: Name der Wärmepumpe, Störungstext.
- **Eine Störung der Wärmepumpe ist behoben**.
- **Eine Wärmepumpe geht online oder offline** — Filter auf den Status; Variablen: Name, Status.

Eine beim Start der Integration bereits vorhandene Störung wird gelernt, nicht erneut ausgelöst.

**Aktionen**:

- **Modus der Wärmepumpe setzen** — Aus, Heizen, Kühlen oder Automatik (schaltet die Wärmepumpe
  bei Bedarf ein).
- **Leisemodus einstellen** — an oder aus. Die Ausgabe `applied` ist falsch bei einer Wärmepumpe
  ohne Leisemodus.
- **Status der Wärmepumpe lesen** — frisch gelesen; Ausgaben: `online`, `power`, `mode`,
  `water_temperature`, `target_temperature`, `in_fault`, `fault`. Nutze sie in den folgenden
  Bedingungen (z. B. _Wasser unter 26 °C_).

## Dashboard-Widget

Füge das Widget **Wärmepumpe** zu einem Dashboard hinzu: Wassertemperatur, Sollwert und
Außentemperatur (live), Cloud-Status, Modus, Leisemodus und Störung, dazu die Schaltflächen
**Einschalten / Ausschalten** und **Aktualisieren**. Seine Einstellung wählt die Wärmepumpe (sonst
die erste).

## Fehlerbehebung

- **Anmeldung abgelehnt** — prüfe E-Mail und Passwort in der App. Ein mit der App 1.5.8 oder
  älter angelegtes Konto braucht den Kontotyp **Aqua Temp (App 1.5.8 oder älter)**.
- **Die App meldet mich ab / Gladys verliert die Verbindung** — verwende ein zweites Konto (siehe
  Tipp oben).
- **Zertifikat abgelehnt** — die Aqua-Temp-Cloud hat schon Zertifikate geliefert, die andere
  Clients ignorieren mussten. Meldet der Verbindungstest das, schalte **Zertifikat der Cloud
  prüfen** aus. Der Fingerabdruck deines Passworts wird dann ohne Nachweis der Serveridentität
  übertragen: schalte es so bald wie möglich wieder ein.
- **Die Werte ändern sich nicht** — die Cloud kennt nur, was die Wärmepumpe sendet; prüfe, ob
  auch die App frische Werte zeigt.

Die API der Aqua-Temp-Cloud ist nicht öffentlich: Diese Integration spricht sie wie die App, und
eine Änderung auf Seiten von Aqua Temp kann sie brechen. Melde Probleme auf
[GitHub](https://github.com/prohand/gladys-aquatemp/issues).
