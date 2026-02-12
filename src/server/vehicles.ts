// Vehicles server module
// Uses SQLite for mdt_vehicle_flags, MySQL for player_vehicles and players
import Config from '@common/config';
import { DebugLog } from '@common/index';
import { onClientCallback } from '@communityox/ox_lib/server';
import { SQLite, MySQL, safeJsonParse, extractParam, sqliteBool, getFormattedTimestamp } from './db';
import type { QBXPlayer, Vehicle, DetailedVehicle, VehicleFlag, ApiResponse } from '@common/types';

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

function getGarageLabel(garageId: string | null): string {
  if (!garageId) return 'Unknown';
  const labels = Config.GarageLabels as Record<string, string>;
  return labels[garageId] || garageId;
}

function getLocationStatus(state: number): string {
  const states = Config.VehicleStates as Record<string, string>;
  return states[String(state)] || 'Unknown';
}

// ==========================================
// Search Vehicles
// ==========================================

onClientCallback('mdt:searchVehicles', async (source: number, data: unknown): Promise<Vehicle[] | null> => {
  const player = isPlayerAuthorized(source);
  if (!player) return null;

  const isDHS = Config.DHSVehicleVisibilityJobs.includes(player.PlayerData.job.name);
  const vehicles: Vehicle[] = [];

  const searchQuery = typeof data === 'string' ? data : extractParam<string>(data, 'searchQuery') || extractParam<string>(data, 'query') || '';

  if (!searchQuery || searchQuery === '') {
    return vehicles;
  }

  const searchLower = searchQuery.trim().toLowerCase();
  const searchPattern = `%${searchLower}%`;

  // Query MySQL for vehicles
  const query = `
    SELECT
      pv.id,
      pv.plate,
      pv.citizenid,
      pv.vehicle,
      pv.hash,
      pv.mods,
      pv.fakeplate,
      pv.garage,
      pv.fuel,
      pv.engine,
      pv.body,
      pv.state,
      pv.depotprice,
      pv.drivingdistance,
      pv.status,
      p.name as owner_name,
      TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.firstname'), '"', '')) as firstname,
      TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.lastname'), '"', '')) as lastname
    FROM player_vehicles pv
    LEFT JOIN players p ON pv.citizenid = p.citizenid
    WHERE
      LOWER(pv.plate) LIKE ? OR
      LOWER(pv.vehicle) LIKE ? OR
      LOWER(p.name) LIKE ? OR
      LOWER(TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.firstname'), '"', ''))) LIKE ? OR
      LOWER(TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.lastname'), '"', ''))) LIKE ? OR
      LOWER(CONCAT(
        TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.firstname'), '"', '')),
        ' ',
        TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.lastname'), '"', ''))
      )) LIKE ? OR
      LOWER(CONCAT(
        TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.lastname'), '"', '')),
        ' ',
        TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.firstname'), '"', ''))
      )) LIKE ?
    LIMIT ?
  `;

  try {
    const results = await MySQL.query<Record<string, unknown>[]>(query, [
      searchPattern, searchPattern, searchPattern, searchPattern,
      searchPattern, searchPattern, searchPattern, Config.QueryLimits.VehicleSearch
    ]) || [];

    for (const vehicle of results) {
      const vehicleId = vehicle.id as number;

      // Get active flags for this vehicle from SQLite
      const flags = SQLite.query<{
        id: number;
        vehicle_id: number;
        flag_type: string;
        description: string;
        reported_by: string;
        created_at: string;
        is_active: number;
      }>(
        `SELECT id, vehicle_id, flag_type, description, reported_by, created_at, is_active
         FROM mdt_vehicle_flags WHERE vehicle_id = ? AND is_active = 1
         ORDER BY created_at DESC`,
        [vehicleId]
      ) || [];

      const mods = safeJsonParse<{ color1?: number }>(vehicle.mods as string, {});
      const firstname = vehicle.firstname?.toString() || '';
      const lastname = vehicle.lastname?.toString() || '';

      vehicles.push({
        id: vehicleId,
        plate: vehicle.plate as string,
        citizenid: vehicle.citizenid as string,
        model: vehicle.vehicle as string,
        hash: vehicle.hash as number,
        owner: firstname && lastname
          ? `${firstname} ${lastname}`
          : (vehicle.owner_name as string) || 'Unknown',
        fakeplate: vehicle.fakeplate as string,
        garage: vehicle.garage as string,
        fuel: vehicle.fuel as number,
        engine: vehicle.engine as number,
        body: vehicle.body as number,
        state: vehicle.state as number,
        locationStatus: isDHS ? getLocationStatus(vehicle.state as number) : undefined,
        inGarage: (vehicle.state as number) === 1,
        isJobVehicle: false,
        jobVehicleRank: 0,
        isGangVehicle: false,
        gangVehicleRank: 0,
        color: mods.color1 || 0,
        canViewLocation: isDHS,
        flags: flags.map(f => ({
          id: f.id,
          vehicle_id: f.vehicle_id,
          flag_type: f.flag_type as VehicleFlag['flag_type'],
          description: f.description,
          reported_by: f.reported_by,
          created_at: f.created_at,
          is_active: sqliteBool(f.is_active),
        })),
      });
    }

    return vehicles;
  } catch (error) {
    console.error('[MDT] Error searching vehicles:', error);
    return null;
  }
});

