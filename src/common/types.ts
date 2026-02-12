// MDT Types

// ==========================================
// Player & Officer Types
// ==========================================

export interface PlayerInfo {
  name: string;
  callsign: string;
  department: string;
  rank: string;
  jobName: string;
  gradeLevel: number;
  citizenid?: string;
}

export interface Officer {
  id: number;
  name: string;
  callsign: string;
  department: string;
  jobName: string;
  rank: string;
  isInactive?: boolean;
  citizenid?: string;
}

export interface OfficerSearchResult {
  citizenid: string;
  name: string;
  callsign: string;
  department: string;
  rank: string;
}

// ==========================================
// Profile Types
// ==========================================

export interface CitizenProfile {
  id: number;
  citizenid: string;
  firstname: string;
  lastname: string;
  birthdate: string;
  gender: string;
  nationality: string;
  phone: string;
  job: string;
  jobGrade: string;
  gangTags?: string;
  photoUrl?: string;
  hasWarrant?: boolean;
  convictionCount?: number;
}

export interface DetailedProfile extends CitizenProfile {
  fingerprint: string;
  bloodType: string;
  blood: number;
  dna: string;
  jobDuty: boolean;
  jobs: Job[];
  licenses: Record<string, boolean>;
  vehicles: ProfileVehicle[];
  properties: Property[];
  criminalRecord: CriminalRecord;
  registeredWeapons: RegisteredWeapon[];
  notes: string;
  criminalCharges: CriminalCharge[];
  canManageLicenses: boolean;
}

export interface Job {
  name: string;
  label: string;
  grade: number;
  gradeName: string;
  payment: number;
  isboss: boolean;
}

export interface ProfileVehicle {
  id: number;
  plate: string;
  vehicle: string;
  garage: string;
  state: number;
}

export interface Property {
  id: number;
  label: string;
  price: number;
  type: string;
  doorLocked: boolean;
  hasKey: boolean;
}

export interface CriminalRecord {
  arrests: number;
  citations: number;
  warrants: number;
}

export interface RegisteredWeapon {
  id: number;
  weapon_type: string;
  serial_number: string;
  registration_date: string;
  status: WeaponStatus;
}

export interface CriminalCharge {
  id: number;
  report_id: number;
  charge_code: string;
  charge_title: string;
  charge_class: string;
  fine: number;
  months: number;
  guilty_plea: boolean;
  report_number: string;
  report_title: string;
  created_at: string;
  created_by: string;
}

export interface GangTag {
  id: number;
  name: string;
  color: string;
}

export interface CitizenGang {
  id: number;
  gang_id: number;
  gang_name: string;
  gang_color: string;
  tagged_by: string;
  tagged_at: string;
  notes: string;
}

// ==========================================
// Vehicle Types
// ==========================================

export interface Vehicle {
  id: number;
  plate: string;
  citizenid: string;
  model: string;
  hash?: number;
  owner: string;
  fakeplate?: string;
  garage?: string;
  fuel?: number;
  engine?: number;
  body?: number;
  state: number;
  locationStatus?: string;
  inGarage?: boolean;
  isJobVehicle?: boolean;
  jobVehicleRank?: number;
  isGangVehicle?: boolean;
  gangVehicleRank?: number;
  color?: number;
  canViewLocation?: boolean;
  flags: VehicleFlag[];
}

export interface DetailedVehicle extends Vehicle {
  modelHash?: number;
  garageId?: string;
  depotPrice?: number;
  drivingDistance?: number;
  status?: string;
  mods?: Record<string, unknown>;
  damage?: Record<string, unknown>;
  glovebox?: unknown[];
  trunk?: unknown[];
}

export interface VehicleFlag {
  id: number | string;
  vehicle_id?: number;
  plate?: string;
  flag_type: FlagType;
  description: string;
  reported_by: string;
  created_at: string;
  is_active: boolean;
  source?: 'mdt' | 'aipullover';
  priority?: string;
}

export type FlagType = 'bolo' | 'stolen' | 'warrant' | 'suspicious' | 'wanted';

// ==========================================
// Weapon Types
// ==========================================

export interface WeaponRegistration {
  id: number;
  citizen_id: string;
  owner_name: string;
  weapon_type: string;
  weapon_model: string;
  serial_number: string;
  registration_date: string;
  notes: string;
  status: WeaponStatus;
}

export type WeaponStatus = 'active' | 'stolen' | 'destroyed' | 'lost' | 'surrendered';

export interface WeaponRegistryResponse {
  weapons: WeaponRegistration[];
  totalCount: number;
  canManage: boolean;
}

// ==========================================
// Report Types
// ==========================================

export interface Report {
  id: number;
  report_number: string;
  title: string;
  type: ReportType;
  status: ReportStatus;
  priority: ReportPriority;
  content?: string;
  location?: string;
  tags?: string;
  created_by: string;
  created_by_citizenid?: string;
  created_at: string;
  updated_at: string;
  updated_by?: string;
  involved_count?: number;
  charge_count?: number;
  evidence_count?: number;
  is_ticket?: boolean;
}

