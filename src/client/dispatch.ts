// Dispatch client module
// Handles dispatch notifications, blips, and UI integration
import Config from '@common/config';
import { DebugLog } from '@common/index';
import { cache, triggerServerCallback } from '@communityox/ox_lib/client';
import type {
  DispatchCall,
  DispatchUnit,
  DispatchBlipConfig,
  DispatchCallsResponse,
  DispatchApiResponse,
  Vector3,
} from '@common/types';

// Skip if dispatch is disabled
const DispatchConfig = Config.Dispatch;
if (!DispatchConfig?.Enabled) {
  console.log('^3[MDT] Dispatch module is disabled in config^0');
}

// ==========================================
// State Variables
// ==========================================

interface BlipData {
  blip: number;
  radius: number;
  callId: string;
  createdAt: number;
  alertTime: number;
  flashInterval?: ReturnType<typeof setInterval>;
}

const activeBlips: Map<string, BlipData> = new Map();
let alertsMuted = false;
let alertsDisabled = false;
let dispatchHidden = false;
let lastPingTime = 0;
let lastPanicTime = 0;
const PING_COOLDOWN = 5000; // 5 seconds
const PANIC_COOLDOWN = 5000; // 5 seconds

// Native audio state
let nativeAudioLoaded = false;

// Postals data
interface Postal {
  code: string;
  x: number;
  y: number;
}
let postalsData: Postal[] = [];

// Load postals from file
try {
  const postalsJson = LoadResourceFile(cache.resource, 'static/postals.json');
  if (postalsJson) {
    postalsData = JSON.parse(postalsJson);
    console.log(`^2[MDT Dispatch] Loaded ${postalsData.length} postals^0`);
  }
} catch (e) {
  console.error('^1[MDT Dispatch] Failed to load postals.json^0', e);
}

// Player data cache
let playerData: {
  citizenid: string;
  charinfo: { firstname: string; lastname: string };
  metadata: { callsign?: string };
  job: { type: string; name: string; label: string; onduty: boolean };
} | null = null;

// ==========================================
// Helper Functions
// ==========================================

function updatePlayerData(): void {
  const pd = exports.qbx_core.GetPlayerData();
  if (pd) {
    playerData = {
      citizenid: pd.citizenid,
      charinfo: {
        firstname: pd.charinfo?.firstname || 'Unknown',
        lastname: pd.charinfo?.lastname || 'Unknown',
      },
      metadata: {
        callsign: pd.metadata?.callsign,
      },
      job: {
        type: pd.job?.type || '',
        name: pd.job?.name || '',
        label: pd.job?.label || '',
        onduty: pd.job?.onduty || false,
      },
    };
  }
}

function isOnDuty(): boolean {
  updatePlayerData();
  if (!playerData) return false;

  if (DispatchConfig?.OnDutyOnly) {
    return playerData.job.onduty;
  }

  return true;
}

function isJobValid(jobs?: string[]): boolean {
  if (!playerData) {
    updatePlayerData();
  }
  if (!playerData) return false;

  const allowedJobs = jobs || DispatchConfig?.Jobs || [];
  return allowedJobs.includes(playerData.job.type) || allowedJobs.includes(playerData.job.name);
}

function capitalizeString(str: string): string {
  if (!str) return str;

  const lowercaseWords = [
    'of', 'the', 'and', 'or', 'nor', 'but', 'a', 'an', 'as', 'at',
    'by', 'for', 'in', 'on', 'to', 'up', 'de', 'la', 'del', 'san',
  ];

  const words = str.split(' ');

  return words
    .map((word, index) => {
      const lowerWord = word.toLowerCase();
      if (index > 0 && lowercaseWords.includes(lowerWord)) {
        return lowerWord;
      }
      return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
    })
    .join(' ');
}

