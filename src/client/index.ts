import Config from '@common/config';
import { Greetings, DebugLog } from '@common/index';
import { cache, triggerServerCallback } from '@communityox/ox_lib/client';
import type { PlayerInfo, Officer } from '@common/types';

// Import dispatch modules
import './dispatch';
import './alerts';
import './eventhandlers';

Greetings();

// ==========================================
// State Variables
// ==========================================

let isMDTOpen = false;
let tabletObject: number | null = null;
let isPlayingAnimation = false;

// Animation config
const TabletAnim = Config.TabletAnimation || {
  Dictionary: 'amb@code_human_in_bus_passenger_idles@female@tablet@base',
  Name: 'base',
  PropModel: 'prop_cs_tablet',
  BoneIndex: 60309,
  Offset: { x: 0.03, y: 0.002, z: 0.0 },
  Rotation: { x: 10.0, y: 160.0, z: 0.0 },
  AnimationSpeed: 3.0,
  BlendOutSpeed: 1.0,
};

// ==========================================
// Helper Functions
// ==========================================

async function loadAnimDict(dict: string): Promise<boolean> {
  if (HasAnimDictLoaded(dict)) return true;

  RequestAnimDict(dict);
  let attempts = 0;
  while (!HasAnimDictLoaded(dict) && attempts < 100) {
    await new Promise(resolve => setTimeout(resolve, 10));
    attempts++;
  }

  return HasAnimDictLoaded(dict);
}

async function loadModel(model: string | number): Promise<boolean> {
  const hash = typeof model === 'string' ? GetHashKey(model) : model;
  if (HasModelLoaded(hash)) return true;

  RequestModel(hash);
  let attempts = 0;
  while (!HasModelLoaded(hash) && attempts < 100) {
    await new Promise(resolve => setTimeout(resolve, 10));
    attempts++;
  }

  return HasModelLoaded(hash);
}

function isPlayerLEO(): boolean {
  const playerData = exports.qbx_core.GetPlayerData();
  return playerData?.job?.type === 'leo' && playerData?.job?.onduty;
}

function getPlayerInfo(): PlayerInfo {
  const playerData = exports.qbx_core.GetPlayerData();
  if (!playerData) {
    return {
      name: 'Unknown',
      callsign: Config.Defaults.Callsign,
      department: 'Unknown',
      rank: 'Unknown',
      jobName: '',
      gradeLevel: 0,
    };
  }

  return {
    name: `${playerData.charinfo?.firstname || ''} ${playerData.charinfo?.lastname || ''}`,
    callsign: playerData.metadata?.callsign || Config.Defaults.Callsign,
    department: playerData.job?.label || 'Unknown',
    rank: playerData.job?.grade?.name || 'Unknown',
    jobName: playerData.job?.name || '',
    gradeLevel: playerData.job?.grade?.level || 0,
    citizenid: playerData.citizenid,
  };
}

// ==========================================
// Tablet Animation
// ==========================================

async function playTabletAnimation(): Promise<void> {
  if (isPlayingAnimation) return;
  isPlayingAnimation = true;

  const ped = PlayerPedId();

  // Load animation dictionary
  await loadAnimDict(TabletAnim.Dictionary);

  // Load prop model
  await loadModel(TabletAnim.PropModel);

  // Play animation
  TaskPlayAnim(
    ped,
    TabletAnim.Dictionary,
    TabletAnim.Name,
    TabletAnim.AnimationSpeed,
    TabletAnim.BlendOutSpeed,
    -1,
    49,
    0,
    false,
    false,
    false
  );

  // Create tablet prop
  const propHash = GetHashKey(TabletAnim.PropModel);
  const coords = GetEntityCoords(ped, true);
  tabletObject = CreateObject(propHash, coords[0], coords[1], coords[2], true, true, true);

  if (tabletObject && DoesEntityExist(tabletObject)) {
    AttachEntityToEntity(
      tabletObject,
      ped,
      GetPedBoneIndex(ped, TabletAnim.BoneIndex),
      TabletAnim.Offset.x,
      TabletAnim.Offset.y,
      TabletAnim.Offset.z,
      TabletAnim.Rotation.x,
      TabletAnim.Rotation.y,
      TabletAnim.Rotation.z,
      true,
      true,
      false,
      true,
      1,
      true
    );
  }
}

