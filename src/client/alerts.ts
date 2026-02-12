// Dispatch Alerts module
// Provides exported alert functions for other resources to trigger dispatch calls
import Config from '@common/config';
import {
  getStreetAndZone,
  getVehicleData,
  getPlayerGender,
  getPlayerHeading,
  isOnDuty,
  isJobValid,
} from './dispatch';
import type { DispatchAlertData, DispatchBlipConfig, Vector3 } from '@common/types';

// Skip if dispatch is disabled
const DispatchConfig = Config.Dispatch;
if (!DispatchConfig?.Enabled) {
  // Don't export alert functions if dispatch is disabled
}

// ==========================================
// Helper Functions
// ==========================================

function getWeaponName(): string {
  try {
    const weapon = exports.ox_inventory.getCurrentWeapon();
    if (weapon?.label) return weapon.label;
    if (weapon?.name) return weapon.name;
  } catch {
    // ox_inventory not available
  }
  return 'Unknown Weapon';
}

function triggerDispatch(data: DispatchAlertData): void {
  if (!DispatchConfig?.Enabled) return;
  emit('mdt:dispatch:notify', data);
}

function getPlayerCoords(): Vector3 {
  const ped = PlayerPedId();
  const coords = GetEntityCoords(ped, true);
  return { x: coords[0], y: coords[1], z: coords[2] };
}

function getCurrentVehicle(): number {
  const ped = PlayerPedId();
  return GetVehiclePedIsIn(ped, false);
}

// ==========================================
// Custom Alert (for other resources)
// ==========================================

interface CustomAlertData {
  message: string;
  dispatchCode?: string;
  code?: string;
  icon?: string;
  priority?: 1 | 2 | 3;
  coords?: Vector3;
  street?: string;
  gender?: boolean;
  camId?: string;
  firstColor?: string;
  callsign?: string;
  name?: string;
  model?: string;
  plate?: string;
  information?: string;
  alertTime?: number;
  doorCount?: number;
  automaticGunfire?: boolean;
  radius?: number;
  sprite?: number;
  color?: number;
  scale?: number;
  length?: number;
  sound?: string;
  sound2?: string;
  offset?: boolean;
  flash?: boolean;
  jobs?: string[];
}

function CustomAlert(data: CustomAlertData): void {
  const coords = data.coords || getPlayerCoords();
  const gender = data.gender ? getPlayerGender() : undefined;

  const dispatchData: DispatchAlertData = {
    message: data.message || '',
    codeName: data.dispatchCode || 'custom',
    code: data.code || '',
    icon: data.icon || 'fas fa-question',
    priority: data.priority || 2,
    coords,
    gender,
    street: data.street || getStreetAndZone(coords),
    camId: data.camId,
    color: data.firstColor,
    callsign: data.callsign,
    name: data.name,
    vehicle: data.model,
    plate: data.plate,
    information: data.information,
    alertTime: data.alertTime || DispatchConfig?.AlertTime || 120,
    doors: data.doorCount,
    automaticGunfire: data.automaticGunfire,
    jobs: data.jobs || ['leo'],
    alert: {
      radius: data.radius || 0,
      sprite: data.sprite || 1,
      color: data.color || 1,
      scale: data.scale || 0.5,
      length: data.length || 2,
      sound: data.sound || 'Lose_1st',
      sound2: data.sound2 || 'GTAO_FM_Events_Soundset',
      offset: data.offset || false,
      flash: data.flash || false,
    },
  };

  triggerDispatch(dispatchData);
}

// ==========================================
// Vehicle Alerts
// ==========================================

function VehicleTheft(): void {
  // Check if player is LEO on duty - suppress alert
  const playerData = exports.qbx_core.GetPlayerData();
  if (playerData?.job?.type === 'leo' && playerData?.job?.onduty) {
    return;
  }

  const coords = getPlayerCoords();
  const vehicle = getCurrentVehicle();
  const vehicleData = getVehicleData(vehicle);

  triggerDispatch({
    message: 'Vehicle Theft in Progress',
    codeName: 'vehicletheft',
    code: '10-16',
    icon: 'fas fa-car-burst',
    priority: 2,
    coords,
    street: getStreetAndZone(coords),
    heading: getPlayerHeading(),
    vehicle: vehicleData.name,
    plate: vehicleData.plate,
    color: vehicleData.color,
    vehicleClass: vehicleData.class,
    doors: vehicleData.doors,
    alertTime: 150,
    jobs: ['leo'],
  });
}