function getClosestPostal(coords: Vector3): string | null {
  if (postalsData.length === 0) return null;

  let closestPostal: Postal | null = null;
  let closestDistance = Infinity;

  for (const postal of postalsData) {
    const dx = coords.x - postal.x;
    const dy = coords.y - postal.y;
    const distance = dx * dx + dy * dy; // No need for sqrt, just comparing

    if (distance < closestDistance) {
      closestDistance = distance;
      closestPostal = postal;
    }
  }

  return closestPostal?.code || null;
}

function getStreetAndZone(coords: Vector3): string {
  const [street1, street2] = GetStreetNameAtCoord(coords.x, coords.y, coords.z);
  let streetName = capitalizeString(GetStreetNameFromHashKey(street1));

  if (street2 !== 0) {
    const crossStreet = capitalizeString(GetStreetNameFromHashKey(street2));
    streetName = `${streetName} & ${crossStreet}`;
  }

  // Get postal code from our postals.json
  const postalCode = getClosestPostal(coords);
  if (postalCode) {
    streetName = `${streetName} (${postalCode})`;
  }

  return streetName;
}

function getVehicleColor(colorId: number): string {
  const colors = DispatchConfig?.VehicleColors || {};
  return colors[String(colorId)] || 'Unknown';
}

function getVehicleData(vehicle: number): {
  name: string;
  plate: string;
  color: string;
  class: string;
  doors: number;
} {
  if (!vehicle || !DoesEntityExist(vehicle)) {
    return { name: 'Unknown', plate: 'Unknown', color: 'Unknown', class: 'Unknown', doors: 0 };
  }

  const hash = GetEntityModel(vehicle);
  const displayName = GetDisplayNameFromVehicleModel(hash);
  const name = GetLabelText(displayName) || displayName || 'Unknown';
  const plate = GetVehicleNumberPlateText(vehicle) || 'Unknown';
  const [primaryColor] = GetVehicleColours(vehicle);
  const color = getVehicleColor(primaryColor);
  const vehicleClass = GetVehicleClass(vehicle);
  const doors = GetNumberOfVehicleDoors(vehicle);

  const classNames: Record<number, string> = {
    0: 'Compact', 1: 'Sedan', 2: 'SUV', 3: 'Coupe', 4: 'Muscle',
    5: 'Sports Classic', 6: 'Sports', 7: 'Super', 8: 'Motorcycle',
    9: 'Off-road', 10: 'Industrial', 11: 'Utility', 12: 'Van',
    13: 'Cycle', 14: 'Boat', 15: 'Helicopter', 16: 'Plane',
    17: 'Service', 18: 'Emergency', 19: 'Military', 20: 'Commercial',
    21: 'Rail', 22: 'Open Wheel',
  };

  return {
    name,
    plate: plate.trim(),
    color,
    class: classNames[vehicleClass] || 'Unknown',
    doors,
  };
}

function getPlayerGender(): string {
  const ped = PlayerPedId();
  const model = GetEntityModel(ped);

  if (model === GetHashKey('mp_m_freemode_01')) {
    return 'Male';
  } else if (model === GetHashKey('mp_f_freemode_01')) {
    return 'Female';
  }

  return 'Unknown';
}

function getPlayerHeading(): number {
  return GetEntityHeading(PlayerPedId());
}

// ==========================================
// Blip Management
// ==========================================