// ==========================================
// Get Vehicle Details
// ==========================================

onClientCallback('mdt:getVehicle', async (source: number, data: unknown): Promise<DetailedVehicle | null> => {
  const player = isPlayerAuthorized(source);
  if (!player) return null;

  const vehicleId = typeof data === 'number' ? data : extractParam<number>(data, 'vehicleId') || 0;
  if (!vehicleId) return null;

  const isDHS = Config.DHSVehicleVisibilityJobs.includes(player.PlayerData.job.name);

  // Query MySQL for vehicle details
  const query = `
    SELECT
      pv.id,
      pv.plate,
      pv.citizenid,
      pv.vehicle,
      pv.hash,
      pv.mods,
      pv.fakeplate,
      pv.garage,
      pv.fuel,
      pv.engine,
      pv.body,
      pv.state,
      pv.depotprice,
      pv.drivingdistance,
      pv.status,
      p.name as owner_name,
      TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.firstname'), '"', '')) as firstname,
      TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.lastname'), '"', '')) as lastname,
      TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.phone'), '"', '')) as phone,
      TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.birthdate'), '"', '')) as birthdate
    FROM player_vehicles pv
    LEFT JOIN players p ON pv.citizenid = p.citizenid
    WHERE pv.id = ?
    LIMIT 1
  `;

  try {
    const result = await MySQL.single<Record<string, unknown>>(query, [vehicleId]);

    if (!result) return null;

    // Get all flags (both active and inactive for history) from SQLite
    const flags = SQLite.query<{
      id: number;
      vehicle_id: number;
      flag_type: string;
      description: string;
      reported_by: string;
      created_at: string;
      is_active: number;
    }>(
      `SELECT id, vehicle_id, flag_type, description, reported_by, created_at, is_active
       FROM mdt_vehicle_flags WHERE vehicle_id = ?
       ORDER BY created_at DESC`,
      [vehicleId]
    ) || [];

    const mods = safeJsonParse<Record<string, unknown>>(result.mods as string, {});
    const firstname = result.firstname?.toString() || '';
    const lastname = result.lastname?.toString() || '';
    const isInGarage = (result.state as number) === 1;

    const vehicle: DetailedVehicle = {
      id: result.id as number,
      plate: result.plate as string,
      citizenid: result.citizenid as string,
      model: result.vehicle as string,
      modelHash: result.hash as number,
      owner: firstname && lastname
        ? `${firstname} ${lastname}`
        : (result.owner_name as string) || 'Unknown',
      garage: isDHS ? getGarageLabel(result.garage as string) : undefined,
      garageId: isDHS ? result.garage as string : undefined,
      locationStatus: isDHS ? getLocationStatus(result.state as number) : undefined,
      canViewLocation: isDHS,
      fakeplate: result.fakeplate as string,
      fuel: (result.fuel as number) || 100,
      engine: (result.engine as number) || 1000,
      body: (result.body as number) || 1000,
      state: result.state as number,
      depotPrice: (result.depotprice as number) || 0,
      drivingDistance: (result.drivingdistance as number) || 0,
      status: (result.status as string) || 'Unknown',
      inGarage: isInGarage,
      isJobVehicle: false,
      jobVehicleRank: 0,
      isGangVehicle: false,
      gangVehicleRank: 0,
      mods,
      damage: {},
      glovebox: [],
      trunk: [],
      flags: flags.map(f => ({
        id: f.id,
        vehicle_id: f.vehicle_id,
        flag_type: f.flag_type as VehicleFlag['flag_type'],
        description: f.description,
        reported_by: f.reported_by,
        created_at: f.created_at,
        is_active: sqliteBool(f.is_active),
      })),
    };

    return vehicle;
  } catch (error) {
    console.error('[MDT] Error getting vehicle:', error);
    return null;
  }
});

// ==========================================
// Vehicle Flag Management (SQLite)
// ==========================================

