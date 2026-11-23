# Aqua Temp

Controle sus bombas de calor **Aqua Temp** desde Gladys: bombas de calor de piscina (Phnix y las
muchas marcas construidas sobre el mismo controlador) y calentadores de agua **Hi Temp**, a
través de la nube Aqua Temp — la misma que usa la aplicación móvil Aqua Temp.

## Antes de empezar

- Una bomba de calor que ya funciona en la aplicación **Aqua Temp** (wifi configurado, visible en
  la aplicación).
- El correo electrónico y la contraseña de la cuenta Aqua Temp.
- Gladys 5.3 o posterior.

> **Consejo: use una segunda cuenta.** La aplicación Aqua Temp solo mantiene **una sesión por
> cuenta**: cuando Gladys inicia sesión, la aplicación puede cerrar la suya (y al revés). Cree una
> segunda cuenta Aqua Temp, comparta con ella su bomba desde la aplicación (_Dispositivo →
> Compartir_), acepte el uso compartido e introduzca **esa** cuenta en Gladys. Las bombas
> compartidas se encuentran igual que las propias.

## Configuración

Abra **Integraciones → Aqua Temp → Configuración**:

| Campo                               | Qué introducir                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Correo electrónico                  | El correo de la cuenta Aqua Temp.                                                                      |
| Contraseña                          | Su contraseña. Solo su huella MD5 se envía a la nube, como hace la aplicación.                         |
| Tipo de cuenta                      | **Aqua Temp** (por defecto), **Hi Temp** o **Aqua Temp (app 1.5.8 o anterior)** para cuentas antiguas. |
| Intervalo de actualización (s)      | Cada cuánto se lee cada bomba, de 60 a 3600 segundos (60 por defecto).                                 |
| Comprobar el certificado de la nube | Déjelo activado (vea _Solución de problemas_).                                                         |

Pulse **Probar la conexión**: la respuesta enumera las bombas encontradas. Abra después la
pestaña **Descubrir** y añada a Gladys las bombas que desee.

## Qué obtiene

Cada bomba de calor es un dispositivo de Gladys:

| Función                        | Tipo                                 | Controlable |
| ------------------------------ | ------------------------------------ | ----------- |
| Encendido / apagado            | Aire acondicionado encendido/apagado | Sí          |
| Modo                           | Refrigeración / calefacción / auto   | Sí          |
| Temperatura de consigna        | Consigna, °C                         | Sí          |
| Modo silencio                  | Interruptor (modo de bajo ruido)     | Sí          |
| Temperatura del agua (entrada) | Sensor de temperatura                | No          |
| Temperatura del agua (salida)  | Sensor de temperatura                | No          |
| Temperatura exterior           | Sensor de temperatura                | No          |

Los calentadores Hi Temp no tienen modo ni modo silencio: solo encendido, consigna y
temperaturas.

La consigna se escribe para el **modo actual** (calefacción, refrigeración y auto tienen cada uno
la suya) y se mantiene dentro del rango que acepta la bomba. La insignia de cada dispositivo indica
**nube**, o **inaccesible** cuando la nube Aqua Temp ha perdido la bomba.

## Escenas

**Disparadores** (categoría _Integraciones_ del selector de disparadores):

- **Una bomba de calor indica una avería** — variables: nombre de la bomba, texto de la avería.
- **Se resuelve la avería de una bomba de calor**.
- **Una bomba de calor se conecta o se desconecta** — filtro por estado; variables: nombre,
  estado.

Una avería ya presente al arrancar la integración se aprende, no se vuelve a disparar.

**Acciones**:

- **Cambiar el modo de la bomba de calor** — apagada, calefacción, refrigeración o automático
  (enciende la bomba si hace falta).
- **Ajustar el modo silencio** — activado o no. La salida `applied` es falsa en una bomba sin
  modo silencio.
- **Leer el estado de la bomba de calor** — lectura reciente; salidas: `online`, `power`, `mode`,
  `water_temperature`, `target_temperature`, `in_fault`, `fault`. Úselas en las condiciones
  siguientes (p. ej. _agua por debajo de 26 °C_).

## Widget del panel

Añada el widget **Bomba de calor** a un panel: temperatura del agua, consigna y temperatura
exterior (en directo), estado de la nube, modo, modo silencio y avería, además de los botones
**Encender / Apagar** y **Actualizar**. Su ajuste elige la bomba (la primera por defecto).

## Solución de problemas

- **Inicio de sesión rechazado** — compruebe el correo y la contraseña en la aplicación. Una
  cuenta creada con la aplicación 1.5.8 o anterior necesita el tipo **Aqua Temp (app 1.5.8 o
  anterior)**.
- **La aplicación cierra mi sesión / Gladys pierde la conexión** — use una segunda cuenta (vea el
  consejo anterior).
- **Certificado rechazado** — la nube Aqua Temp ya ha servido certificados que otros clientes
  tenían que ignorar. Si la prueba de conexión lo indica, desactive **Comprobar el certificado de
  la nube**. La huella de su contraseña viaja entonces sin prueba de la identidad del servidor:
  vuelva a activarlo en cuanto pueda.
- **Los valores no cambian** — la nube solo conoce lo que envía la bomba; compruebe que la
  aplicación también muestra valores recientes.

La API de la nube Aqua Temp no es pública: esta integración la habla como la aplicación, y un
cambio por parte de Aqua Temp puede romperla. Informe de los problemas en
[GitHub](https://github.com/prohand/gladys-aquatemp/issues).