function createBlip(call: DispatchCall): void {
  if (activeBlips.has(call.callId)) {
    return; // Blip already exists
  }

  const blipConfig = call.blip;
  let coords = call.coords;

  // Apply offset if configured
  if (blipConfig.offset) {
    const offset = Math.random() * (DispatchConfig?.MaxOffset || 120);
    const angle = Math.random() * Math.PI * 2;
    coords = {
      x: coords.x + Math.cos(angle) * offset,
      y: coords.y + Math.sin(angle) * offset,
      z: coords.z,
    };
  }

  // Create main blip
  const blip = AddBlipForCoord(coords.x, coords.y, coords.z);
  SetBlipSprite(blip, blipConfig.sprite || 161);
  SetBlipColour(blip, blipConfig.color || 1);
  SetBlipScale(blip, blipConfig.scale || 1.0);
  SetBlipHighDetail(blip, true);
  SetBlipCategory(blip, 2);
  SetBlipAlpha(blip, 255);

  if (blipConfig.flash) {
    SetBlipFlashes(blip, true);
  }

  BeginTextCommandSetBlipName('STRING');
  AddTextComponentString(`${call.code} - ${call.message}`);
  EndTextCommandSetBlipName(blip);

  // Create radius blip if configured
  let radiusBlip = 0;
  if (blipConfig.radius > 0) {
    radiusBlip = AddBlipForRadius(coords.x, coords.y, coords.z, blipConfig.radius);
    SetBlipColour(radiusBlip, blipConfig.color || 1);
    SetBlipAlpha(radiusBlip, 128);
  }

  // Flash radius blip between blue and red for panic calls
  let flashInterval: ReturnType<typeof setInterval> | undefined;
  if (call.codeName === 'emergencyButton' && radiusBlip !== 0) {
    let isRed = false;
    flashInterval = setInterval(() => {
      if (!DoesBlipExist(radiusBlip)) {
        clearInterval(flashInterval);
        return;
      }
      isRed = !isRed;
      SetBlipColour(radiusBlip, isRed ? 1 : 3); // 1 = red, 3 = blue
    }, 500);
  }

  activeBlips.set(call.callId, {
    blip,
    radius: radiusBlip,
    callId: call.callId,
    createdAt: Date.now(),
    alertTime: call.alertTime * 1000,
    flashInterval,
  });

  // Play sound if not muted (use original coords for 3D positional audio, not offset blip coords)
  if (!alertsMuted) {
    playAlertSound(blipConfig.sound, blipConfig.sound2, call.coords);
  }

  if (DispatchConfig?.Debug) {
    console.log(`[MDT Dispatch] Created blip for call: ${call.callId}`);
  }
}

function removeBlip(callId: string): void {
  const blipData = activeBlips.get(callId);
  if (!blipData) return;

  if (blipData.flashInterval) {
    clearInterval(blipData.flashInterval);
  }

  if (DoesBlipExist(blipData.blip)) {
    RemoveBlip(blipData.blip);
  }

  if (blipData.radius && DoesBlipExist(blipData.radius)) {
    RemoveBlip(blipData.radius);
  }

  activeBlips.delete(callId);

  if (DispatchConfig?.Debug) {
    console.log(`[MDT Dispatch] Removed blip for call: ${callId}`);
  }
}

function updateBlipOpacity(callId: string, opacity: number): void {
  const blipData = activeBlips.get(callId);
  if (!blipData) return;

  if (DoesBlipExist(blipData.blip)) {
    SetBlipAlpha(blipData.blip, opacity);
  }

  if (blipData.radius && DoesBlipExist(blipData.radius)) {
    SetBlipAlpha(blipData.radius, Math.floor(opacity * 0.5));
  }
}

function clearAllBlips(): void {
  for (const [callId] of activeBlips) {
    removeBlip(callId);
  }
  activeBlips.clear();
}

function playAlertSound(sound?: string, sound2?: string, coords?: Vector3): void {
  if (!sound) return;

  // Native 3D positional audio for custom sounds
  if (nativeAudioLoaded && coords && (sound === 'notification' || sound === 'panic_sound')) {
    PlaySoundFromCoord(-1, sound, coords.x, coords.y, coords.z, 'mdt_soundset', false, 200.0, false);
    return;
  }

  // Fallback: Custom WAV sounds played via NUI (non-positional)
  if (sound === 'notification' || sound === 'panic_sound') {
    SendNUIMessage({
      action: 'playSound',
      data: { file: `${sound}.wav`, volume: 0.5 },
    });
    return;
  }

  if (sound === 'Lose_1st' && sound2) {
    PlaySound(-1, sound, sound2, false, 0, true);
  } else if (GetResourceState('interact-sound') === 'started') {
    emit('InteractSound_CL:PlayOnOne', sound, 0.25);
  } else {
    // Fallback to FiveM native sound
    PlaySound(-1, 'RADAR_BLIP', 'EPSILONISM_08_SOUNDSET', false, 0, true);
  }
}

