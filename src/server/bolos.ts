// BOLOs server module
// Uses SQLite for mdt_vehicle_flags, MySQL for bolo_plates (AI Pullover integration)
import Config from '@common/config';
import { DebugLog } from '@common/index';
import { onClientCallback } from '@communityox/ox_lib/server';
import { SQLite, MySQL, extractParam, sqliteBool, getFormattedTimestamp } from './db';
import type { QBXPlayer, BOLO, ApiResponse } from '@common/types';

// ==========================================
// Helper Functions
// ==========================================

function isPlayerAuthorized(source: number): QBXPlayer | null {
  const player = exports.qbx_core.GetPlayer(source) as QBXPlayer | null;
  if (!player || player.PlayerData.job.type !== 'leo') {
    return null;
  }
  return player;
}

// ==========================================
// Get Active BOLOs
// ==========================================

onClientCallback('mdt:getActiveBolos', async (source: number): Promise<BOLO[]> => {
  const player = isPlayerAuthorized(source);
  if (!player) return [];

  const allBolos: BOLO[] = [];

  try {
    // Get MDT vehicle flags from SQLite mdt_vehicle_flags table
    // We need to get the plate from MySQL player_vehicles
    const mdtFlags = SQLite.query<{
      id: number;
      vehicle_id: number;
      flag_type: string;
      description: string;
      reported_by: string;
      created_at: string;
      is_active: number;
    }>(
      `SELECT id, vehicle_id, flag_type, description, reported_by, created_at, is_active
       FROM mdt_vehicle_flags
       WHERE is_active = 1
       ORDER BY created_at DESC`
    );

    // For each flag, get the plate from MySQL
    for (const flag of mdtFlags || []) {
      let plate = 'Unknown';
      try {
        const vehicle = await MySQL.single<{ plate: string }>(
          'SELECT plate FROM player_vehicles WHERE id = ?',
          [flag.vehicle_id]
        );
        plate = vehicle?.plate || 'Unknown';
      } catch {
        // Vehicle not found, use Unknown
      }

      allBolos.push({
        id: flag.id,
        plate,
        reason: flag.description,
        officer_name: flag.reported_by,
        officer_identifier: '',
        created_at: flag.created_at,
        updated_at: flag.created_at,
        is_active: sqliteBool(flag.is_active),
        priority: 'MEDIUM',
        notes: '',
        flag_type: flag.flag_type as BOLO['flag_type'],
        source: 'mdt',
      });
    }

    // Get AI Pullover BOLOs if enabled (from MySQL bolo_plates table)
    if (Config.EnableAIIntegration) {
      try {
        const bolos = await MySQL.query<Record<string, unknown>[]>(
          `SELECT
             id, plate, reason, officer_name, officer_identifier,
             created_at, updated_at, is_active, priority, notes
           FROM bolo_plates
           WHERE is_active = 1
           ORDER BY created_at DESC`
        );

        for (const bolo of (bolos || [])) {
          const reason = (bolo.reason as string) || '';
          let flagType: BOLO['flag_type'] = 'bolo';

          if (reason.toLowerCase().includes('warrant')) {
            flagType = 'warrant';
          } else if (reason.toLowerCase().includes('stolen')) {
            flagType = 'stolen';
          } else if (reason.toLowerCase().includes('suspicious')) {
            flagType = 'suspicious';
          }

          allBolos.push({
            id: bolo.id as number,
            plate: bolo.plate as string,
            reason,
            officer_name: bolo.officer_name as string,
            officer_identifier: bolo.officer_identifier as string,
            created_at: bolo.created_at as string,
            updated_at: bolo.updated_at as string,
            is_active: (bolo.is_active as number) === 1,
            priority: (bolo.priority as BOLO['priority']) || 'MEDIUM',
            notes: (bolo.notes as string) || '',
            flag_type: flagType,
            source: 'aipullover',
          });
        }
      } catch (error) {
        console.error('[MDT] Error fetching AI Pullover BOLOs:', error);
      }
    }

    // Sort by creation date (newest first)
    allBolos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (error) {
    console.error('[MDT] Error fetching BOLOs:', error);
  }

  return allBolos;
});

// ==========================================
// Create BOLO (goes to bolo_plates in MySQL)
// ==========================================

onClientCallback('mdt:createBolo', async (source: number, data: {
  plate: string;
  reason: string;
  priority?: string;
  notes?: string;
}): Promise<ApiResponse> => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  const officerName = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;
  const officerIdentifier = player.PlayerData.citizenid;

  if (!data.plate || data.plate === '') {
    return { success: false, message: 'Plate number is required' };
  }

  if (!data.reason || data.reason === '') {
    return { success: false, message: 'Reason is required' };
  }

  // Check if plate already has active BOLO (in MySQL bolo_plates)
  const existing = await MySQL.single<{ id: number }>(
    'SELECT id FROM bolo_plates WHERE plate = ? AND is_active = 1',
    [data.plate.toUpperCase()]
  );

  if (existing) {
    return { success: false, message: 'Vehicle already has an active BOLO' };
  }

  try {
    const result = await MySQL.insert(
      `INSERT INTO bolo_plates (plate, reason, officer_name, officer_identifier, is_active, priority, notes)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [
        data.plate.toUpperCase(),
        data.reason,
        officerName,
        officerIdentifier,
        data.priority || Config.Defaults.BOLOPriority,
        data.notes || '',
      ]
    );

    if (result) {
      return { success: true, data: { id: result } };
    }

    return { success: false, message: 'Failed to create BOLO' };
  } catch (error) {
    console.error('[MDT] Error creating BOLO:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// Update BOLO (MySQL bolo_plates)
// ==========================================

onClientCallback('mdt:updateBolo', async (source: number, data: {
  id: number;
  reason: string;
  priority?: string;
  notes?: string;
}): Promise<ApiResponse> => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  if (!data.id) {
    return { success: false, message: 'BOLO ID is required' };
  }

  if (!data.reason || data.reason === '') {
    return { success: false, message: 'Reason is required' };
  }

  try {
    await MySQL.update(
      `UPDATE bolo_plates
       SET reason = ?, priority = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND is_active = 1`,
      [data.reason, data.priority || 'MEDIUM', data.notes || '', data.id]
    );

    return { success: true };
  } catch (error) {
    console.error('[MDT] Error updating BOLO:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// Deactivate BOLO (MySQL bolo_plates)
// ==========================================

onClientCallback('mdt:deactivateBolo', async (source: number, data: { id: number }): Promise<ApiResponse> => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  try {
    await MySQL.update(
      'UPDATE bolo_plates SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [data.id]
    );

    return { success: true };
  } catch (error) {
    console.error('[MDT] Error deactivating BOLO:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// Get Specific BOLO (MySQL bolo_plates)
// ==========================================

onClientCallback('mdt:getBolo', async (source: number, data: unknown): Promise<BOLO | null> => {
  const player = isPlayerAuthorized(source);
  if (!player) return null;

  const boloId = typeof data === 'number' ? data : extractParam<number>(data, 'boloId') || 0;
  if (!boloId) return null;

  const result = await MySQL.single<BOLO>(
    `SELECT id, plate, reason, officer_name, officer_identifier,
            created_at, updated_at, is_active, priority, notes
     FROM bolo_plates WHERE id = ?`,
    [boloId]
  );

  return result || null;
});
