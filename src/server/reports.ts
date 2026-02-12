// Reports server module
// Uses SQLite for mdt_* tables, MySQL for player data joins
import Config from '@common/config';
import { DebugLog } from '@common/index';
import { onClientCallback } from '@communityox/ox_lib/server';
import { SQLite, MySQL, generateReportNumber, extractParam, sqliteBool, boolToSqlite } from './db';
import type {
  QBXPlayer, Report, DetailedReport, ReportFilters,
  CreateReportData, ApiResponse, OfficerSearchResult
} from '@common/types';

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

function canDeleteReports(player: QBXPlayer): boolean {
  const jobName = player.PlayerData.job.name.toLowerCase();
  const gradeLevel = player.PlayerData.job.grade.level || 0;
  const requiredRank = Config.RankRequirements.ReportDeletion[jobName as keyof typeof Config.RankRequirements.ReportDeletion];

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

// ==========================================
// Get Reports
// ==========================================

onClientCallback('mdt:getReports', (source: number, filters?: ReportFilters): Report[] | null => {
  const player = isPlayerAuthorized(source);
  if (!player) return null;

  let query = `
    SELECT
      r.id,
      r.report_number,
      r.title,
      r.type,
      r.status,
      r.priority,
      r.created_by,
      r.created_by_citizenid,
      r.created_at,
      r.updated_at,
      COUNT(DISTINCT ri.id) as involved_count,
      COUNT(DISTINCT rc.id) as charge_count,
      COUNT(DISTINCT re.id) as evidence_count
    FROM mdt_reports r
    LEFT JOIN mdt_report_involved ri ON r.id = ri.report_id
    LEFT JOIN mdt_report_charges rc ON r.id = rc.report_id
    LEFT JOIN mdt_report_evidence re ON r.id = re.report_id
  `;

  const whereConditions: string[] = [];
  const queryParams: unknown[] = [];

  if (filters) {
    if (filters.search && filters.search !== '') {
      whereConditions.push('(LOWER(r.report_number) LIKE ? OR LOWER(r.title) LIKE ? OR LOWER(r.content) LIKE ?)');
      const searchPattern = `%${filters.search.toLowerCase()}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    if (filters.type && filters.type !== 'all') {
      whereConditions.push('r.type = ?');
      queryParams.push(filters.type);
    }

    if (filters.status && filters.status !== 'all') {
      whereConditions.push('r.status = ?');
      queryParams.push(filters.status);
    }

    if (filters.priority && filters.priority !== 'all') {
      whereConditions.push('r.priority = ?');
      queryParams.push(filters.priority);
    }

    if (filters.dateFrom && filters.dateFrom !== '') {
      whereConditions.push('r.created_at >= ?');
      queryParams.push(filters.dateFrom);
    }

    if (filters.dateTo && filters.dateTo !== '') {
      whereConditions.push('r.created_at <= ?');
      queryParams.push(filters.dateTo);
    }
  }

  if (whereConditions.length > 0) {
    query += ' WHERE ' + whereConditions.join(' AND ');
  }

  query += ` GROUP BY r.id ORDER BY r.created_at DESC LIMIT ?`;
  queryParams.push(Config.QueryLimits.Reports);

  try {
    const reports = SQLite.query<Report>(query, queryParams);
    return reports || [];
  } catch (error) {
    console.error('[MDT] Error getting reports:', error);
    return null;
  }
});

// ==========================================
// Get Report Details
// ==========================================

onClientCallback('mdt:getReport', async (source: number, data: number | { reportId: number }): Promise<DetailedReport | null> => {
  const player = isPlayerAuthorized(source);
  if (!player) return null;

  // Handle both direct number and object with reportId
  const reportId = typeof data === 'object' && data !== null ? data.reportId : data;

  try {
    // Get main report from SQLite
    const report = SQLite.single<Report>(
      `SELECT
         id, report_number, title, type, status, priority,
         content, location, created_by, created_by_citizenid,
         created_at, updated_at, updated_by, is_ticket, ticket_data
       FROM mdt_reports WHERE id = ? LIMIT 1`,
      [reportId]
    );

    if (!report) return null;

    // Get involved parties from SQLite, then join with MySQL for player names
    const involvedRaw = SQLite.query<Record<string, unknown>>(
      `SELECT id, citizenid, name as stored_name, role FROM mdt_report_involved WHERE report_id = ?`,
      [reportId]
    );

    // Get player names from MySQL for involved parties
    const processedInvolved = [];
    for (const person of involvedRaw) {
      let name = person.stored_name as string || 'Unknown';
      let phone = '';

      if (person.citizenid) {
        const playerData = await MySQL.single<Record<string, unknown>>(
          `SELECT
             JSON_EXTRACT(charinfo, '$.firstname') as firstname,
             JSON_EXTRACT(charinfo, '$.lastname') as lastname,
             JSON_EXTRACT(charinfo, '$.phone') as phone
           FROM players WHERE citizenid = ?`,
          [person.citizenid]
        );

        if (playerData) {
          const firstname = playerData.firstname?.toString().replace(/"/g, '') || '';
          const lastname = playerData.lastname?.toString().replace(/"/g, '') || '';
          if (firstname && lastname) {
            name = `${firstname} ${lastname}`;
          } else if (firstname || lastname) {
            name = firstname || lastname;
          }
          phone = playerData.phone?.toString().replace(/"/g, '') || '';
        }
      }

      processedInvolved.push({
        id: person.id as number,
        citizenid: person.citizenid as string,
        name,
        role: person.role as 'suspect' | 'victim' | 'witness' | 'accomplice' | 'person_of_interest',
        phone: phone || undefined,
      });
    }

    // Get charges from SQLite
    const charges = SQLite.query<{
      id: number;
      citizenid: string;
      charge_code: string;
      charge_title: string;
      charge_class: string;
      fine: number;
      months: number;
      guilty_plea: number;
    }>(
      `SELECT id, citizenid, charge_code, charge_title, charge_class, fine, months, guilty_plea
       FROM mdt_report_charges WHERE report_id = ?`,
      [reportId]
    );

    // Convert SQLite boolean
    const processedCharges = charges.map(c => ({
      ...c,
      guilty_plea: sqliteBool(c.guilty_plea),
    }));

    // Get evidence from SQLite
    const evidence = SQLite.query<{
      id: number;
      type: 'photo' | 'video' | 'document' | 'audio' | 'other';
      title: string;
      description: string;
      url: string;
      added_by: string;
      added_at: string;
    }>(
      `SELECT id, type, title, description, url, added_by, added_at
       FROM mdt_report_evidence WHERE report_id = ?`,
      [reportId]
    );

    // Get officers from SQLite
    const officers = SQLite.query<{
      id: number;
      officer_name: string;
      officer_citizenid: string;
      officer_callsign: string;
    }>(
      `SELECT id, officer_name, officer_citizenid, officer_callsign
       FROM mdt_report_officers WHERE report_id = ?`,
      [reportId]
    );

    return {
      report,
      involved: processedInvolved,
      charges: processedCharges,
      evidence,
      officers,
    };
  } catch (error) {
    console.error('[MDT] Error getting report:', error);
    return null;
  }
});

// ==========================================
// Create Report
// ==========================================

onClientCallback('mdt:createReport', (source: number, data: CreateReportData): ApiResponse => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  try {
    const officerName = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;
    const officerCitizenId = player.PlayerData.citizenid;
    const reportNumber = generateReportNumber();

    // Insert main report into SQLite
    const reportId = SQLite.insert(
      `INSERT INTO mdt_reports (
         report_number, title, type, status, priority, content, location, created_by, created_by_citizenid
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reportNumber,
        data.title,
        data.type,
        data.status || Config.Defaults.ReportStatus,
        data.priority || Config.Defaults.ReportPriority,
        data.content,
        data.location,
        officerName,
        officerCitizenId,
      ]
    );

    if (!reportId) {
      return { success: false, message: 'Failed to create report' };
    }

    // Add officers
    if (data.officers && data.officers.length > 0) {
      for (const officer of data.officers) {
        SQLite.insert(
          `INSERT INTO mdt_report_officers (report_id, officer_name, officer_citizenid, officer_callsign)
           VALUES (?, ?, ?, ?)`,
          [reportId, officer.name, officer.citizenid || '', officer.callsign]
        );
      }
    }

    // Add involved parties
    if (data.involved && data.involved.length > 0) {
      for (const person of data.involved) {
        SQLite.insert(
          `INSERT INTO mdt_report_involved (report_id, citizenid, role, notes)
           VALUES (?, ?, ?, ?)`,
          [reportId, person.citizenid, person.role, person.notes || '']
        );
      }
    }

    // Add charges
    if (data.charges && data.charges.length > 0) {
      for (const charge of data.charges) {
        SQLite.insert(
          `INSERT INTO mdt_report_charges (
             report_id, citizenid, charge_code, charge_title, charge_class, fine, months, guilty_plea
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            reportId,
            charge.citizenid,
            charge.code,
            charge.title,
            charge.class,
            charge.fine,
            charge.months,
            boolToSqlite(charge.guiltyPlea || false),
          ]
        );
      }
    }

    // Add evidence
    if (data.evidence && data.evidence.length > 0) {
      for (const item of data.evidence) {
        SQLite.insert(
          `INSERT INTO mdt_report_evidence (report_id, type, title, description, url, added_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [reportId, item.type || 'other', item.title || '', item.description || '', item.url || '', officerName]
        );
      }
    }

    emit('mdt:server:log', {
      action: 'Report Created',
      officer: officerName,
      details: `Report #${reportNumber} - ${data.title}`,
    });

    notifyLeoOfficers('New Report', `Report #${reportNumber} created`, 'info', Config.NotificationDurations.NewReport);

    return { success: true, data: { reportId, reportNumber } };
  } catch (error) {
    console.error('[MDT] Error creating report:', error);
    return { success: false, message: `Server error: ${error}` };
  }
});

// ==========================================
// Update Report
// ==========================================

onClientCallback('mdt:updateReport', (source: number, data: CreateReportData & { reportId: number }): ApiResponse => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  const officerName = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;

  try {
    // Update main report in SQLite
    SQLite.update(
      `UPDATE mdt_reports
       SET title = ?, type = ?, status = ?, priority = ?, content = ?, location = ?, updated_by = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [data.title, data.type, data.status, data.priority, data.content, data.location, officerName, data.reportId]
    );

    // Update officers (delete and re-add)
    SQLite.update('DELETE FROM mdt_report_officers WHERE report_id = ?', [data.reportId]);
    if (data.officers && data.officers.length > 0) {
      for (const officer of data.officers) {
        SQLite.insert(
          `INSERT INTO mdt_report_officers (report_id, officer_name, officer_citizenid, officer_callsign)
           VALUES (?, ?, ?, ?)`,
          [data.reportId, officer.name, officer.citizenid || '', officer.callsign]
        );
      }
    }

    // Update involved (delete and re-add)
    SQLite.update('DELETE FROM mdt_report_involved WHERE report_id = ?', [data.reportId]);
    if (data.involved && data.involved.length > 0) {
      for (const person of data.involved) {
        SQLite.insert(
          `INSERT INTO mdt_report_involved (report_id, citizenid, role, notes)
           VALUES (?, ?, ?, ?)`,
          [data.reportId, person.citizenid, person.role, person.notes || '']
        );
      }
    }

    // Update charges (delete and re-add)
    SQLite.update('DELETE FROM mdt_report_charges WHERE report_id = ?', [data.reportId]);
    if (data.charges && data.charges.length > 0) {
      for (const charge of data.charges) {
        SQLite.insert(
          `INSERT INTO mdt_report_charges (
             report_id, citizenid, charge_code, charge_title, charge_class, fine, months, guilty_plea
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            data.reportId,
            charge.citizenid,
            charge.code,
            charge.title,
            charge.class,
            charge.fine,
            charge.months,
            boolToSqlite(charge.guiltyPlea || false),
          ]
        );
      }
    }

    emit('mdt:server:log', {
      action: 'Report Updated',
      officer: officerName,
      details: `Report ID: ${data.reportId}`,
    });

    return { success: true };
  } catch (error) {
    console.error('[MDT] Error updating report:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// Delete Report
// ==========================================

onClientCallback('mdt:deleteReport', (source: number, data: unknown): ApiResponse => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  const reportId = typeof data === 'number' ? data : extractParam<number>(data, 'reportId') || 0;
  if (!reportId) return { success: false, message: 'Invalid report ID' };

  if (!canDeleteReports(player)) {
    return { success: false, message: 'Insufficient rank to delete reports' };
  }

  try {
    const report = SQLite.single<{ report_number: string }>(
      'SELECT report_number FROM mdt_reports WHERE id = ?',
      [reportId]
    );

    if (!report) {
      return { success: false, message: 'Report not found' };
    }

    // Delete related data (SQLite handles foreign key cascade if enabled)
    SQLite.update('DELETE FROM mdt_report_officers WHERE report_id = ?', [reportId]);
    SQLite.update('DELETE FROM mdt_report_involved WHERE report_id = ?', [reportId]);
    SQLite.update('DELETE FROM mdt_report_charges WHERE report_id = ?', [reportId]);
    SQLite.update('DELETE FROM mdt_report_evidence WHERE report_id = ?', [reportId]);

    // Delete the report
    SQLite.update('DELETE FROM mdt_reports WHERE id = ?', [reportId]);

    const officerName = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;

    emit('mdt:server:log', {
      action: 'Report Deleted',
      officer: officerName,
      details: `Report #${report.report_number}`,
    });

    return { success: true };
  } catch (error) {
    console.error('[MDT] Error deleting report:', error);
    return { success: false, message: `Server error: ${error}` };
  }
});

// ==========================================
// Search Officers for Reports
// ==========================================

onClientCallback('mdt:searchOfficersForReport', async (source: number, data: unknown): Promise<OfficerSearchResult[] | null> => {
  const player = isPlayerAuthorized(source);
  if (!player) return null;

  const query = typeof data === 'string' ? data : extractParam<string>(data, 'query') || '';

  if (!query || query === '') return [];

  const searchPattern = `%${query.toLowerCase()}%`;

  try {
    // This queries the shared players table, so use MySQL
    const officers = await MySQL.query<Record<string, unknown>[]>(
      `SELECT
         p.citizenid,
         p.name,
         JSON_UNQUOTE(JSON_EXTRACT(p.charinfo, '$.firstname')) as firstname,
         JSON_UNQUOTE(JSON_EXTRACT(p.charinfo, '$.lastname')) as lastname,
         p.job,
         JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.callsign')) as callsign
       FROM players p
       WHERE
         JSON_UNQUOTE(JSON_EXTRACT(p.job, '$.type')) = 'leo' AND
         (LOWER(p.name) LIKE ? OR
          LOWER(p.citizenid) LIKE ? OR
          LOWER(JSON_UNQUOTE(JSON_EXTRACT(p.charinfo, '$.firstname'))) LIKE ? OR
          LOWER(JSON_UNQUOTE(JSON_EXTRACT(p.charinfo, '$.lastname'))) LIKE ? OR
          CONCAT(LOWER(JSON_UNQUOTE(JSON_EXTRACT(p.charinfo, '$.firstname'))), ' ', LOWER(JSON_UNQUOTE(JSON_EXTRACT(p.charinfo, '$.lastname')))) LIKE ? OR
          LOWER(JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.callsign'))) LIKE ?)
       LIMIT ?`,
      [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, Config.QueryLimits.OfficerSearch]
    ) || [];

    const results: OfficerSearchResult[] = [];

    for (const officer of officers) {
      const jobData = typeof officer.job === 'string' ? JSON.parse(officer.job) : officer.job;
      const callsign = (officer.callsign as string) || Config.Defaults.Callsign;

      results.push({
        citizenid: officer.citizenid as string,
        name: officer.firstname ? `${officer.firstname} ${officer.lastname}` : officer.name as string,
        callsign,
        department: jobData?.label || 'Unknown',
        rank: jobData?.grade?.name || 'Unknown',
      });
    }

    return results;
  } catch (error) {
    console.error('[MDT] Error searching officers for report:', error);
    return null;
  }
});