// ==========================================
// Dispatch Notifications
// ==========================================

onNet('mdt:dispatch:notify', (call: DispatchCall) => {
  if (!DispatchConfig?.Enabled) return;
  if (alertsDisabled || dispatchHidden) return;
  if (!isJobValid(call.jobs)) return;
  if (!isOnDuty()) return;

  // Create blip
  createBlip(call);

  // Send to NUI
  SendNUIMessage({
    action: 'dispatch:newCall',
    data: {
      call,
      timer: call.alertTime * 1000,
    },
  });

  if (DispatchConfig?.Debug) {
    console.log(`[MDT Dispatch] Received call: ${call.callId} - ${call.message}`);
  }
});

onNet('mdt:dispatch:callsExpired', (callIds: string[]) => {
  for (const callId of callIds) {
    removeBlip(callId);
  }

  SendNUIMessage({
    action: 'dispatch:callsExpired',
    data: callIds,
  });
});

onNet('mdt:dispatch:updateOpacity', (fadingData: { callId: string; opacity: number }[]) => {
  for (const { callId, opacity } of fadingData) {
    updateBlipOpacity(callId, opacity);
  }
});

onNet('mdt:dispatch:unitAttached', (data: { callId: string; unit: DispatchUnit }) => {
  SendNUIMessage({
    action: 'dispatch:unitAttached',
    data,
  });
});

onNet('mdt:dispatch:unitDetached', (data: { callId: string; citizenid: string }) => {
  SendNUIMessage({
    action: 'dispatch:unitDetached',
    data,
  });
});

// ==========================================
// NUI Callbacks
// ==========================================

RegisterNuiCallback('dispatch:getCalls', async (_data: unknown, cb: (data: DispatchCallsResponse) => void) => {
  const result = await triggerServerCallback<DispatchCallsResponse>('mdt:dispatch:getCalls', 0);
  cb(result || { calls: [], canRespond: false });
});

RegisterNuiCallback('dispatch:attachUnit', async (data: { callId: string }, cb: (data: DispatchApiResponse) => void) => {
  const result = await triggerServerCallback<DispatchApiResponse>('mdt:dispatch:attachUnit', 0, data);

  // Set waypoint to call location
  if (result?.success) {
    const calls = await triggerServerCallback<DispatchCallsResponse>('mdt:dispatch:getCalls', 0);
    const call = calls?.calls.find(c => c.callId === data.callId);
    if (call) {
      SetNewWaypoint(call.coords.x, call.coords.y);
    }
  }

  cb(result || { success: false, message: 'Failed to attach' });
});

RegisterNuiCallback('dispatch:detachUnit', async (data: { callId: string }, cb: (data: DispatchApiResponse) => void) => {
  const result = await triggerServerCallback<DispatchApiResponse>('mdt:dispatch:detachUnit', 0, data);
  cb(result || { success: false, message: 'Failed to detach' });
});

RegisterNuiCallback('dispatch:respondToCall', async (data: { callId: string; coords: Vector3 }, cb: (data: { success: boolean }) => void) => {
  if (!isJobValid() || !isOnDuty()) {
    cb({ success: false });
    return;
  }

  SetNewWaypoint(data.coords.x, data.coords.y);

  // Attach to call
  await triggerServerCallback<DispatchApiResponse>('mdt:dispatch:attachUnit', 0, { callId: data.callId });

  cb({ success: true });
});

RegisterNuiCallback('dispatch:detachFromCall', async (data: { callId: string }, cb: (data: { success: boolean }) => void) => {
  if (!isJobValid() || !isOnDuty()) {
    cb({ success: false });
    return;
  }

  // Detach from call
  await triggerServerCallback<DispatchApiResponse>('mdt:dispatch:detachUnit', 0, { callId: data.callId });

  cb({ success: true });
});