function stopTabletAnimation(): void {
  if (!isPlayingAnimation) return;

  const ped = PlayerPedId();

  // Stop animation
  StopAnimTask(ped, TabletAnim.Dictionary, TabletAnim.Name, 1.0);

  // Delete tablet prop
  if (tabletObject && DoesEntityExist(tabletObject)) {
    DeleteEntity(tabletObject);
    tabletObject = null;
  }

  isPlayingAnimation = false;
}

// ==========================================
// MDT Toggle
// ==========================================

async function openMDT(): Promise<void> {
  if (isMDTOpen) return;

  if (!isPlayerLEO()) {
    exports.qbx_core.Notify('You must be on duty as LEO to access the MDT', 'error');
    return;
  }

  isMDTOpen = true;

  // Play tablet animation
  await playTabletAnimation();

  // Focus NUI
  SetNuiFocus(true, true);

  // Get player info and online officers
  const playerInfo = getPlayerInfo();
  const onlineOfficers = await triggerServerCallback<Officer[]>('mdt:getOnlineOfficers', 0);

  // Send visibility and data to NUI
  SendNUIMessage({
    action: 'setVisible',
    data: true,
  });

  SendNUIMessage({
    action: 'updatePlayerInfo',
    data: playerInfo,
  });

  SendNUIMessage({
    action: 'updateOnlineOfficers',
    data: onlineOfficers || [],
  });

  if (Config.Debug) {
    DebugLog('MDT opened', 'nui');
  }
}

function closeMDT(): void {
  if (!isMDTOpen) return;

  isMDTOpen = false;

  // Stop tablet animation
  stopTabletAnimation();

  // Unfocus NUI
  SetNuiFocus(false, false);

  // Hide NUI
  SendNUIMessage({
    action: 'setVisible',
    data: false,
  });

  if (Config.Debug) {
    DebugLog('MDT closed', 'nui');
  }
}

// ==========================================
// NUI Callbacks
// ==========================================

RegisterNuiCallback('closeMDT', (_data: unknown, cb: (data: unknown) => void) => {
  closeMDT();
  cb({});
});

RegisterNuiCallback('getPlayerInfo', (_data: unknown, cb: (data: PlayerInfo) => void) => {
  const playerInfo = getPlayerInfo();
  cb(playerInfo);
});

RegisterNuiCallback('getOnlineOfficers', async (_data: unknown, cb: (data: Officer[]) => void) => {
  const officers = await triggerServerCallback<Officer[]>('mdt:getOnlineOfficers', 0);
  cb(officers || []);
});

// Forward all other NUI callbacks to server callbacks
const nuiCallbacks = [
  'searchProfiles',
  'getProfile',
  'updateProfileNotes',
  'updateMugshot',
  'updateLicense',
  'getGangTags',
  'addGangTag',
  'removeGangTag',
  'getCitizenGangs',
  'searchVehicles',
  'getVehicle',
  'addVehicleFlag',
  'removeVehicleFlag',
  'getAllVehicleFlags',
  'impoundVehicle',
  'getWeaponRegistry',
  'getWeaponDetails',
  'registerWeapon',
  'updateWeaponRegistration',
  'updateWeaponStatus',
  'changeWeaponOwner',
  'deleteWeaponRegistration',
  'getReports',
  'getReport',
  'createReport',
  'updateReport',
  'deleteReport',
  'searchOfficersForReport',
  'searchCitizensForReport',
  'getAnnouncements',
  'createAnnouncement',
  'deleteAnnouncement',
  'updateAnnouncement',
  'getActiveBolos',
  'createBolo',
  'updateBolo',
  'deactivateBolo',
  'getBolo',
  'issueTrafficTicket',
  'getTrafficTicket',
  'applyFine',
  'sendToJail',
  'getAIIntegrationEnabled',
  'getAllProfiles',
  'lookupCitizenForTicket',
];

