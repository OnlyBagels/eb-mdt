// Weapons server module
// Uses SQLite for mdt_weapon_registry, MySQL for players
import Config from '@common/config';
import { DebugLog } from '@common/index';
import { onClientCallback } from '@communityox/ox_lib/server';
import { SQLite, MySQL, extractParam, getFormattedTimestamp } from './db';
import type { QBXPlayer, WeaponRegistration, WeaponRegistryResponse, ApiResponse } from '@common/types';

// ==========================================
// Helper Functions
// ==========================================

function isPlayerAuthorized(source: number): QBXPlayer | null {
  const player = exports.qbx_core.GetPlayer(source) as QBXPlayer | null;
  if (!player || player.PlayerData.job.type !== 'leo' || !player.PlayerData.job.onduty) {
    return null;
  }
  return player;
}

function canManageWeapons(player: QBXPlayer): boolean {
  const jobName = player.PlayerData.job.name.toLowerCase();
  const gradeLevel = player.PlayerData.job.grade.level || 0;
  const requiredRank = Config.RankRequirements.WeaponsManagement[jobName as keyof typeof Config.RankRequirements.WeaponsManagement];

  if (requiredRank === undefined) {
    return gradeLevel >= 1;
  }

  return gradeLevel >= requiredRank;
}

function canDeleteWeapons(player: QBXPlayer): boolean {
  const jobName = player.PlayerData.job.name.toLowerCase();
  const gradeLevel = player.PlayerData.job.grade.level || 0;
  const requiredRank = Config.RankRequirements.WeaponDeletion[jobName as keyof typeof Config.RankRequirements.WeaponDeletion];

  if (requiredRank === undefined) {
    return false;
  }

  return gradeLevel >= requiredRank;
}

function notifyLeoOfficers(title: string, description: string, type: 'info' | 'success' | 'warning' | 'error', duration: number): void {
  const players = exports.qbx_core.GetQBPlayers() as Record<number, QBXPlayer>;

  for (const [, targetPlayer] of Object.entries(players)) {
    if (targetPlayer?.PlayerData?.job?.type === 'leo' && targetPlayer.PlayerData.job.onduty) {
      emitNet('qbx_core:notify', targetPlayer.PlayerData.source, {
        title,
        description,
        type,
        duration,
      });
    }
  }
}