function CarJacking(vehicle?: number): void {
  const playerData = exports.qbx_core.GetPlayerData();
  if (playerData?.job?.type === 'leo' && playerData?.job?.onduty) {
    return;
  }

  const coords = getPlayerCoords();
  const veh = vehicle || getCurrentVehicle();
  const vehicleData = getVehicleData(veh);

  triggerDispatch({
    message: 'Carjacking in Progress',
    codeName: 'carjack',
    code: '10-16',
    icon: 'fas fa-car',
    priority: 2,
    coords,
    street: getStreetAndZone(coords),
    heading: getPlayerHeading(),
    vehicle: vehicleData.name,
    plate: vehicleData.plate,
    color: vehicleData.color,
    vehicleClass: vehicleData.class,
    doors: vehicleData.doors,
    alertTime: 150,
    jobs: ['leo'],
  });
}

function CarBoosting(vehicle?: number): void {
  const coords = vehicle
    ? { x: GetEntityCoords(vehicle, true)[0], y: GetEntityCoords(vehicle, true)[1], z: GetEntityCoords(vehicle, true)[2] }
    : getPlayerCoords();
  const veh = vehicle || getCurrentVehicle();
  const vehicleData = getVehicleData(veh);

  triggerDispatch({
    message: 'Vehicle Boosting Alert',
    codeName: 'carboosting',
    code: '10-16',
    icon: 'fas fa-car',
    priority: 2,
    coords,
    street: getStreetAndZone(coords),
    heading: vehicle ? GetEntityHeading(vehicle) : getPlayerHeading(),
    vehicle: vehicleData.name,
    plate: vehicleData.plate,
    color: vehicleData.color,
    vehicleClass: vehicleData.class,
    doors: vehicleData.doors,
    alertTime: 180,
    jobs: ['leo'],
    alert: {
      radius: 50.0,
      sprite: 225,
      color: 1,
      scale: 1.0,
      length: 180,
      sound: 'dispatch',
      flash: true,
      offset: false,
    },
  });
}

// ==========================================
// Weapon Alerts
// ==========================================

function Shooting(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Shots Fired',
    codeName: 'shooting',
    code: '10-13',
    icon: 'fas fa-gun',
    priority: 2,
    coords,
    street: getStreetAndZone(coords),
    gender: getPlayerGender(),
    weapon: getWeaponName(),
    alertTime: 150,
    jobs: ['leo'],
  });
}

function VehicleShooting(): void {
  const coords = getPlayerCoords();
  const vehicle = getCurrentVehicle();
  const vehicleData = getVehicleData(vehicle);

  triggerDispatch({
    message: 'Shots Fired from Vehicle',
    codeName: 'vehicleshots',
    code: '10-60',
    icon: 'fas fa-gun',
    priority: 2,
    coords,
    weapon: getWeaponName(),
    street: getStreetAndZone(coords),
    heading: getPlayerHeading(),
    vehicle: vehicleData.name,
    plate: vehicleData.plate,
    color: vehicleData.color,
    vehicleClass: vehicleData.class,
    doors: vehicleData.doors,
    alertTime: 150,
    jobs: ['leo'],
  });
}

function Hunting(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Gunfire Reported in Hunting Zone',
    codeName: 'hunting',
    code: '10-13',
    icon: 'fas fa-gun',
    priority: 2,
    weapon: getWeaponName(),
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 150,
    jobs: ['leo'],
  });
}

// ==========================================
// Robbery Alerts
// ==========================================

function StoreRobbery(camId?: string): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Store Robbery in Progress',
    codeName: 'storerobbery',
    code: '10-68',
    icon: 'fas fa-store',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    camId,
    alertTime: 150,
    jobs: ['leo'],
  });
}

function FleecaBankRobbery(camId?: string): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Fleeca Bank Robbery in Progress',
    codeName: 'bankrobbery',
    code: '10-68',
    icon: 'fas fa-vault',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    camId,
    alertTime: 150,
    jobs: ['leo'],
  });
}