RegisterNuiCallback('dispatch:clearBlips', (_data: unknown, cb: (data: { success: boolean }) => void) => {
  clearAllBlips();
  DeleteWaypoint();
  cb({ success: true });
});

RegisterNuiCallback('dispatch:toggleMute', (data: { muted: boolean }, cb: (data: { success: boolean }) => void) => {
  alertsMuted = data.muted;
  cb({ success: true });
});

RegisterNuiCallback('dispatch:toggleAlerts', (data: { disabled: boolean }, cb: (data: { success: boolean }) => void) => {
  alertsDisabled = data.disabled;
  cb({ success: true });
});

// ==========================================
// Dispatch Menu
// ==========================================

onNet('mdt:dispatch:openMenu', async () => {
  if (!DispatchConfig?.Enabled) return;
  if (!isJobValid()) return;
  if (!isOnDuty()) return;

  const result = await triggerServerCallback<DispatchCallsResponse>('mdt:dispatch:getCalls', 0);

  if (!result || result.calls.length === 0) {
    exports.ox_lib.notify({
      description: 'No active dispatch calls',
      type: 'error',
      position: 'top',
    });
    return;
  }

  SendNUIMessage({
    action: 'dispatch:openMenu',
    data: result.calls,
  });

  SetNuiFocus(true, true);
});

// ==========================================
// Officer Ping
// ==========================================

function sendOfficerPing(): void {
  if (!DispatchConfig?.Enabled) return;

  const currentTime = GetGameTimer();
  if (currentTime - lastPingTime < PING_COOLDOWN) {
    const remaining = Math.ceil((PING_COOLDOWN - (currentTime - lastPingTime)) / 1000);
    exports.ox_lib.notify({
      description: `Ping cooldown active. Wait ${remaining} seconds.`,
      type: 'error',
      position: 'top',
    });
    return;
  }

  if (!isJobValid()) return;
  if (!isOnDuty()) return;

  lastPingTime = currentTime;
  updatePlayerData();

  const ped = PlayerPedId();
  const coords = GetEntityCoords(ped, true);
  const street = getStreetAndZone({ x: coords[0], y: coords[1], z: coords[2] });

  // Determine department based on job
  let department = 'LSPD';
  let blipColor = 38;

  if (playerData?.job.name) {
    const jobName = playerData.job.name.toLowerCase();
    if (jobName.includes('bcso') || jobName.includes('sheriff')) {
      department = 'BCSO';
      blipColor = 25;
    } else if (jobName.includes('sasp') || jobName.includes('state')) {
      department = 'SASP';
      blipColor = 5;
    } else if (jobName.includes('dhs')) {
      department = 'DHS';
      blipColor = 54;
    } else if (jobName.includes('ems') || jobName.includes('ambulance')) {
      department = 'EMS';
      blipColor = 1;
    }
  }

  const callsign = playerData?.metadata.callsign || 'Unknown';
  const firstName = playerData?.charinfo.firstname || 'Unknown';
  const lastName = playerData?.charinfo.lastname || 'Officer';
  const firstInitial = firstName.charAt(0).toUpperCase();

  emitNet('mdt:dispatch:notify', {
    message: `${department} Ping`,
    codeName: 'officerping',
    code: '',
    icon: 'fas fa-radio',
    priority: 2,
    coords: { x: coords[0], y: coords[1], z: coords[2] },
    street,
    information: `${callsign} ${firstInitial}. ${lastName} has set a ping to their location`,
    alertTime: 150,
    jobs: ['leo'],
    alert: {
      sprite: 280,
      color: blipColor,
      scale: 1.2,
      length: 2.5,
      sound: 'notification',
      flash: true,
      radius: 0,
      offset: false,
    },
  });
}

// ==========================================
// Emergency Button (Panic)
// ==========================================