onClientCallback('mdt:addVehicleFlag', (source: number, data: {
  vehicleId: number;
  flagType: string;
  description: string;
  flagId?: number;
}): ApiResponse => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Unauthorized' };

  const officerName = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;
  const callsign = player.PlayerData.metadata.callsign || Config.Defaults.Callsign;
  const reportedBy = `[${callsign}] ${officerName}`;
  const timestamp = getFormattedTimestamp();

  try {
    if (data.flagId) {
      // Update existing flag in SQLite
      SQLite.update(
        `UPDATE mdt_vehicle_flags SET description = ? WHERE id = ? AND vehicle_id = ?`,
        [data.description, data.flagId, data.vehicleId]
      );
      return { success: true, message: 'Flag updated successfully' };
    } else {
      // Add new flag to SQLite
      SQLite.insert(
        `INSERT INTO mdt_vehicle_flags (vehicle_id, flag_type, description, reported_by, created_at, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [data.vehicleId, data.flagType, data.description, reportedBy, timestamp]
      );
      return { success: true, message: 'Flag added successfully' };
    }
  } catch (error) {
    console.error('[MDT] Error adding vehicle flag:', error);
    return { success: false, message: 'Database error' };
  }
});

onClientCallback('mdt:removeVehicleFlag', (source: number, data: { vehicleId: number; flagId: number }): ApiResponse => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Unauthorized' };

  try {
    // Soft delete by setting is_active to 0 in SQLite
    SQLite.update(
      `UPDATE mdt_vehicle_flags SET is_active = 0 WHERE id = ? AND vehicle_id = ?`,
      [data.flagId, data.vehicleId]
    );
    return { success: true, message: 'Flag removed successfully' };
  } catch (error) {
    console.error('[MDT] Error removing vehicle flag:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// Get All Vehicle Flags (for Flags page)
// ==========================================

onClientCallback('mdt:getAllVehicleFlags', async (source: number): Promise<VehicleFlag[]> => {
  const player = isPlayerAuthorized(source);
  if (!player) return [];

  const allFlags: VehicleFlag[] = [];

  try {
    // Get MDT vehicle flags from SQLite
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
    ) || [];

    // Get plates from MySQL for each flag
    for (const flag of mdtFlags) {
      let plate = 'Unknown';
      try {
        const vehicle = await MySQL.single<{ plate: string }>(
          'SELECT plate FROM player_vehicles WHERE id = ?',
          [flag.vehicle_id]
        );
        plate = vehicle?.plate || 'Unknown';
      } catch {
        // Vehicle not found
      }

      allFlags.push({
        id: `mdt_${flag.id}`,
        vehicle_id: flag.vehicle_id,
        plate,
        flag_type: flag.flag_type as VehicleFlag['flag_type'],
        description: flag.description,
        reported_by: flag.reported_by,
        created_at: flag.created_at,
        is_active: sqliteBool(flag.is_active),
        source: 'mdt',
      });
    }

    // Get AI Pullover BOLOs if enabled (from MySQL)
    if (Config.EnableAIIntegration) {
      try {
        const bolos = await MySQL.query<Record<string, unknown>[]>(
          `SELECT
             id,
             plate,
             reason,
             officer_name,
             officer_identifier,
             created_at,
             priority,
             is_active
           FROM bolo_plates
           WHERE is_active = 1
           ORDER BY created_at DESC`
        ) || [];

        for (const bolo of bolos) {
          const reason = (bolo.reason as string) || '';
          let flagType: VehicleFlag['flag_type'] = 'bolo';

          if (reason.toLowerCase().includes('warrant')) {
            flagType = 'warrant';
          } else if (reason.toLowerCase().includes('stolen')) {
            flagType = 'stolen';
          }

          allFlags.push({
            id: `bolo_${bolo.id}`,
            plate: bolo.plate as string,
            flag_type: flagType,
            description: reason,
            reported_by: (bolo.officer_name as string) || 'SYSTEM',
            created_at: bolo.created_at as string,
            is_active: (bolo.is_active as number) === 1,
            source: 'aipullover',
            priority: bolo.priority as string,
          });
        }
      } catch (error) {
        console.error('[MDT] Error fetching AI Pullover BOLOs:', error);
      }
    }

    // Sort by creation date (newest first)
    allFlags.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return allFlags;
  } catch (error) {
    console.error('[MDT] Error getting all vehicle flags:', error);
    return [];
  }
});

// ==========================================
// Impound Vehicle (MySQL)
// ==========================================

onClientCallback('mdt:impoundVehicle', async (source: number, data: { vehicleId: number; depotPrice?: number }): Promise<ApiResponse> => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Unauthorized' };

  try {
    await MySQL.update(
      `UPDATE player_vehicles SET state = 0, depotprice = ? WHERE id = ?`,
      [data.depotPrice || 0, data.vehicleId]
    );
    return { success: true, message: 'Vehicle impounded successfully' };
  } catch (error) {
    console.error('[MDT] Error impounding vehicle:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// Get AI Integration Status
// ==========================================

onClientCallback('mdt:getAIIntegrationEnabled', (source: number): boolean => {
  const player = isPlayerAuthorized(source);
  if (!player) return false;
  return Config.EnableAIIntegration || false;
});
