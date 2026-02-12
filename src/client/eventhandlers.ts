// GTA Event Handlers for Dispatch Alerts
// Listens for GTA/FiveM events (gunshots, melee, theft, explosions, etc.)
// and triggers the appropriate dispatch alert functions
import Config from '@common/config';
import {
  Shooting,
  VehicleShooting,
  Hunting,
  OfficerDown,
  EmsDown,
  InjuriedPerson,
  VehicleTheft,
  CarJacking,
  Explosion,
} from './alerts';

// Skip if dispatch is disabled
const DispatchConfig = Config.Dispatch;
if (!DispatchConfig?.Enabled) {
  console.log('^3[MDT] Event handlers disabled - dispatch not enabled^0');
}

// ==========================================
// State Variables
// ==========================================

// Timer tracking to prevent spam
const timers: Map<string, boolean> = new Map();

// Explosion tracking
let lastExplosionTime = 0;
let lastExplosionCoords: { x: number; y: number; z: number } | null = null;
const EXPLOSION_RADIUS = 100.0;
const EXPLOSION_COOLDOWN = 30000;

// Zone tracking
let inHuntingZone = false;
let inNoDispatchZone = false;

// ==========================================
// Helper Functions
// ==========================================

function waitTimer(name: string, action: () => void): void {
  if (!DispatchConfig?.DefaultAlerts) return;

  const alertsEnabled = DispatchConfig.DefaultAlerts as Record<string, boolean>;
  if (!alertsEnabled[name]) return;

  if (timers.get(name)) return;

  timers.set(name, true);
  action();

  // Clear timer after delay
  setTimeout(() => {
    timers.set(name, false);
  }, (DispatchConfig.DefaultAlertsDelay || 5) * 1000);
}

function isPlayerOnDuty(): boolean {
  const playerData = exports.qbx_core.GetPlayerData();
  return playerData?.job?.onduty ?? false;
}

function isPlayerLEO(): boolean {
  const playerData = exports.qbx_core.GetPlayerData();
  return playerData?.job?.type === 'leo';
}

function isPlayerEMS(): boolean {
  const playerData = exports.qbx_core.GetPlayerData();
  return playerData?.job?.type === 'ems';
}

function isWeaponBlacklisted(ped: number): boolean {
  const whitelist = DispatchConfig?.WeaponWhitelist || [];
  const currentWeapon = GetSelectedPedWeapon(ped);

  for (const weaponName of whitelist) {
    if (currentWeapon === GetHashKey(weaponName)) {
      return true; // Weapon is whitelisted (suppress alert)
    }
  }

  return false;
}

function isPedAWitness(witnesses: number[], ped: number): boolean {
  return witnesses.includes(ped);
}

// ==========================================
// Zone Management
// ==========================================

function setupZones(): void {
  if (!DispatchConfig?.Enabled) return;

  const locations = DispatchConfig.Locations;

  // Check if ox_lib zones are available (they may be Lua-only)
  try {
    if (!exports.ox_lib?.zones) {
      console.log('^3[MDT Dispatch] ox_lib zones not available - zone features disabled^0');
      return;
    }
  } catch {
    console.log('^3[MDT Dispatch] ox_lib zones not available - zone features disabled^0');
    return;
  }

  // Setup hunting zones
  if (locations?.HuntingZones) {
    for (const [name, zone] of Object.entries(locations.HuntingZones)) {
      if (zone.coords && zone.radius) {
        try {
          exports.ox_lib.zones.sphere({
            coords: zone.coords,
            radius: zone.radius,
            debug: DispatchConfig.Debug,
            onEnter: () => {
              inHuntingZone = true;
              if (DispatchConfig.Debug) {
                console.log('[MDT Dispatch] Entered hunting zone');
              }
            },
            onExit: () => {
              inHuntingZone = false;
              if (DispatchConfig.Debug) {
                console.log('[MDT Dispatch] Exited hunting zone');
              }
            },
          });
        } catch (e) {
          console.error(`[MDT Dispatch] Failed to create hunting zone ${name}:`, e);
        }
      }
    }
  }

  // Setup no dispatch zones
  if (locations?.NoDispatchZones) {
    for (const [name, zone] of Object.entries(locations.NoDispatchZones)) {
      if (zone.coords && zone.length && zone.width) {
        try {
          exports.ox_lib.zones.box({
            coords: zone.coords,
            size: { x: zone.length, y: zone.width, z: (zone.maxZ || 10) - (zone.minZ || 0) },
            rotation: zone.heading || 0,
            debug: DispatchConfig.Debug,
            onEnter: () => {
              inNoDispatchZone = true;
              if (DispatchConfig.Debug) {
                console.log('[MDT Dispatch] Entered no dispatch zone');
              }
            },
            onExit: () => {
              inNoDispatchZone = false;
              if (DispatchConfig.Debug) {
                console.log('[MDT Dispatch] Exited no dispatch zone');
              }
            },
          });
        } catch (e) {
          console.error(`[MDT Dispatch] Failed to create no dispatch zone ${name}:`, e);
        }
      }
    }
  }
}