function sendPanicButton(): void {
  if (!DispatchConfig?.Enabled) return;

  const currentTime = GetGameTimer();
  if (currentTime - lastPanicTime < PANIC_COOLDOWN) {
    const remaining = Math.ceil((PANIC_COOLDOWN - (currentTime - lastPanicTime)) / 1000);
    exports.ox_lib.notify({
      description: `Panic cooldown active. Wait ${remaining} seconds.`,
      type: 'error',
      position: 'top',
    });
    return;
  }

  if (!isJobValid()) return;
  if (!isOnDuty()) return;

  lastPanicTime = currentTime;
  updatePlayerData();

  const ped = PlayerPedId();
  const coords = GetEntityCoords(ped, true);
  const street = getStreetAndZone({ x: coords[0], y: coords[1], z: coords[2] });

  let department = 'LSPD';
  let blipColor = 38;

  if (playerData?.job.name) {
    const jobName = playerData.job.name.toLowerCase();
    if (jobName.includes('bcso') || jobName.includes('sheriff')) {
      department = 'BCSO';
      blipColor = 25;
    } else if (jobName.includes('sasp') || jobName.includes('state')) {
      department = 'SASP';
      blipColor = 5;
    } else if (jobName.includes('dhs')) {
      department = 'DHS';
      blipColor = 54;
    } else if (jobName.includes('ems') || jobName.includes('ambulance')) {
      department = 'EMS';
      blipColor = 1;
    }
  }

  const callsign = playerData?.metadata.callsign || 'Unknown';
  const firstName = playerData?.charinfo.firstname || 'Unknown';
  const lastName = playerData?.charinfo.lastname || 'Officer';
  const firstInitial = firstName.charAt(0).toUpperCase();

  emitNet('mdt:dispatch:notify', {
    message: `${department} Panic`,
    codeName: 'emergencyButton',
    code: '',
    icon: 'fas fa-skull-crossbones',
    priority: 1,
    coords: { x: coords[0], y: coords[1], z: coords[2] },
    street,
    information: `${callsign} ${firstInitial}. ${lastName} has pressed their Panic Button`,
    alertTime: 150,
    jobs: ['leo', 'ems'],
    alert: {
      sprite: 161,
      color: blipColor,
      scale: 2.0,
      length: 2.5,
      sound: 'panic_sound',
      flash: true,
      radius: 30.0,
      offset: false,
    },
  });
}

// ==========================================
// Emergency Calls (911/311)
// ==========================================

onNet('mdt:dispatch:sendEmergencyCall', (data: { message: string; type: '911' | '311'; anonymous: boolean }) => {
  emit('mdt:dispatch:emergencyCall', data);
});

// ==========================================
// Keybinds
// ==========================================

