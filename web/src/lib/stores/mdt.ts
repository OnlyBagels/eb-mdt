// MDT Svelte 5 Stores
import { fetchNui, onNuiEvent } from '../utils/fetchNui';

// Types
export interface Officer {
  id: number;
  name: string;
  callsign: string;
  department: string;
  rank: string;
  citizenid?: string;
}

export interface PlayerInfo {
  name: string;
  callsign: string;
  department: string;
  rank: string;
  jobName?: string;
  gradeLevel?: number;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  author: string;
  author_citizenid: string;
  department: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  expires_at: string | null;
  canDelete: boolean;
}

export interface ActiveBolo {
  id: number;
  plate: string;
  reason: string;
  officer_name: string;
  officer_identifier: string;
  created_at: string;
  updated_at: string;
  is_active: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  notes: string;
  flag_type?: string;
  source?: 'mdt' | 'aipullover';
}

// Reactive state using Svelte 5 runes
let visible = $state(false);
let currentSection = $state('dashboard');
let playerInfo = $state<PlayerInfo>({
  name: 'Loading...',
  callsign: '...',
  department: '...',
  rank: '...'
});
let onlineOfficers = $state<Officer[]>([]);
let announcements = $state<Announcement[]>([]);
let activeBolos = $state<ActiveBolo[]>([]);
let canCreateAnnouncement = $state(false);
let navigationData = $state<any>(null);

// Export getters and setters
export function getVisible() { return visible; }
export function setVisible(v: boolean) { visible = v; }

export function getCurrentSection() { return currentSection; }
export function setCurrentSection(section: string) { currentSection = section; }

export function getPlayerInfo() { return playerInfo; }
export function setPlayerInfo(info: PlayerInfo) { playerInfo = info; }

export function getOnlineOfficers() { return onlineOfficers; }
export function setOnlineOfficers(officers: Officer[]) { onlineOfficers = officers; }

export function getAnnouncements() { return announcements; }
export function setAnnouncements(list: Announcement[]) { announcements = list; }

export function getActiveBolos() { return activeBolos; }
export function setActiveBolos(bolos: ActiveBolo[]) { activeBolos = bolos; }

export function getCanCreateAnnouncement() { return canCreateAnnouncement; }
export function setCanCreateAnnouncement(can: boolean) { canCreateAnnouncement = can; }

export function getNavigationData() { return navigationData; }
export function setNavigationData(data: any) { navigationData = data; }

// Actions
export async function loadAnnouncements() {
  try {
    const result = await fetchNui<{ announcements: Announcement[]; canCreate: boolean }>('getAnnouncements', {});
    if (result) {
      setAnnouncements(result.announcements || []);
      setCanCreateAnnouncement(result.canCreate || false);
    }
  } catch (error) {
    console.error('Error loading announcements:', error);
  }
}

export async function loadActiveBolos() {
  try {
    const result = await fetchNui<ActiveBolo[]>('getActiveBolos', {});
    if (result) {
      setActiveBolos(result);
    }
  } catch (error) {
    console.error('Error loading BOLOs:', error);
    setActiveBolos([]);
  }
}

export async function createAnnouncement(data: {
  title: string;
  content: string;
  importance: string;
  duration: number;
}) {
  const result = await fetchNui<{ success: boolean; message?: string }>('createAnnouncement', data);
  if (result.success) {
    await loadAnnouncements();
  }
  return result;
}

export async function deleteAnnouncement(id: number) {
  const result = await fetchNui<{ success: boolean }>('deleteAnnouncement', { id });
  if (result.success) {
    setAnnouncements(announcements.filter(a => a.id !== id));
  }
  return result;
}

export function closeMDT() {
  fetchNui('closeMDT', {});
  setVisible(false);
}

// Navigation helpers
export function navigateToProfile(citizenid: string) {
  setNavigationData({ citizenid });
  setCurrentSection('profiles');
}

export function navigateToVehicle(plate: string) {
  setNavigationData({ searchQuery: plate, timestamp: Date.now() });
  setCurrentSection('vehicles');
}

export function navigateToFirearm(serialNumber: string) {
  setNavigationData({ searchQuery: serialNumber, timestamp: Date.now() });
  setCurrentSection('weapons');
}

export function navigateToReport(reportId: number) {
  setNavigationData({ reportId });
  setCurrentSection('reports');
}

// Initialize NUI event listeners
export function initNuiListeners() {
  onNuiEvent<boolean>('setVisible', (data) => {
    setVisible(data);
  });

  onNuiEvent<PlayerInfo>('updatePlayerInfo', (data) => {
    setPlayerInfo(data);
  });

  onNuiEvent<Officer[]>('updateOnlineOfficers', (data) => {
    setOnlineOfficers(data);
  });

  onNuiEvent('refreshAnnouncements', () => {
    loadAnnouncements();
  });

  onNuiEvent('newAnnouncement', () => {
    loadAnnouncements();
  });

  onNuiEvent<string>('navigateToVehicle', (plate) => {
    navigateToVehicle(plate);
  });

  onNuiEvent<string>('navigateToFirearm', (serialNumber) => {
    navigateToFirearm(serialNumber);
  });

  onNuiEvent<{ page: string; reportId: number }>('switchPageAndOpenReport', (data) => {
    navigateToReport(data.reportId);
  });
}