// Helper to get owner name from MySQL players table
async function getOwnerName(citizenId: string): Promise<string> {
  try {
    const player = await MySQL.single<Record<string, unknown>>(
      `SELECT name, JSON_EXTRACT(charinfo, '$.firstname') as firstname, JSON_EXTRACT(charinfo, '$.lastname') as lastname
       FROM players WHERE citizenid = ?`,
      [citizenId]
    );

    if (player) {
      const firstname = player.firstname?.toString().replace(/"/g, '') || '';
      const lastname = player.lastname?.toString().replace(/"/g, '') || '';
      if (firstname && lastname) {
        return `${firstname} ${lastname}`;
      }
      return (player.name as string) || 'Unknown';
    }
  } catch {
    // Ignore errors
  }
  return 'Unknown';
}

// ==========================================
// Get Weapon Registry
// ==========================================

onClientCallback('mdt:getWeaponRegistry', async (source: number, filters?: { search?: string; status?: string }): Promise<WeaponRegistryResponse | null> => {
  const player = isPlayerAuthorized(source);
  if (!player) return null;

  try {
    // First get weapons from SQLite
    let query = `
      SELECT id, citizen_id, weapon_type, weapon_model, serial_number,
             registration_date, notes, status
      FROM mdt_weapon_registry
    `;

    const whereConditions: string[] = [];
    const queryParams: unknown[] = [];

    if (filters) {
      if (filters.search && filters.search !== '') {
        whereConditions.push(`
          (LOWER(serial_number) LIKE ? OR LOWER(citizen_id) LIKE ?)
        `);
        const searchPattern = `%${filters.search.toLowerCase()}%`;
        queryParams.push(searchPattern, searchPattern);
      }

      if (filters.status && filters.status !== '' && filters.status !== 'all') {
        whereConditions.push('status = ?');
        queryParams.push(filters.status);
      }
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    query += ' ORDER BY registration_date DESC LIMIT ?';
    queryParams.push(Config.QueryLimits.WeaponRegistry);

    const weapons = SQLite.query<{
      id: number;
      citizen_id: string;
      weapon_type: string;
      weapon_model: string;
      serial_number: string;
      registration_date: string;
      notes: string;
      status: string;
    }>(query, queryParams);

    // Get owner names from MySQL for each weapon
    const formattedWeapons: WeaponRegistration[] = [];

    for (const weapon of weapons || []) {
      // Also check if owner name matches search filter
      const ownerName = await getOwnerName(weapon.citizen_id);

      // If we have a search filter, also filter by owner name
      if (filters?.search && filters.search !== '') {
        const searchLower = filters.search.toLowerCase();
        const matchesSerial = weapon.serial_number.toLowerCase().includes(searchLower);
        const matchesCitizenId = weapon.citizen_id.toLowerCase().includes(searchLower);
        const matchesOwner = ownerName.toLowerCase().includes(searchLower);

        if (!matchesSerial && !matchesCitizenId && !matchesOwner) {
          continue; // Skip this weapon if it doesn't match the search
        }
      }

      formattedWeapons.push({
        id: weapon.id,
        citizen_id: weapon.citizen_id,
        owner_name: ownerName,
        weapon_type: weapon.weapon_type,
        weapon_model: weapon.weapon_model || '',
        serial_number: weapon.serial_number,
        registration_date: weapon.registration_date,
        notes: weapon.notes || '',
        status: weapon.status as WeaponRegistration['status'],
      });
    }

    return {
      weapons: formattedWeapons,
      totalCount: formattedWeapons.length,
      canManage: canManageWeapons(player),
    };
  } catch (error) {
    console.error('[MDT] Error getting weapon registry:', error);
    return null;
  }
});

// ==========================================
// Get Weapon Details
// ==========================================

onClientCallback('mdt:getWeaponDetails', async (source: number, data: unknown): Promise<WeaponRegistration | null> => {
  const player = isPlayerAuthorized(source);
  if (!player) return null;

  const weaponId = typeof data === 'number' ? data : extractParam<number>(data, 'weaponId') || 0;
  if (!weaponId) return null;

  try {
    const result = SQLite.single<{
      id: number;
      citizen_id: string;
      weapon_type: string;
      weapon_model: string;
      serial_number: string;
      registration_date: string;
      notes: string;
      status: string;
    }>(
      `SELECT id, citizen_id, weapon_type, weapon_model, serial_number,
              registration_date, notes, status
       FROM mdt_weapon_registry WHERE id = ?`,
      [weaponId]
    );

    if (!result) return null;

    const ownerName = await getOwnerName(result.citizen_id);

    return {
      id: result.id,
      citizen_id: result.citizen_id,
      owner_name: ownerName,
      weapon_type: result.weapon_type,
      weapon_model: result.weapon_model || '',
      serial_number: result.serial_number,
      registration_date: result.registration_date,
      notes: result.notes || '',
      status: result.status as WeaponRegistration['status'],
    };
  } catch (error) {
    console.error('[MDT] Error getting weapon details:', error);
    return null;
  }
});

// ==========================================
// Register Weapon
// ==========================================

onClientCallback('mdt:registerWeapon', (source: number, data: {
  citizen_id: string;
  weapon_type: string;
  weapon_model?: string;
  serial_number: string;
  notes?: string;
  status?: string;
}): ApiResponse => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  if (!canManageWeapons(player)) {
    return { success: false, message: 'Insufficient rank to register weapons' };
  }

  if (!data.citizen_id || data.citizen_id === '') {
    return { success: false, message: 'Citizen ID is required' };
  }

  if (!data.weapon_type || data.weapon_type === '') {
    return { success: false, message: 'Weapon type is required' };
  }

  if (!data.serial_number || data.serial_number === '') {
    return { success: false, message: 'Serial number is required' };
  }

  try {
    // Check if serial number already exists in SQLite
    const existing = SQLite.single<{ id: number }>(
      'SELECT id FROM mdt_weapon_registry WHERE serial_number = ?',
      [data.serial_number]
    );

    if (existing) {
      return { success: false, message: 'Serial number already exists' };
    }

    const result = SQLite.insert(
      `INSERT INTO mdt_weapon_registry (citizen_id, weapon_type, weapon_model, serial_number, registration_date, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.citizen_id,
        data.weapon_type,
        data.weapon_model || '',
        data.serial_number,
        getFormattedTimestamp(),
        data.notes || '',
        data.status || Config.Defaults.WeaponStatus,
      ]
    );

    if (result) {
      const officerName = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;

      emit('mdt:server:log', {
        action: 'Weapon Registered',
        officer: officerName,
        target: data.citizen_id,
        details: `Type: ${data.weapon_type} | Serial: ${data.serial_number}`,
      });

      // Notify if weapon is marked as stolen
      if (data.status === 'stolen') {
        notifyLeoOfficers(
          'Stolen Weapon Alert',
          `Serial: ${data.serial_number}`,
          'warning',
          Config.NotificationDurations.StolenWeaponAlert
        );
      }

      return { success: true, data: { id: result } };
    }

    return { success: false, message: 'Failed to register weapon' };
  } catch (error) {
    console.error('[MDT] Error registering weapon:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// Update Weapon Registration
// ==========================================

onClientCallback('mdt:updateWeaponRegistration', (source: number, data: {
  weaponId: number;
  weapon_type: string;
  weapon_model?: string;
  notes?: string;
  status: string;
}): ApiResponse => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  if (!canManageWeapons(player)) {
    return { success: false, message: 'Insufficient rank to update weapon registrations' };
  }

  try {
    SQLite.update(
      `UPDATE mdt_weapon_registry
       SET weapon_type = ?, weapon_model = ?, notes = ?, status = ?
       WHERE id = ?`,
      [data.weapon_type, data.weapon_model || '', data.notes || '', data.status, data.weaponId]
    );

    const officerName = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;

    emit('mdt:server:log', {
      action: 'Weapon Registration Updated',
      officer: officerName,
      details: `Weapon ID: ${data.weaponId}`,
    });

    return { success: true };
  } catch (error) {
    console.error('[MDT] Error updating weapon registration:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// Update Weapon Status
// ==========================================

onClientCallback('mdt:updateWeaponStatus', (source: number, data: { weaponId: number; status: string }): ApiResponse => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  if (!canManageWeapons(player)) {
    return { success: false, message: 'Insufficient rank to update weapon status' };
  }

  try {
    // Get current weapon info from SQLite
    const weapon = SQLite.single<{ serial_number: string; citizen_id: string; status: string }>(
      'SELECT serial_number, citizen_id, status FROM mdt_weapon_registry WHERE id = ?',
      [data.weaponId]
    );

    if (!weapon) {
      return { success: false, message: 'Weapon not found' };
    }

    SQLite.update('UPDATE mdt_weapon_registry SET status = ? WHERE id = ?', [data.status, data.weaponId]);

    const officerName = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;

    emit('mdt:server:log', {
      action: 'Weapon Status Updated',
      officer: officerName,
      target: weapon.citizen_id,
      details: `Serial: ${weapon.serial_number} | ${weapon.status} -> ${data.status}`,
    });

    // Notify officers based on status change
    if (data.status === 'stolen') {
      notifyLeoOfficers(
        'Weapon Reported Stolen',
        `Serial: ${weapon.serial_number}`,
        'warning',
        Config.NotificationDurations.StolenWeaponAlert
      );
    } else if (data.status === 'active' && weapon.status === 'stolen') {
      notifyLeoOfficers(
        'Stolen Weapon Recovered',
        `Serial: ${weapon.serial_number}`,
        'success',
        Config.NotificationDurations.WeaponRecovered
      );
    }

    return { success: true };
  } catch (error) {
    console.error('[MDT] Error updating weapon status:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// Change Weapon Owner
// ==========================================

onClientCallback('mdt:changeWeaponOwner', (source: number, data: { weaponId: number; newCitizenId: string }): ApiResponse => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  if (!canManageWeapons(player)) {
    return { success: false, message: 'Insufficient rank to change weapon ownership' };
  }

  if (!data.weaponId || !data.newCitizenId) {
    return { success: false, message: 'Missing required data' };
  }

  try {
    const weapon = SQLite.single<{ serial_number: string; citizen_id: string }>(
      'SELECT serial_number, citizen_id FROM mdt_weapon_registry WHERE id = ?',
      [data.weaponId]
    );

    if (!weapon) {
      return { success: false, message: 'Weapon not found' };
    }

    SQLite.update('UPDATE mdt_weapon_registry SET citizen_id = ? WHERE id = ?', [data.newCitizenId, data.weaponId]);

    const officerName = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;

    emit('mdt:server:log', {
      action: 'Weapon Owner Changed',
      officer: officerName,
      target: data.newCitizenId,
      details: `Serial: ${weapon.serial_number} | From: ${weapon.citizen_id} -> To: ${data.newCitizenId}`,
    });

    return { success: true };
  } catch (error) {
    console.error('[MDT] Error changing weapon owner:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// Delete Weapon Registration
// ==========================================

onClientCallback('mdt:deleteWeaponRegistration', (source: number, data: { weaponId: number }): ApiResponse => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  if (!canDeleteWeapons(player)) {
    return { success: false, message: 'Insufficient rank to delete weapon registrations' };
  }

  try {
    const weapon = SQLite.single<{ serial_number: string; citizen_id: string }>(
      'SELECT serial_number, citizen_id FROM mdt_weapon_registry WHERE id = ?',
      [data.weaponId]
    );

    if (!weapon) {
      return { success: false, message: 'Weapon not found' };
    }

    SQLite.update('DELETE FROM mdt_weapon_registry WHERE id = ?', [data.weaponId]);

    const officerName = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;

    emit('mdt:server:log', {
      action: 'Weapon Registration Deleted',
      officer: officerName,
      target: weapon.citizen_id,
      details: `Serial: ${weapon.serial_number}`,
    });

    return { success: true };
  } catch (error) {
    console.error('[MDT] Error deleting weapon registration:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// Exports for other resources
// ==========================================

exports('CheckWeaponRegistration', async (serialNumber: string): Promise<WeaponRegistration | null> => {
  if (!serialNumber) return null;

  try {
    const result = SQLite.single<{
      id: number;
      citizen_id: string;
      weapon_type: string;
      weapon_model: string;
      serial_number: string;
      registration_date: string;
      notes: string;
      status: string;
    }>(
      `SELECT id, citizen_id, weapon_type, weapon_model, serial_number,
              registration_date, notes, status
       FROM mdt_weapon_registry WHERE serial_number = ?`,
      [serialNumber]
    );

    if (!result) return null;

    const ownerName = await getOwnerName(result.citizen_id);

    return {
      id: result.id,
      citizen_id: result.citizen_id,
      owner_name: ownerName,
      weapon_type: result.weapon_type,
      weapon_model: result.weapon_model || '',
      serial_number: result.serial_number,
      registration_date: result.registration_date,
      notes: result.notes || '',
      status: result.status as WeaponRegistration['status'],
    };
  } catch (error) {
    console.error('[MDT] Error checking weapon registration:', error);
    return null;
  }
});

exports('GetCitizenWeapons', (citizenid: string): WeaponRegistration[] => {
  if (!citizenid) return [];

  try {
    const weapons = SQLite.query<{
      id: number;
      weapon_type: string;
      weapon_model: string;
      serial_number: string;
      registration_date: string;
      status: string;
    }>(
      `SELECT id, weapon_type, weapon_model, serial_number, registration_date, status
       FROM mdt_weapon_registry WHERE citizen_id = ?
       ORDER BY registration_date DESC`,
      [citizenid]
    );

    return (weapons || []).map(w => ({
      id: w.id,
      citizen_id: citizenid,
      owner_name: '',
      weapon_type: w.weapon_type,
      weapon_model: w.weapon_model || '',
      serial_number: w.serial_number,
      registration_date: w.registration_date,
      notes: '',
      status: w.status as WeaponRegistration['status'],
    }));
  } catch (error) {
    console.error('[MDT] Error getting citizen weapons:', error);
    return [];
  }
});