function PaletoBankRobbery(camId?: string): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Paleto Bay Bank Robbery in Progress',
    codeName: 'paletobankrobbery',
    code: '10-68',
    icon: 'fas fa-vault',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    camId,
    alertTime: 150,
    jobs: ['leo'],
  });
}

function PacificBankRobbery(camId?: string): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Pacific Standard Bank Robbery in Progress',
    codeName: 'pacificbankrobbery',
    code: '10-68',
    icon: 'fas fa-vault',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    camId,
    alertTime: 150,
    jobs: ['leo'],
  });
}

function VangelicoRobbery(camId?: string): void {
  const coords = { x: -625.84, y: -235.08, z: 38.06 };

  triggerDispatch({
    message: 'Vangelico Jewelry Store Robbery',
    codeName: 'vangelicorobbery',
    code: '10-68',
    icon: 'fas fa-gem',
    priority: 3,
    coords,
    alertTime: 150,
    jobs: ['leo'],
  });
}

function HouseRobbery(data?: { coords?: Vector3; gender?: string }): void {
  const coords = data?.coords || getPlayerCoords();
  const gender = data?.gender || getPlayerGender();

  triggerDispatch({
    message: 'House Robbery in Progress',
    codeName: 'houserobbery',
    code: '10-68',
    icon: 'fas fa-house',
    priority: 2,
    coords,
    gender,
    street: getStreetAndZone(coords),
    alertTime: 150,
    jobs: ['leo'],
  });
}

function YachtHeist(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Yacht Heist in Progress',
    codeName: 'yachtheist',
    code: '10-68',
    icon: 'fas fa-house',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 150,
    jobs: ['leo'],
  });
}

function ArtGalleryRobbery(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Art Gallery Robbery in Progress',
    codeName: 'artgalleryrobbery',
    code: '10-68',
    icon: 'fas fa-brush',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 150,
    jobs: ['leo'],
  });
}

function HumaneRobbery(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Humane Labs Break-In',
    codeName: 'humanelabsrobbery',
    code: '10-68',
    icon: 'fas fa-flask-vial',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 150,
    jobs: ['leo'],
  });
}

function TrainRobbery(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Train Robbery in Progress',
    codeName: 'trainrobbery',
    code: '10-68',
    icon: 'fas fa-train',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 150,
    jobs: ['leo'],
  });
}

function VanRobbery(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Armored Van Robbery',
    codeName: 'vanrobbery',
    code: '10-68',
    icon: 'fas fa-van-shuttle',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 150,
    jobs: ['leo'],
  });
}

function UndergroundRobbery(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Underground Robbery in Progress',
    codeName: 'undergroundrobbery',
    code: '10-68',
    icon: 'fas fa-person-rays',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 180,
    jobs: ['leo'],
  });
}

function DrugBoatRobbery(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Drug Boat Heist in Progress',
    codeName: 'drugboatrobbery',
    code: '10-68',
    icon: 'fas fa-ship',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 150,
    jobs: ['leo'],
  });
}

function UnionRobbery(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Union Depository Heist in Progress',
    codeName: 'unionrobbery',
    code: '10-68',
    icon: 'fas fa-truck-field',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 220,
    jobs: ['leo'],
  });
}

function TruckRobbery(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Armored Truck Robbery',
    codeName: 'truckrobbery',
    code: '10-68',
    icon: 'fas fa-truck-fast',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 180,
    jobs: ['leo'],
  });
}

function TruckRobberyAttempt(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Attempted Truck Robbery',
    codeName: 'truckrobbery_attempt',
    code: '10-68',
    icon: 'fas fa-truck-field',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 150,
    jobs: ['leo'],
  });
}

function TruckRobberyExplosion(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Armored Truck Explosion',
    codeName: 'truckrobbery_explosion',
    code: '10-67',
    icon: 'fas fa-bomb',
    priority: 3,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 220,
    jobs: ['leo'],
  });
}

function SignRobbery(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Sign Theft in Progress',
    codeName: 'signrobbery',
    code: '10-68',
    icon: 'fab fa-artstation',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 180,
    jobs: ['leo'],
  });
}

