// Profiles server module
// Uses SQLite for mdt_* tables, MySQL for players table
import Config from '@common/config';
import { DebugLog, DnaHash } from '@common/index';
import { onClientCallback } from '@communityox/ox_lib/server';
import { SQLite, MySQL, safeJsonParse, extractParam, getFormattedTimestamp } from './db';
import type { QBXPlayer, CitizenProfile, DetailedProfile, CitizenGang, GangTag, ApiResponse } from '@common/types';

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

function canManageLicenses(player: QBXPlayer): boolean {
  const jobName = player.PlayerData.job.name.toLowerCase();
  const gradeLevel = player.PlayerData.job.grade.level || 0;
  const requiredRank = Config.RankRequirements.LicenseManagement[jobName as keyof typeof Config.RankRequirements.LicenseManagement];
  return requiredRank !== undefined && gradeLevel >= requiredRank;
}

// ==========================================
// Profile Search
// ==========================================

onClientCallback('mdt:searchProfiles', async (source: number, data: unknown): Promise<CitizenProfile[] | null> => {
  const player = isPlayerAuthorized(source);
  if (!player) return null;

  const profiles: CitizenProfile[] = [];

  // Extract searchQuery from object or use directly if string
  const searchQuery = typeof data === 'string' ? data : extractParam<string>(data, 'searchQuery') || extractParam<string>(data, 'query') || '';

  if (!searchQuery || searchQuery === '') {
    return profiles;
  }

  const searchLower = searchQuery.trim().toLowerCase();
  const searchPattern = `%${searchLower}%`;

  // Check if searching for DNA
  const isDNASearch = searchLower.length >= Config.ValidationLimits.DNASearchMinLength && /^[0-9a-f]+$/.test(searchLower);

  let query: string;
  let params: (string | number)[];

  if (isDNASearch) {
    query = `
      SELECT DISTINCT
        p.citizenid,
        p.name,
        JSON_EXTRACT(p.charinfo, '$.firstname') as firstname,
        JSON_EXTRACT(p.charinfo, '$.lastname') as lastname,
        JSON_EXTRACT(p.charinfo, '$.birthdate') as birthdate,
        JSON_EXTRACT(p.charinfo, '$.gender') as gender,
        JSON_EXTRACT(p.charinfo, '$.nationality') as nationality,
        JSON_EXTRACT(p.charinfo, '$.phone') as phone,
        JSON_EXTRACT(p.metadata, '$.fingerprint') as fingerprint,
        p.job
      FROM players p
      WHERE
        JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.fingerprint')) LIKE ?
      LIMIT ?
    `;
    params = [searchPattern, Config.QueryLimits.ProfileSearch];
  } else {
    query = `
      SELECT DISTINCT
        p.citizenid,
        p.name,
        JSON_EXTRACT(p.charinfo, '$.firstname') as firstname,
        JSON_EXTRACT(p.charinfo, '$.lastname') as lastname,
        JSON_EXTRACT(p.charinfo, '$.birthdate') as birthdate,
        JSON_EXTRACT(p.charinfo, '$.gender') as gender,
        JSON_EXTRACT(p.charinfo, '$.nationality') as nationality,
        JSON_EXTRACT(p.charinfo, '$.phone') as phone,
        JSON_EXTRACT(p.metadata, '$.fingerprint') as fingerprint,
        p.job
      FROM players p
      WHERE
        LOWER(p.citizenid) LIKE ? OR
        LOWER(p.name) LIKE ? OR
        LOWER(JSON_UNQUOTE(JSON_EXTRACT(p.charinfo, '$.firstname'))) LIKE ? OR
        LOWER(JSON_UNQUOTE(JSON_EXTRACT(p.charinfo, '$.lastname'))) LIKE ? OR
        LOWER(CONCAT(JSON_UNQUOTE(JSON_EXTRACT(p.charinfo, '$.firstname')), ' ', JSON_UNQUOTE(JSON_EXTRACT(p.charinfo, '$.lastname')))) LIKE ? OR
        LOWER(JSON_UNQUOTE(JSON_EXTRACT(p.charinfo, '$.phone'))) LIKE ? OR
        JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.fingerprint')) LIKE ?
      LIMIT ?
    `;
    params = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, Config.QueryLimits.ProfileSearch];
  }

  try {
    // Get players from MySQL
    const results = await MySQL.query<Record<string, unknown>[]>(query, params) || [];

    for (const result of results) {
      const firstname = result.firstname?.toString().replace(/"/g, '') || '';
      const lastname = result.lastname?.toString().replace(/"/g, '') || '';
      const birthdate = result.birthdate?.toString().replace(/"/g, '') || '';
      const phone = result.phone?.toString().replace(/"/g, '') || '';
      const fingerprint = result.fingerprint?.toString().replace(/"/g, '') || '';
      const jobData = safeJsonParse<{ label?: string; grade?: { name?: string } }>(result.job as string, {});
      const citizenid = result.citizenid as string;

      // Check for warrant in SQLite
      const warrantCheck = SQLite.single<{ count: number }>(
        "SELECT COUNT(*) as count FROM mdt_warrants WHERE citizenid = ? AND status = 'active'",
        [citizenid]
      );

      // Check for gang tags in SQLite
      const gangTags = SQLite.query<{ name: string }>(
        `SELECT gt.name FROM mdt_citizen_gangs cg
         JOIN mdt_gang_tags gt ON cg.gang_id = gt.id
         WHERE cg.citizenid = ?`,
        [citizenid]
      ) || [];

      profiles.push({
        id: 0,
        citizenid,
        firstname,
        lastname,
        birthdate,
        gender: result.gender?.toString().replace(/"/g, '') || '',
        nationality: result.nationality?.toString().replace(/"/g, '') || '',
        phone,
        job: jobData.label || 'Unemployed',
        jobGrade: jobData.grade?.name || '',
        gangTags: gangTags.map(g => g.name).join(', ') || undefined,
        hasWarrant: (warrantCheck?.count || 0) > 0,
      });
    }

    return profiles;
  } catch (error) {
    console.error('[MDT] Error searching profiles:', error);
    return null;
  }
});

// ==========================================
// Get Profile Details
// ==========================================

onClientCallback('mdt:getProfile', async (source: number, data: unknown): Promise<DetailedProfile | null> => {
  const player = isPlayerAuthorized(source);
  const citizenid = typeof data === 'string' ? data : extractParam<string>(data, 'citizenid') || '';
  if (!player || !citizenid) return null;

  const isDHS = player.PlayerData.job.name === 'dhs';
  const isPilotLicenseJob = Config.PilotLicenseJobs.includes(player.PlayerData.job.name);

  // Get player data from MySQL
  const query = `
    SELECT
      p.citizenid,
      p.name,
      p.charinfo,
      p.metadata,
      p.job,
      p.gang,
      p.money,
      p.phone_number
    FROM players p
    WHERE p.citizenid = ?
    LIMIT 1
  `;

  try {
    const result = await MySQL.single<Record<string, unknown>>(query, [citizenid]);

    if (!result) return null;

    const charinfo = safeJsonParse<Record<string, unknown>>(result.charinfo as string, {});
    const metadata = safeJsonParse<Record<string, unknown>>(result.metadata as string, {});
    const jobData = safeJsonParse<Record<string, unknown>>(result.job as string, {});

    const firstname = charinfo.firstname?.toString() || '';
    const lastname = charinfo.lastname?.toString() || '';
    const birthdate = charinfo.birthdate?.toString() || '';
    const gender = charinfo.gender?.toString() || '';
    const nationality = charinfo.nationality?.toString() || '';
    const phone = charinfo.phone?.toString() || result.phone_number?.toString() || '';

    // Get DNA hash from fingerprint
    const fingerprint = metadata.fingerprint?.toString() || '';
    const dna = fingerprint ? DnaHash(fingerprint) : '';

    // Get licenses
    const licenses = safeJsonParse<Record<string, boolean>>(
      JSON.stringify(metadata.licences || metadata.licenses || {}),
      {}
    );

    // Get vehicles from MySQL
    const vehicles = await MySQL.query<Record<string, unknown>[]>(
      `SELECT id, plate, vehicle, garage, state FROM player_vehicles WHERE citizenid = ?`,
      [citizenid]
    ) || [];

    // Get registered weapons from SQLite
    const weapons = SQLite.query<Record<string, unknown>>(
      `SELECT id, weapon_type, serial_number, registration_date, status
       FROM mdt_weapon_registry WHERE citizen_id = ?`,
      [citizenid]
    ) || [];

    // Get criminal charges from SQLite (mdt_report_charges joined with mdt_reports)
    const charges = SQLite.query<Record<string, unknown>>(
      `SELECT
         rc.id, rc.report_id, rc.charge_code, rc.charge_title, rc.charge_class,
         rc.fine, rc.months, rc.guilty_plea,
         r.report_number, r.title as report_title, r.created_at, r.created_by
       FROM mdt_report_charges rc
       JOIN mdt_reports r ON rc.report_id = r.id
       WHERE rc.citizenid = ?
       ORDER BY r.created_at DESC`,
      [citizenid]
    ) || [];

    // Get profile notes from SQLite
    const notesResult = SQLite.single<{ notes: string }>(
      `SELECT notes FROM mdt_profile_notes WHERE citizenid = ?`,
      [citizenid]
    );

    // Get mugshot from SQLite
    const mugshotResult = SQLite.single<{ url: string }>(
      `SELECT url FROM mdt_profile_mugshots WHERE citizenid = ?`,
      [citizenid]
    );

    // Get gang tags from SQLite
    const gangTags = SQLite.query<{ name: string }>(
      `SELECT gt.name FROM mdt_citizen_gangs cg
       JOIN mdt_gang_tags gt ON cg.gang_id = gt.id
       WHERE cg.citizenid = ?`,
      [citizenid]
    ) || [];

    // Get warrants count from SQLite
    const warrantsCount = SQLite.single<{ count: number }>(
      "SELECT COUNT(*) as count FROM mdt_warrants WHERE citizenid = ? AND status = 'active'",
      [citizenid]
    );

    // Get arrest count from SQLite
    const arrestsCount = SQLite.single<{ count: number }>(
      `SELECT COUNT(DISTINCT rc.report_id) as count FROM mdt_report_charges rc
       JOIN mdt_reports r ON rc.report_id = r.id
       WHERE rc.citizenid = ? AND r.type = 'arrest'`,
      [citizenid]
    );

    // Get citations count from SQLite
    const citationsCount = SQLite.single<{ count: number }>(
      `SELECT COUNT(DISTINCT rc.report_id) as count FROM mdt_report_charges rc
       JOIN mdt_reports r ON rc.report_id = r.id
       WHERE rc.citizenid = ? AND (r.type = 'citation' OR r.type = 'traffic')`,
      [citizenid]
    );

    const profile: DetailedProfile = {
      id: 0,
      citizenid,
      firstname,
      lastname,
      birthdate,
      gender,
      nationality,
      phone,
      job: (jobData.label as string) || 'Unemployed',
      jobGrade: ((jobData.grade as Record<string, unknown>)?.name as string) || '',
      gangTags: gangTags.map(g => g.name).join(', ') || undefined,
      fingerprint,
      bloodType: (metadata.bloodtype as string) || 'Unknown',
      blood: (metadata.blood as number) || 100,
      dna,
      jobDuty: (jobData.onduty as boolean) || false,
      jobs: [],
      licenses,
      vehicles: vehicles.map(v => ({
        id: v.id as number,
        plate: v.plate as string,
        vehicle: v.vehicle as string,
        garage: v.garage as string,
        state: v.state as number,
      })),
      properties: [],
      criminalRecord: {
        arrests: arrestsCount?.count || 0,
        citations: citationsCount?.count || 0,
        warrants: warrantsCount?.count || 0,
      },
      registeredWeapons: weapons.map(w => ({
        id: w.id as number,
        weapon_type: w.weapon_type as string,
        serial_number: w.serial_number as string,
        registration_date: w.registration_date as string,
        status: w.status as 'active' | 'stolen' | 'destroyed' | 'lost' | 'surrendered',
      })),
      notes: notesResult?.notes || '',
      criminalCharges: charges.map(c => ({
        id: c.id as number,
        report_id: c.report_id as number,
        charge_code: c.charge_code as string,
        charge_title: c.charge_title as string,
        charge_class: c.charge_class as string,
        fine: c.fine as number,
        months: c.months as number,
        guilty_plea: c.guilty_plea as boolean,
        report_number: c.report_number as string,
        report_title: c.report_title as string,
        created_at: c.created_at as string,
        created_by: c.created_by as string,
      })),
      canManageLicenses: canManageLicenses(player),
      hasWarrant: (warrantsCount?.count || 0) > 0,
      convictionCount: charges.length,
      photoUrl: mugshotResult?.url || undefined,
    };

    return profile;
  } catch (error) {
    console.error('[MDT] Error getting profile:', error);
    return null;
  }
});

// ==========================================
// Update Profile Notes (SQLite)
// ==========================================

onClientCallback('mdt:updateProfileNotes', (source: number, data: { citizenid: string; notes: string }): ApiResponse => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  const officerName = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;
  const timestamp = getFormattedTimestamp();

  try {
    // Check if notes exist
    const existing = SQLite.single<{ id: number }>(
      'SELECT id FROM mdt_profile_notes WHERE citizenid = ?',
      [data.citizenid]
    );

    if (existing) {
      // Update existing notes
      SQLite.update(
        'UPDATE mdt_profile_notes SET notes = ?, updated_by = ?, updated_at = ? WHERE citizenid = ?',
        [data.notes, officerName, timestamp, data.citizenid]
      );
    } else {
      // Insert new notes
      SQLite.insert(
        'INSERT INTO mdt_profile_notes (citizenid, notes, updated_by, updated_at) VALUES (?, ?, ?, ?)',
        [data.citizenid, data.notes, officerName, timestamp]
      );
    }

    return { success: true };
  } catch (error) {
    console.error('[MDT] Error updating profile notes:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// Update Mugshot (SQLite)
// ==========================================

onClientCallback('mdt:updateMugshot', (source: number, data: { citizenid: string; url: string }): ApiResponse => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  const officerName = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;
  const timestamp = getFormattedTimestamp();

  try {
    // Check if mugshot exists
    const existing = SQLite.single<{ id: number }>(
      'SELECT id FROM mdt_profile_mugshots WHERE citizenid = ?',
      [data.citizenid]
    );

    if (existing) {
      // Update existing mugshot
      SQLite.update(
        'UPDATE mdt_profile_mugshots SET url = ?, uploaded_by = ?, uploaded_at = ? WHERE citizenid = ?',
        [data.url, officerName, timestamp, data.citizenid]
      );
    } else {
      // Insert new mugshot
      SQLite.insert(
        'INSERT INTO mdt_profile_mugshots (citizenid, url, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?)',
        [data.citizenid, data.url, officerName, timestamp]
      );
    }

    return { success: true };
  } catch (error) {
    console.error('[MDT] Error updating mugshot:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// License Management (via QBX Metadata API + MySQL fallback)
// ==========================================

onClientCallback('mdt:updateLicense', async (source: number, data: { citizenid: string; license: string; value: boolean }): Promise<ApiResponse> => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  if (!canManageLicenses(player)) {
    return { success: false, message: 'Insufficient rank to manage licenses' };
  }

  if (!data.citizenid || !data.license) {
    return { success: false, message: 'Missing required data' };
  }

  try {
    // Check if player is online first
    const targetPlayer = exports.qbx_core.GetPlayerByCitizenId(data.citizenid) as QBXPlayer | null;

    if (targetPlayer) {
      // Player is online - use QBX metadata API
      const currentLicences = exports.qbx_core.GetMetadata(targetPlayer.PlayerData.source, 'licences') || {};
      currentLicences[data.license] = data.value;
      exports.qbx_core.SetMetadata(targetPlayer.PlayerData.source, 'licences', currentLicences);
      console.log(`^2[MDT] License updated (online): ${data.citizenid} - ${data.license} = ${data.value}^0`);
    } else {
      // Player is offline - update directly in MySQL
      await MySQL.update(
        `UPDATE players SET metadata = JSON_SET(metadata, '$.licences.${data.license}', ?) WHERE citizenid = ?`,
        [data.value, data.citizenid]
      );
      console.log(`^2[MDT] License updated (offline/MySQL): ${data.citizenid} - ${data.license} = ${data.value}^0`);
    }

    const officerName = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;
    emit('mdt:server:log', {
      action: 'License Updated',
      officer: officerName,
      target: data.citizenid,
      details: `${data.license} set to ${data.value}`,
    });

    return { success: true };
  } catch (error) {
    console.error('[MDT] Error updating license:', error);
    return { success: false, message: 'Failed to update license' };
  }
});

// ==========================================
// Gang Tag Management (SQLite)
// ==========================================

onClientCallback('mdt:getGangTags', (source: number): GangTag[] => {
  const player = isPlayerAuthorized(source);
  if (!player) return [];

  try {
    const tags = SQLite.query<GangTag>('SELECT id, name, color FROM mdt_gang_tags ORDER BY name');
    return tags || [];
  } catch (error) {
    console.error('[MDT] Error getting gang tags:', error);
    return [];
  }
});

onClientCallback('mdt:addGangTag', (source: number, data: { citizenid: string; gangId: number; notes?: string }): ApiResponse => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  const officerName = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;
  const timestamp = getFormattedTimestamp();

  try {
    SQLite.insert(
      'INSERT INTO mdt_citizen_gangs (citizenid, gang_id, tagged_by, tagged_at, notes) VALUES (?, ?, ?, ?, ?)',
      [data.citizenid, data.gangId, officerName, timestamp, data.notes || '']
    );
    return { success: true };
  } catch (error) {
    console.error('[MDT] Error adding gang tag:', error);
    return { success: false, message: 'Database error' };
  }
});

onClientCallback('mdt:removeGangTag', (source: number, data: { citizenid: string; gangId: number }): ApiResponse => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  try {
    SQLite.update('DELETE FROM mdt_citizen_gangs WHERE citizenid = ? AND gang_id = ?', [data.citizenid, data.gangId]);
    return { success: true };
  } catch (error) {
    console.error('[MDT] Error removing gang tag:', error);
    return { success: false, message: 'Database error' };
  }
});

onClientCallback('mdt:getCitizenGangs', (source: number, data: unknown): CitizenGang[] => {
  const player = isPlayerAuthorized(source);
  if (!player) return [];

  const citizenid = typeof data === 'string' ? data : extractParam<string>(data, 'citizenid') || '';

  try {
    const gangs = SQLite.query<CitizenGang>(
      `SELECT cg.id, cg.gang_id, gt.name as gang_name, gt.color as gang_color,
              cg.tagged_by, cg.tagged_at, cg.notes
       FROM mdt_citizen_gangs cg
       JOIN mdt_gang_tags gt ON cg.gang_id = gt.id
       WHERE cg.citizenid = ?`,
      [citizenid]
    );

    return gangs || [];
  } catch (error) {
    console.error('[MDT] Error getting citizen gangs:', error);
    return [];
  }
});

// ==========================================
// Search Citizens for Reports (MySQL)
// ==========================================

onClientCallback('mdt:searchCitizensForReport', async (source: number, data: unknown): Promise<Array<{ citizenid: string; name: string; phone: string; birthdate?: string }> | null> => {
  const player = isPlayerAuthorized(source);
  if (!player) return null;

  const query = typeof data === 'string' ? data : extractParam<string>(data, 'query') || '';

  if (!query || query === '') return [];

  const searchPattern = `%${query.toLowerCase()}%`;

  const searchQuery = `
    SELECT
      citizenid,
      name,
      JSON_EXTRACT(charinfo, '$.firstname') as firstname,
      JSON_EXTRACT(charinfo, '$.lastname') as lastname,
      JSON_EXTRACT(charinfo, '$.phone') as phone,
      JSON_EXTRACT(charinfo, '$.birthdate') as birthdate,
      phone_number
    FROM players
    WHERE
      LOWER(name) LIKE ? OR
      LOWER(citizenid) LIKE ? OR
      LOWER(JSON_EXTRACT(charinfo, '$.firstname')) LIKE ? OR
      LOWER(JSON_EXTRACT(charinfo, '$.lastname')) LIKE ? OR
      CONCAT(LOWER(JSON_EXTRACT(charinfo, '$.firstname')), ' ', LOWER(JSON_EXTRACT(charinfo, '$.lastname'))) LIKE ?
    LIMIT ?
  `;

  try {
    const citizens = await MySQL.query<Record<string, unknown>[]>(searchQuery, [
      searchPattern, searchPattern, searchPattern, searchPattern, searchPattern,
      Config.QueryLimits.CitizenSearch
    ]) || [];

    const results: Array<{ citizenid: string; name: string; phone: string; birthdate?: string }> = [];

    for (const citizen of citizens) {
      // Get phone number using yseries export if available
      let phoneNumber = '';
      try {
        phoneNumber = exports.yseries.GetPhoneNumberByIdentifier(citizen.citizenid as string) || '';
      } catch {
        phoneNumber = citizen.phone_number?.toString() || citizen.phone?.toString().replace(/"/g, '') || '';
      }

      const firstname = citizen.firstname?.toString().replace(/"/g, '') || '';
      const lastname = citizen.lastname?.toString().replace(/"/g, '') || '';
      const birthdate = citizen.birthdate?.toString().replace(/"/g, '') || undefined;

      results.push({
        citizenid: citizen.citizenid as string,
        name: firstname ? `${firstname} ${lastname}` : citizen.name as string,
        phone: phoneNumber || 'Unknown',
        birthdate,
      });
    }

    return results;
  } catch (error) {
    console.error('[MDT] Error searching citizens for report:', error);
    return null;
  }
});

// ==========================================
// All Profiles (MySQL)
// ==========================================

onClientCallback('mdt:getAllProfiles', async (source: number): Promise<CitizenProfile[] | null> => {
  const player = isPlayerAuthorized(source);
  if (!player) return null;

  const query = `
    SELECT
      p.citizenid,
      p.name,
      JSON_EXTRACT(p.charinfo, '$.firstname') as firstname,
      JSON_EXTRACT(p.charinfo, '$.lastname') as lastname,
      JSON_EXTRACT(p.charinfo, '$.birthdate') as birthdate,
      JSON_EXTRACT(p.charinfo, '$.phone') as phone
    FROM players p
    LIMIT ?
  `;

  try {
    const results = await MySQL.query<Record<string, unknown>[]>(query, [Config.QueryLimits.AllProfiles]) || [];

    const profiles: CitizenProfile[] = results.map(result => ({
      id: 0,
      citizenid: result.citizenid as string,
      firstname: result.firstname?.toString().replace(/"/g, '') || '',
      lastname: result.lastname?.toString().replace(/"/g, '') || '',
      birthdate: result.birthdate?.toString().replace(/"/g, '') || '',
      gender: '',
      nationality: '',
      phone: result.phone?.toString().replace(/"/g, '') || '',
      job: '',
      jobGrade: '',
    }));

    return profiles;
  } catch (error) {
    console.error('[MDT] Error getting all profiles:', error);
    return null;
  }
});