if (DispatchConfig?.Enabled) {
  // Default keybinds with fallbacks for each key
  const defaultKeybinds = {
    Respond: 'G',
    OpenMenu: 'J',
    NavigateLeft: 'LEFT',
    NavigateRight: 'RIGHT',
    Ping: 'F10',
  };

  const keybinds = {
    Respond: DispatchConfig.Keybinds?.Respond || defaultKeybinds.Respond,
    OpenMenu: DispatchConfig.Keybinds?.OpenMenu || defaultKeybinds.OpenMenu,
    NavigateLeft: DispatchConfig.Keybinds?.NavigateLeft || defaultKeybinds.NavigateLeft,
    NavigateRight: DispatchConfig.Keybinds?.NavigateRight || defaultKeybinds.NavigateRight,
    Ping: DispatchConfig.Keybinds?.Ping || defaultKeybinds.Ping,
  };

  // Respond to current call
  RegisterCommand('dispatch_respond', () => {
    if (!isJobValid() || !isOnDuty()) return;
    SendNUIMessage({ action: 'dispatch:getCurrentCall' });
  }, false);
  RegisterKeyMapping('dispatch_respond', 'Set waypoint to current call', 'keyboard', keybinds.Respond);

  // Open dispatch menu
  RegisterCommand('dispatch_menu', () => {
    if (!isJobValid() || !isOnDuty()) return;
    emitNet('mdt:dispatch:openMenu');
  }, false);
  RegisterKeyMapping('dispatch_menu', 'Open Dispatch Menu', 'keyboard', keybinds.OpenMenu);

  // Navigate previous call
  RegisterCommand('dispatch_prev', () => {
    if (!isJobValid() || !isOnDuty()) return;
    SendNUIMessage({ action: 'dispatch:navigatePrevious' });
  }, false);
  RegisterKeyMapping('dispatch_prev', 'Navigate to previous call', 'keyboard', keybinds.NavigateLeft);

  // Navigate next call
  RegisterCommand('dispatch_next', () => {
    if (!isJobValid() || !isOnDuty()) return;
    SendNUIMessage({ action: 'dispatch:navigateNext' });
  }, false);
  RegisterKeyMapping('dispatch_next', 'Navigate to next call', 'keyboard', keybinds.NavigateRight);

  // Officer ping
  RegisterCommand('dispatch_ping', sendOfficerPing, false);
  RegisterKeyMapping('dispatch_ping', 'Send officer ping', 'keyboard', keybinds.Ping);

  // Other commands
  RegisterCommand('ping', sendOfficerPing, false);
  RegisterCommand('panic', sendPanicButton, false);
  RegisterCommand('hidedispatch', () => {
    dispatchHidden = !dispatchHidden;
    SendNUIMessage({ action: 'dispatch:setHidden', data: dispatchHidden });
    exports.qbx_core.Notify(`Dispatch alerts ${dispatchHidden ? 'hidden' : 'shown'}`, dispatchHidden ? 'error' : 'success');
  }, false);
}

// ==========================================
// Event Handlers
// ==========================================

// Send setup data to NUI
function sendSetupToNUI(): void {
  updatePlayerData();
  if (playerData) {
    const keybind = DispatchConfig?.Keybinds?.Respond || 'G';
    SendNUIMessage({
      action: 'dispatch:setupUI',
      data: {
        keybind,
        citizenid: playerData.citizenid,
      },
    });
  }
}

// Update player data on job change
onNet('QBCore:Client:OnJobUpdate', () => {
  updatePlayerData();
  sendSetupToNUI();
});

onNet('QBCore:Player:SetPlayerData', (pd: unknown) => {
  if (pd && typeof pd === 'object') {
    updatePlayerData();
    sendSetupToNUI();
  }
});

onNet('QBCore:Client:OnPlayerLoaded', () => {
  updatePlayerData();
  sendSetupToNUI();
});

// Clean up on resource stop
on('onResourceStop', (resourceName: string) => {
  if (resourceName === cache.resource) {
    clearAllBlips();
    if (nativeAudioLoaded) {
      ReleaseScriptAudioBank();
      nativeAudioLoaded = false;
    }
  }
});

// Export alert functions for other resources
if (DispatchConfig?.Enabled) {
  exports('sendOfficerPing', sendOfficerPing);
  exports('sendPanicButton', sendPanicButton);
  exports('getStreetAndZone', getStreetAndZone);
  exports('getVehicleData', getVehicleData);
  exports('getPlayerGender', getPlayerGender);
  exports('getPlayerHeading', getPlayerHeading);

  // Load native audio bank for 3D positional dispatch sounds
  const bankLoaded = RequestScriptAudioBank('audiodirectory/mdt_sounds', false);
  if (bankLoaded) {
    nativeAudioLoaded = true;
    console.log('^2[MDT Dispatch] Native audio bank loaded (mdt_soundset)^0');
  } else {
    console.log('^3[MDT Dispatch] Native audio bank not available, using NUI sound fallback^0');
  }

  // Send setup to NUI on resource start (for players already logged in)
  setTimeout(() => {
    sendSetupToNUI();
  }, 1000);

  console.log('^2[MDT] Dispatch client module initialized^0');
}

export {
  sendOfficerPing,
  sendPanicButton,
  getStreetAndZone,
  getVehicleData,
  getPlayerGender,
  getPlayerHeading,
  isOnDuty,
  isJobValid,
};