function BobcatSecurityHeist(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Bobcat Security Heist in Progress',
    codeName: 'bobcatsecurityheist',
    code: '10-68',
    icon: 'fa-solid fa-building-shield',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 180,
    jobs: ['leo'],
  });
}

function ATMHacking(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'ATM Hacking Detected',
    codeName: 'atmhacking',
    code: '10-17',
    icon: 'fas fa-credit-card',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 180,
    jobs: ['leo'],
  });
}

function PrisonBreak(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Prison Break in Progress',
    codeName: 'prisonbreak',
    code: '10-15',
    icon: 'fas fa-vault',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 150,
    jobs: ['leo'],
  });
}

// ==========================================
// Suspicious Activity Alerts
// ==========================================

function DrugSale(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Suspicious Drug Activity',
    codeName: 'suspicioushandoff',
    code: '10-17',
    icon: 'fas fa-tablets',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 150,
    jobs: ['leo'],
  });
}

function SuspiciousActivity(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Suspicious Activity Reported',
    codeName: 'susactivity',
    code: '10-17',
    icon: 'fas fa-tablets',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 150,
    jobs: ['leo'],
  });
}

// ==========================================
// Emergency Alerts
// ==========================================

function InjuriedPerson(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Injured Person Reported',
    codeName: 'civdown',
    code: '10-52',
    icon: 'fas fa-face-dizzy',
    priority: 1,
    coords,
    street: getStreetAndZone(coords),
    alertTime: 150,
    jobs: ['ems'],
    alert: {
      sprite: 621,
      color: 1,
      scale: 1.5,
      length: 2,
      sound: 'dispatch',
      offset: false,
      flash: false,
      radius: 0,
    },
  });
}

function DeceasedPerson(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Deceased Person Found',
    codeName: 'civdead',
    code: '10-49',
    icon: 'fas fa-skull',
    priority: 1,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 150,
    jobs: ['ems'],
  });
}

function OfficerDown(): void {
  const playerData = exports.qbx_core.GetPlayerData();
  if (!playerData) return;

  const coords = getPlayerCoords();
  const name = `${playerData.charinfo?.firstname || 'Unknown'} ${playerData.charinfo?.lastname || 'Officer'}`;
  const callsign = playerData.metadata?.callsign || 'Unknown';

  triggerDispatch({
    message: 'Officer Down',
    codeName: 'officerdown',
    code: '10-99',
    icon: 'fas fa-skull',
    priority: 1,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    name,
    callsign,
    alertTime: 10,
    jobs: ['ems', 'leo'],
  });
}

function OfficerBackup(): void {
  const playerData = exports.qbx_core.GetPlayerData();
  if (!playerData) return;

  const coords = getPlayerCoords();
  const name = `${playerData.charinfo?.firstname || 'Unknown'} ${playerData.charinfo?.lastname || 'Officer'}`;
  const callsign = playerData.metadata?.callsign || 'Unknown';

  triggerDispatch({
    message: 'Officer Requesting Backup',
    codeName: 'officerbackup',
    code: '10-32',
    icon: 'fas fa-skull',
    priority: 1,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    name,
    callsign,
    alertTime: 150,
    jobs: ['ems', 'leo'],
  });
}

function OfficerInDistress(): void {
  const playerData = exports.qbx_core.GetPlayerData();
  if (!playerData) return;

  const coords = getPlayerCoords();
  const name = `${playerData.charinfo?.firstname || 'Unknown'} ${playerData.charinfo?.lastname || 'Officer'}`;
  const callsign = playerData.metadata?.callsign || 'Unknown';

  triggerDispatch({
    message: 'Officer in Distress',
    codeName: 'officerdistress',
    code: '10-99',
    icon: 'fas fa-skull',
    priority: 1,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    name,
    callsign,
    alertTime: 150,
    jobs: ['ems', 'leo'],
  });
}

function EmsDown(): void {
  const playerData = exports.qbx_core.GetPlayerData();
  if (!playerData) return;

  const coords = getPlayerCoords();
  const name = `${playerData.charinfo?.firstname || 'Unknown'} ${playerData.charinfo?.lastname || 'Medic'}`;
  const callsign = playerData.metadata?.callsign || 'Unknown';

  triggerDispatch({
    message: 'EMS Down',
    codeName: 'emsdown',
    code: '10-52',
    icon: 'fas fa-skull',
    priority: 1,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    name,
    callsign,
    alertTime: 150,
    jobs: ['ems', 'leo'],
  });
}

