// -----------------------------------------------------------------------------
// Scene triggers (Gladys 5.1+): what a heat pump can make happen in a scene.
//
// Fired by src/aquatemp/fleet.js with `gladys.publishSceneEvent`, once per
// transition: a fault raised, a fault cleared, a heat pump the cloud lost or
// found again. The event data is flat: `device` (the Gladys device external
// id, what the scene author filters on), `device_name`, and the details of the
// trigger. Only the keys declared in the manifest reach the scene.
// -----------------------------------------------------------------------------

/** Trigger keys, as declared in the manifest. Never renamed: scenes store them. */
export const SCENE_TRIGGERS = {
  FAULT_DETECTED: 'fault_detected',
  FAULT_CLEARED: 'fault_cleared',
  CONNECTION_CHANGED: 'connection_changed',
};

/** Values of the `status` of a connection_changed event. */
export const CONNECTION_STATUSES = ['online', 'offline'];