export type ReportType = 'incident' | 'arrest' | 'traffic' | 'citation' | 'investigation' | 'other';
export type ReportStatus = 'open' | 'pending' | 'closed' | 'archived';
export type ReportPriority = 'low' | 'normal' | 'high' | 'critical';

export interface DetailedReport {
  report: Report;
  officers: ReportOfficer[];
  involved: ReportInvolved[];
  charges: ReportCharge[];
  evidence: ReportEvidence[];
}

export interface ReportOfficer {
  id: number;
  officer_name: string;
  officer_citizenid?: string;
  officer_callsign: string;
}

export interface ReportInvolved {
  id: number;
  citizenid: string;
  name: string;
  role: InvolvedRole;
  phone?: string;
}

export type InvolvedRole = 'suspect' | 'victim' | 'witness' | 'accomplice' | 'person_of_interest';

export interface ReportCharge {
  id: number;
  citizenid: string;
  citizen_name?: string;
  charge_code: string;
  charge_title: string;
  charge_class: string;
  fine: number;
  months: number;
  fine_reduction?: number;
  guilty_plea: boolean;
}

export interface ReportEvidence {
  id: number;
  type: EvidenceType;
  title: string;
  description: string;
  url: string;
  added_by: string;
  added_at: string;
}

export type EvidenceType = 'photo' | 'video' | 'document' | 'audio' | 'other';

export interface CreateReportData {
  title: string;
  type: ReportType;
  status?: ReportStatus;
  priority?: ReportPriority;
  content: string;
  location: string;
  officers: { name: string; citizenid?: string; callsign: string }[];
  involved: { citizenid: string; role: InvolvedRole; notes?: string }[];
  charges: {
    citizenid: string;
    code: string;
    title: string;
    class: string;
    fine: number;
    months: number;
    guiltyPlea?: boolean;
  }[];
  evidence: { type: EvidenceType; title: string; description: string; url: string }[];
}

// ==========================================
// Announcement Types
// ==========================================

export interface Announcement {
  id: number;
  title: string;
  content: string;
  author: string;
  author_citizenid: string;
  department: string;
  importance: AnnouncementImportance;
  created_at: string;
  expires_at: string | null;
  canDelete?: boolean;
}

export type AnnouncementImportance = 'low' | 'medium' | 'high' | 'critical';

export interface AnnouncementsResponse {
  announcements: Announcement[];
  canCreate: boolean;
}

// ==========================================
// BOLO Types
// ==========================================

export interface BOLO {
  id: number;
  plate: string;
  reason: string;
  officer_name: string;
  officer_identifier: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  priority: BOLOPriority;
  notes: string;
  flag_type?: FlagType;
  source?: 'mdt' | 'aipullover';
}

export type BOLOPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ==========================================
// Warrant Types
// ==========================================

export interface Warrant {
  id: number;
  warrant_number: string;
  citizenid: string;
  charges: string;
  description: string;
  issued_by: string;
  issued_by_citizenid: string;
  issued_at: string;
  expires_at: string | null;
  status: WarrantStatus;
  served_by?: string;
  served_at?: string;
}

export type WarrantStatus = 'active' | 'served' | 'expired' | 'cancelled';

// ==========================================
// Traffic Ticket Types
// ==========================================

export interface TrafficTicket {
  id: number;
  report_number: string;
  title: string;
  ticket_fine: number;
  ticket_reason: string;
  ticket_citizen_id: string;
  ticket_citizen_name: string;
  ticket_citizen_sex: number;
  ticket_citizen_dob: string;
  ticket_officer_badge: string;
  ticket_officer_rank: string;
  ticket_pay_until: string;
  ticket_signature: string;
  ticket_security_key: string;
  ticket_signature_timestamp: string;
  ticket_paid: boolean;
  ticket_after_time: boolean;
  ticket_contested: boolean;
  ticket_contested_at: string | null;
  created_at: string;
  created_by: string;
}

// ==========================================
// Penal Code Types
// ==========================================

export interface PenalCodeCategory {
  category: string;
  codes: PenalCode[];
}

export interface PenalCode {
  code: string;
  description: string;
  fine: number;
  jailTime?: number;
}

// ==========================================
// API Response Types
// ==========================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

// ==========================================
// Search Filter Types
// ==========================================

export interface ReportFilters {
  search?: string;
  type?: ReportType | 'all';
  status?: ReportStatus | 'all';
  priority?: ReportPriority | 'all';
  dateFrom?: string;
  dateTo?: string;
}

export interface WeaponFilters {
  search?: string;
  status?: WeaponStatus | 'all';
}

// ==========================================
// QBX Core Types (for server-side)
// ==========================================

export interface QBXPlayer {
  PlayerData: PlayerData;
  Functions?: Record<string, unknown>;
}