function Explosion(): void {
  const coords = getPlayerCoords();

  triggerDispatch({
    message: 'Explosion Reported',
    codeName: 'explosion',
    code: '10-67',
    icon: 'fas fa-fire',
    priority: 2,
    coords,
    gender: getPlayerGender(),
    street: getStreetAndZone(coords),
    alertTime: 150,
    jobs: ['leo'],
  });
}

// ==========================================
// Export All Alert Functions
// ==========================================

if (DispatchConfig?.Enabled) {
  // Custom alert for other resources
  exports('CustomAlert', CustomAlert);

  // Vehicle alerts
  exports('VehicleTheft', VehicleTheft);
  exports('CarJacking', CarJacking);
  exports('CarBoosting', CarBoosting);

  // Weapon alerts
  exports('Shooting', Shooting);
  exports('VehicleShooting', VehicleShooting);
  exports('Hunting', Hunting);

  // Robbery alerts
  exports('StoreRobbery', StoreRobbery);
  exports('FleecaBankRobbery', FleecaBankRobbery);
  exports('PaletoBankRobbery', PaletoBankRobbery);
  exports('PacificBankRobbery', PacificBankRobbery);
  exports('VangelicoRobbery', VangelicoRobbery);
  exports('HouseRobbery', HouseRobbery);
  exports('YachtHeist', YachtHeist);
  exports('ArtGalleryRobbery', ArtGalleryRobbery);
  exports('HumaneRobbery', HumaneRobbery);
  exports('TrainRobbery', TrainRobbery);
  exports('VanRobbery', VanRobbery);
  exports('UndergroundRobbery', UndergroundRobbery);
  exports('DrugBoatRobbery', DrugBoatRobbery);
  exports('UnionRobbery', UnionRobbery);
  exports('TruckRobbery', TruckRobbery);
  exports('TruckRobberyAttempt', TruckRobberyAttempt);
  exports('TruckRobberyExplosion', TruckRobberyExplosion);
  exports('SignRobbery', SignRobbery);
  exports('BobcatSecurityHeist', BobcatSecurityHeist);
  exports('ATMHacking', ATMHacking);
  exports('PrisonBreak', PrisonBreak);

  // Suspicious activity
  exports('DrugSale', DrugSale);
  exports('SuspiciousActivity', SuspiciousActivity);

  // Emergency alerts
  exports('InjuriedPerson', InjuriedPerson);
  exports('DeceasedPerson', DeceasedPerson);
  exports('OfficerDown', OfficerDown);
  exports('OfficerBackup', OfficerBackup);
  exports('OfficerInDistress', OfficerInDistress);
  exports('EmsDown', EmsDown);
  exports('Explosion', Explosion);

  // Register event listeners for backward compatibility
  onNet('mdt:dispatch:officerdown', OfficerDown);
  onNet('mdt:dispatch:officerbackup', OfficerBackup);
  onNet('mdt:dispatch:emsdown', EmsDown);

  console.log('^2[MDT] Dispatch alerts module initialized^0');
}

// ES Module exports for internal use
export {
  CustomAlert,
  VehicleTheft,
  CarJacking,
  CarBoosting,
  Shooting,
  VehicleShooting,
  Hunting,
  StoreRobbery,
  FleecaBankRobbery,
  PaletoBankRobbery,
  PacificBankRobbery,
  VangelicoRobbery,
  HouseRobbery,
  YachtHeist,
  ArtGalleryRobbery,
  HumaneRobbery,
  TrainRobbery,
  VanRobbery,
  UndergroundRobbery,
  DrugBoatRobbery,
  UnionRobbery,
  TruckRobbery,
  TruckRobberyAttempt,
  TruckRobberyExplosion,
  SignRobbery,
  BobcatSecurityHeist,
  ATMHacking,
  PrisonBreak,
  DrugSale,
  SuspiciousActivity,
  InjuriedPerson,
  DeceasedPerson,
  OfficerDown,
  OfficerBackup,
  OfficerInDistress,
  EmsDown,
  Explosion,
};