for (const callbackName of nuiCallbacks) {
  RegisterNuiCallback(callbackName, async (data: unknown, cb: (data: unknown) => void) => {
    try {
      const result = await triggerServerCallback(`mdt:${callbackName}`, 0, data);
      cb(result ?? {});
    } catch (error) {
      console.error(`[MDT] Error in NUI callback ${callbackName}:`, error);
      cb({ success: false, message: 'Client error' });
    }
  });
}

// ==========================================
// Keybind Registration
// ==========================================

RegisterKeyMapping('mdt', 'Open MDT', 'keyboard', Config.DefaultKeybind);

RegisterCommand('mdt', () => {
  if (isMDTOpen) {
    closeMDT();
  } else {
    openMDT();
  }
}, false);

// ==========================================
// Activity Tracking
// ==========================================

// Send position updates to server for activity tracking
setTick(async () => {
  if (!isPlayerLEO()) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    return;
  }

  const ped = PlayerPedId();
  const coords = GetEntityCoords(ped, true);

  TriggerServerEvent('mdt:server:updateOfficerPosition', {
    x: coords[0],
    y: coords[1],
    z: coords[2],
  });

  // Wait for configured interval
  await new Promise(resolve =>
    setTimeout(resolve, (Config.ActivityTracking?.UpdateInterval || 10) * 1000)
  );
});

// ==========================================
// Event Listeners
// ==========================================

// Listen for officer updates
onNet('mdt:updateOnlineOfficers', (officers: Officer[]) => {
  if (isMDTOpen) {
    SendNUIMessage({
      action: 'updateOnlineOfficers',
      data: officers,
    });
  }
});

// Listen for announcement created
onNet('mdt:announcementCreated', (data: { title: string; importance: string; author: string }) => {
  if (isPlayerLEO()) {
    exports.qbx_core.Notify(`New Announcement: ${data.title}`, 'info', 5000);
  }
});

// Listen for announcement refresh
onNet('mdt:refreshAnnouncements', () => {
  if (isMDTOpen) {
    SendNUIMessage({
      action: 'refreshAnnouncements',
      data: {},
    });
  }
});

// Listen for ticket view requests (from inventory items, etc.)
onNet('mdt:viewTicket', (ticketData: unknown) => {
  SendNUIMessage({
    action: 'viewTicket',
    data: ticketData,
  });

  if (!isMDTOpen) {
    SetNuiFocus(true, true);
    isMDTOpen = true;
  }
});

// Listen for navigation requests
onNet('mdt:navigateToVehicle', (plate: string) => {
  if (isMDTOpen) {
    SendNUIMessage({
      action: 'navigateToVehicle',
      data: plate,
    });
  }
});

onNet('mdt:navigateToFirearm', (serialNumber: string) => {
  if (isMDTOpen) {
    SendNUIMessage({
      action: 'navigateToFirearm',
      data: serialNumber,
    });
  }
});

// Listen for page switch with report open
onNet('mdt:switchPageAndOpenReport', (data: { page: string; reportId: number }) => {
  if (isMDTOpen) {
    SendNUIMessage({
      action: 'switchPageAndOpenReport',
      data,
    });
  }
});

// Clean up on resource stop
on('onResourceStop', (resourceName: string) => {
  if (resourceName === cache.resource) {
    closeMDT();
  }
});

// Handle player loaded
onNet('QBCore:Client:OnPlayerLoaded', () => {
  if (Config.Debug) {
    DebugLog('Player loaded - MDT ready', 'info');
  }
});

// Handle job update
onNet('QBCore:Client:OnJobUpdate', () => {
  if (isMDTOpen && !isPlayerLEO()) {
    closeMDT();
    exports.qbx_core.Notify('You are no longer on duty', 'error');
  }
});
