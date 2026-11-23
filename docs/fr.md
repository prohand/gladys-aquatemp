# Aqua Temp

Pilotez vos pompes à chaleur **Aqua Temp** depuis Gladys : pompes à chaleur de piscine (Phnix et
les nombreuses marques bâties sur le même contrôleur) et chauffe-eau **Hi Temp**, via le cloud
Aqua Temp — celui qu'utilise l'application mobile Aqua Temp.

## Avant de commencer

- Une pompe à chaleur qui fonctionne déjà dans l'application **Aqua Temp** (Wi-Fi configuré,
  visible dans l'application).
- L'e-mail et le mot de passe du compte Aqua Temp.
- Gladys 5.3 ou plus récent.

> **Astuce : utilisez un second compte.** L'application Aqua Temp ne garde **qu'une session par
> compte** : quand Gladys se connecte, l'application peut vous déconnecter (et inversement).
> Créez un second compte Aqua Temp, partagez-lui votre pompe depuis l'application (_Appareil →
> Partager_), acceptez le partage, et saisissez **ce** compte dans Gladys. Les pompes partagées
> sont trouvées comme les vôtres.

## Configuration

Ouvrez **Intégrations → Aqua Temp → Configuration** :

| Champ                           | À saisir                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| E-mail                          | L'e-mail du compte Aqua Temp.                                                                                      |
| Mot de passe                    | Son mot de passe. Seule son empreinte MD5 part vers le cloud, comme le fait l'application.                         |
| Type de compte                  | **Aqua Temp** (par défaut), **Hi Temp**, ou **Aqua Temp (appli 1.5.8 ou plus ancienne)** pour les anciens comptes. |
| Intervalle de rafraîchissement  | Fréquence de lecture de chaque pompe, de 60 à 3600 secondes (60 par défaut).                                       |
| Vérifier le certificat du cloud | Laissez activé (voir _Dépannage_).                                                                                 |

Cliquez sur **Tester la connexion** : la réponse liste les pompes trouvées. Ouvrez ensuite
l'onglet **Découverte** et ajoutez les pompes voulues dans Gladys.

## Ce que vous obtenez

Chaque pompe à chaleur est un appareil Gladys :

| Fonctionnalité                | Type                               | Pilotable |
| ----------------------------- | ---------------------------------- | --------- |
| Marche / arrêt                | Climatisation marche/arrêt         | Oui       |
| Mode                          | Refroidissement / chauffage / auto | Oui       |
| Température de consigne       | Consigne, °C                       | Oui       |
| Mode silence                  | Interrupteur (mode basse vitesse)  | Oui       |
| Température de l'eau (entrée) | Capteur de température             | Non       |
| Température de l'eau (sortie) | Capteur de température             | Non       |
| Température extérieure        | Capteur de température             | Non       |

Les chauffe-eau Hi Temp n'ont ni mode ni mode silence : seulement marche/arrêt, consigne et
températures.

La consigne est écrite pour le **mode en cours** (chauffage, refroidissement et auto ont chacun
leur consigne) et gardée dans la plage acceptée par la pompe. Le badge de chaque appareil indique
**cloud**, ou **injoignable** quand le cloud Aqua Temp a perdu la pompe.

## Scènes

**Déclencheurs** (catégorie _Intégrations_ du choix des déclencheurs) :

- **Une pompe à chaleur signale un défaut** — variables : nom de la pompe, texte du défaut.
- **Le défaut d'une pompe à chaleur disparaît**.
- **Une pompe à chaleur se connecte ou se déconnecte** — filtre sur l'état ; variables : nom,
  état.

Un défaut déjà présent au démarrage de l'intégration est appris, pas rejoué.

**Actions** :

- **Changer le mode de la pompe à chaleur** — arrêt, chauffage, refroidissement ou auto (allume
  la pompe si besoin).
- **Régler le mode silence** — activé ou non. La sortie `applied` est fausse sur une pompe sans
  mode silence.
- **Lire l'état de la pompe à chaleur** — lecture fraîche ; sorties : `online`, `power`, `mode`,
  `water_temperature`, `target_temperature`, `in_fault`, `fault`. Utilisez-les dans les
  conditions suivantes (ex. _eau sous 26 °C_).

## Widget du tableau de bord

Ajoutez le widget **Pompe à chaleur** à un tableau de bord : température de l'eau, consigne et
température extérieure (en direct), état du cloud, mode, mode silence et défaut, plus les boutons
**Allumer / Éteindre** et **Actualiser**. Son réglage choisit la pompe (la première par défaut).

## Dépannage

- **Connexion refusée** — vérifiez l'e-mail et le mot de passe dans l'application. Un compte créé
  avec l'application 1.5.8 ou plus ancienne demande le type **Aqua Temp (appli 1.5.8 ou plus
  ancienne)**.
- **L'application me déconnecte / Gladys perd la connexion** — utilisez un second compte (voir
  l'astuce plus haut).
- **Certificat refusé** — le cloud Aqua Temp a déjà servi des certificats que d'autres clients
  devaient ignorer. Si le test de connexion le signale, désactivez **Vérifier le certificat du
  cloud**. L'empreinte de votre mot de passe circule alors sans preuve de l'identité du serveur :
  réactivez dès que possible.
- **Les valeurs ne bougent pas** — le cloud ne connaît que ce que la pompe envoie ; vérifiez que
  l'application affiche aussi des valeurs fraîches.

L'API du cloud Aqua Temp n'est pas publique : cette intégration la parle comme l'application, et
un changement côté Aqua Temp peut la casser. Signalez les problèmes sur
[GitHub](https://github.com/prohand/gladys-aquatemp/issues).