export interface PlayerData {
  source: number;
  citizenid: string;
  license: string;
  name: string;
  charinfo: CharInfo;
  job: JobData;
  gang: GangData;
  metadata: PlayerMetadata;
  money: Record<string, number>;
  position: Vector3;
}

export interface CharInfo {
  firstname: string;
  lastname: string;
  birthdate: string;
  gender: number;
  nationality: string;
  phone?: string;
  cid?: number;
}

export interface JobData {
  name: string;
  label: string;
  type: string;
  onduty: boolean;
  payment: number;
  isboss: boolean;
  grade: {
    name: string;
    level: number;
  };
}

export interface GangData {
  name: string;
  label: string;
  isboss: boolean;
  grade: {
    name: string;
    level: number;
  };
}

export interface PlayerMetadata {
  callsign?: string;
  bloodtype?: string;
  fingerprint?: string;
  dna?: string;
  licences?: Record<string, boolean>;
  licenses?: Record<string, boolean>;
  [key: string]: unknown;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

// ==========================================
// Department Types
// ==========================================

export interface DepartmentIcon {
  icon: string;
  color: string;
}

export interface DepartmentConfig {
  logos: Record<string, string>;
  icons: Record<string, DepartmentIcon>;
}

// ==========================================
// Dispatch Types
// ==========================================

export interface DispatchCall {
  id: number;
  callId: string;
  message: string;
  codeName: string;
  code: string;
  icon: string;
  priority: DispatchPriority;
  coords: Vector3;
  street: string;
  gender?: string;
  weapon?: string;
  vehicle?: string;
  plate?: string;
  color?: string;
  vehicleClass?: string;
  doors?: number;
  heading?: number;
  camId?: string;
  callsign?: string;
  name?: string;
  number?: string;
  information?: string;
  alertTime: number;
  jobs: string[];
  units: DispatchUnit[];
  blip: DispatchBlipConfig;
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
  automaticGunfire?: boolean;
}

export type DispatchPriority = 1 | 2 | 3;

export interface DispatchBlipConfig {
  radius: number;
  sprite: number;
  color: number;
  scale: number;
  length: number;
  sound: string;
  sound2?: string;
  offset: boolean;
  flash: boolean;
}

export interface DispatchUnit {
  id: number;
  callId: string;
  citizenid: string;
  name: string;
  callsign: string;
  department: string;
  attachedAt: string;
}

export interface DispatchAlertData {
  message: string;
  codeName: string;
  code: string;
  icon: string;
  priority?: DispatchPriority;
  coords: Vector3;
  street?: string;
  gender?: string;
  weapon?: string;
  vehicle?: string;
  plate?: string;
  color?: string;
  vehicleClass?: string;
  doors?: number;
  heading?: number;
  camId?: string;
  callsign?: string;
  name?: string;
  number?: string;
  information?: string;
  alertTime?: number;
  jobs?: string[];
  automaticGunfire?: boolean;
  alert?: Partial<DispatchBlipConfig>;
  customDispatch?: boolean;
}

export interface DispatchLocation {
  label: string;
  coords: Vector3;
  radius?: number;
  length?: number;
  width?: number;
  heading?: number;
  minZ?: number;
  maxZ?: number;
}

export interface DispatchLocations {
  HuntingZones: Record<number, DispatchLocation>;
  NoDispatchZones: Record<number, DispatchLocation>;
}

export interface DispatchBlipPreset {
  radius: number;
  sprite: number;
  color: number;
  scale: number;
  length: number;
  sound: string;
  sound2?: string;
  offset: boolean;
  flash: boolean;
}

export interface DispatchConfig {
  Enabled: boolean;
  Debug: boolean;
  ShortCalls: boolean;
  AlertTime: number;
  MaxCallList: number;
  OnDutyOnly: boolean;
  Jobs: string[];
  JobColors: Record<string, number>;
  AlertCommandCooldown: number;
  DefaultAlertsDelay: number;
  DefaultAlerts: {
    Speeding: boolean;
    Shooting: boolean;
    Autotheft: boolean;
    Melee: boolean;
    PlayerDowned: boolean;
    Explosion: boolean;
    EmsDown: boolean;
    EmsBackup: boolean;
    OfficerPing: boolean;
    EmergencyButton: boolean;
    CarJacking: boolean;
  };
  MinOffset: number;
  MaxOffset: number;
  PhoneRequired: boolean;
  PhoneItems: string[];
  EnableHuntingBlip: boolean;
  Locations: DispatchLocations;
  WeaponWhitelist: string[];
  Blips: Record<string, DispatchBlipPreset>;
  VehicleColors: Record<string, string>;
  Keybinds: {
    Respond: string;
    OpenMenu: string;
    NavigateLeft: string;
    NavigateRight: string;
  };
}

export interface DispatchCallsResponse {
  calls: DispatchCall[];
  canRespond: boolean;
}

export interface DispatchApiResponse {
  success: boolean;
  message?: string;
  data?: {
    callId?: string;
    id?: number;
  };
}