// ==========================================
// Event Handlers
// ==========================================

if (DispatchConfig?.Enabled) {
  // Gunshot event
  AddEventHandler('CEventGunShot', (witnesses: number[], ped: number) => {
    const playerPed = PlayerPedId();

    // Check if it's our ped
    if (ped !== playerPed) return;

    // Check silencer
    if (IsPedCurrentWeaponSilenced(playerPed)) return;

    // Check no dispatch zone
    if (inNoDispatchZone) return;

    // Check weapon blacklist
    if (isWeaponBlacklisted(playerPed)) return;

    // Random chance (70%)
    if (Math.random() > 0.7) return;

    waitTimer('Shooting', () => {
      // LEO on duty check
      if (isPlayerLEO() && isPlayerOnDuty() && !DispatchConfig?.Debug) {
        return;
      }

      // Check witnesses
      if (witnesses && !isPedAWitness(witnesses, ped)) return;

      // Hunting zone check
      if (inHuntingZone) {
        Hunting();
        return;
      }

      // In vehicle or not
      const vehicle = GetVehiclePedIsIn(playerPed, false);
      if (vehicle && vehicle !== 0) {
        VehicleShooting();
      } else {
        Shooting();
      }
    });
  });

  // Player down event
  AddEventHandler('gameEventTriggered', (name: string, args: unknown[]) => {
    if (name !== 'CEventNetworkEntityDamage') return;

    const victim = args[0] as number;
    const isDead = args[5] === 1;

    if (!victim || victim !== PlayerPedId()) return;
    if (!isDead) return;

    waitTimer('PlayerDowned', () => {
      if (isPlayerLEO()) {
        OfficerDown();
      } else if (isPlayerEMS()) {
        EmsDown();
      } else {
        InjuriedPerson();
      }
    });
  });

  // Explosion heard event
  AddEventHandler('CEventExplosionHeard', (witnesses: number[], ped: number) => {
    const playerPed = PlayerPedId();

    if (witnesses && !isPedAWitness(witnesses, ped)) return;

    waitTimer('Explosion', () => {
      const currentTime = GetGameTimer();
      const coords = GetEntityCoords(playerPed, true);
      const currentCoords = { x: coords[0], y: coords[1], z: coords[2] };

      // Check cooldown
      if (currentTime - lastExplosionTime < EXPLOSION_COOLDOWN) {
        return;
      }

      // Check radius to prevent spam
      if (lastExplosionCoords) {
        const dx = currentCoords.x - lastExplosionCoords.x;
        const dy = currentCoords.y - lastExplosionCoords.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < EXPLOSION_RADIUS) {
          return;
        }
      }

      Explosion();
      lastExplosionTime = currentTime;
      lastExplosionCoords = currentCoords;
    });
  });

  // Vehicle jacking event
  AddEventHandler('CEventPedJackingMyVehicle', (_witnesses: unknown[], ped: number) => {
    const playerPed = PlayerPedId();

    if (ped !== playerPed) return;

    waitTimer('CarJacking', () => {
      const vehicle = GetVehiclePedIsUsing(ped, true);
      CarJacking(vehicle);
    });
  });

  // Vehicle alarm / theft event
  AddEventHandler('CEventShockingCarAlarm', (_witnesses: unknown[], ped: number) => {
    const playerPed = PlayerPedId();

    if (ped !== playerPed) return;

    waitTimer('Autotheft', () => {
      VehicleTheft();
    });
  });

  // Initialize zones when player loads
  onNet('QBCore:Client:OnPlayerLoaded', () => {
    setupZones();
  });

  // Setup on resource start if player already loaded
  on('onResourceStart', (resourceName: string) => {
    if (resourceName === GetCurrentResourceName()) {
      const playerData = exports.qbx_core.GetPlayerData();
      if (playerData) {
        setupZones();
      }
    }
  });

  console.log('^2[MDT] Dispatch event handlers initialized^0');
}
