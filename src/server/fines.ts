// Fines and Traffic Tickets server module
import Config from '@common/config';
import { DebugLog } from '@common/index';
import { onClientCallback } from '@communityox/ox_lib/server';
import { MySQL, SQLite, generateReportNumber, extractParam } from './db';
import type { QBXPlayer, TrafficTicket, ApiResponse } from '@common/types';

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

function generateSecurityKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ==========================================
// Lookup Citizen for Ticket (auto-fill)
// ==========================================

onClientCallback('mdt:lookupCitizenForTicket', async (source: number, data: unknown): Promise<{ success: boolean; citizen?: { name: string; dob: string; sex: number } }> => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false };

  const citizenid = typeof data === 'string' ? data : extractParam<string>(data, 'citizenid') || '';
  if (!citizenid) return { success: false };

  try {
    const result = await MySQL.single<Record<string, unknown>>(
      `SELECT
        JSON_EXTRACT(charinfo, '$.firstname') as firstname,
        JSON_EXTRACT(charinfo, '$.lastname') as lastname,
        JSON_EXTRACT(charinfo, '$.birthdate') as birthdate,
        JSON_EXTRACT(charinfo, '$.gender') as gender
       FROM players WHERE citizenid = ? LIMIT 1`,
      [citizenid]
    );

    if (!result) return { success: false };

    const firstname = result.firstname?.toString().replace(/"/g, '') || '';
    const lastname = result.lastname?.toString().replace(/"/g, '') || '';
    const birthdate = result.birthdate?.toString().replace(/"/g, '') || '';
    const genderStr = result.gender?.toString().replace(/"/g, '') || '0';

    // Gender: 0 = male, 1 = female (based on FiveM convention)
    const gender = genderStr === 'female' || genderStr === '1' ? 1 : 0;

    return {
      success: true,
      citizen: {
        name: `${firstname} ${lastname}`,
        dob: birthdate,
        sex: gender
      }
    };
  } catch (error) {
    console.error('[MDT] Error looking up citizen for ticket:', error);
    return { success: false };
  }
});

// ==========================================
// Issue Traffic Ticket
// ==========================================

onClientCallback('mdt:issueTrafficTicket', async (source: number, data: {
  citizenid: string;
  citizenName: string;
  citizenSex: number;
  citizenDob: string;
  fine: number;
  reason: string;
  signature: string;
}): Promise<ApiResponse> => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  const officerName = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;
  const officerBadge = player.PlayerData.metadata.callsign || Config.Defaults.Callsign;
  const officerRank = player.PlayerData.job.grade.name;
  const reportNumber = generateReportNumber();
  const securityKey = generateSecurityKey();

  // Calculate pay until date (3 days from now)
  const payUntil = new Date(Date.now() + Config.TrafficTickets.TimeToPay);
  const payUntilStr = payUntil.toISOString().slice(0, 19).replace('T', ' ');

  try {
    // Create report with ticket data
    const ticketData = {
      fine: data.fine,
      reason: data.reason,
      citizenId: data.citizenid,
      citizenName: data.citizenName,
      citizenSex: data.citizenSex,
      citizenDob: data.citizenDob,
      officerBadge,
      officerRank,
      payUntil: payUntilStr,
      signature: data.signature,
      securityKey,
      signatureTimestamp: new Date().toISOString(),
      paid: false,
      afterTime: false,
      contested: false,
    };

    const reportId = SQLite.insert(
      `INSERT INTO mdt_reports (
         report_number, title, type, status, priority, content, location,
         created_by, created_by_citizenid, is_ticket, ticket_data
       ) VALUES (?, ?, 'traffic', 'open', 'normal', ?, '', ?, ?, 1, ?)`,
      [
        reportNumber,
        `Traffic Ticket - ${data.citizenName}`,
        data.reason,
        officerName,
        player.PlayerData.citizenid,
        JSON.stringify(ticketData),
      ]
    );

    if (!reportId) {
      return { success: false, message: 'Failed to create ticket' };
    }

    // Add involved party
    SQLite.insert(
      `INSERT INTO mdt_report_involved (report_id, citizenid, role, notes)
       VALUES (?, ?, 'suspect', ?)`,
      [reportId, data.citizenid, `Traffic violation: ${data.reason}`]
    );

    // Add charge
    SQLite.insert(
      `INSERT INTO mdt_report_charges (
         report_id, citizenid, charge_code, charge_title, charge_class, fine, months, guilty_plea
       ) VALUES (?, ?, 'TC-001', ?, 'Traffic Infraction', ?, 0, 0)`,
      [reportId, data.citizenid, data.reason, data.fine]
    );

    emit('mdt:server:log', {
      action: 'Traffic Ticket Issued',
      officer: officerName,
      target: data.citizenid,
      details: `Ticket #${reportNumber} - $${data.fine} - ${data.reason}`,
    });

    return {
      success: true,
      data: {
        reportId,
        reportNumber,
        securityKey,
      },
    };
  } catch (error) {
    console.error('[MDT] Error issuing traffic ticket:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// Get Traffic Ticket
// ==========================================

onClientCallback('mdt:getTrafficTicket', async (source: number, data: unknown): Promise<TrafficTicket | null> => {
  const player = isPlayerAuthorized(source);
  if (!player) return null;

  const reportId = typeof data === 'number' ? data : extractParam<number>(data, 'reportId') || 0;
  if (!reportId) return null;

  try {
    const result = SQLite.single<Record<string, unknown>>(
      `SELECT
         id, report_number, title, content, created_at, created_by, ticket_data
       FROM mdt_reports
       WHERE id = ? AND is_ticket = 1
       LIMIT 1`,
      [reportId]
    );

    if (!result) return null;

    const ticketData = typeof result.ticket_data === 'string'
      ? JSON.parse(result.ticket_data)
      : result.ticket_data;

    return {
      id: result.id as number,
      report_number: result.report_number as string,
      title: result.title as string,
      ticket_fine: ticketData.fine,
      ticket_reason: ticketData.reason,
      ticket_citizen_id: ticketData.citizenId,
      ticket_citizen_name: ticketData.citizenName,
      ticket_citizen_sex: ticketData.citizenSex,
      ticket_citizen_dob: ticketData.citizenDob,
      ticket_officer_badge: ticketData.officerBadge,
      ticket_officer_rank: ticketData.officerRank,
      ticket_pay_until: ticketData.payUntil,
      ticket_signature: ticketData.signature,
      ticket_security_key: ticketData.securityKey,
      ticket_signature_timestamp: ticketData.signatureTimestamp,
      ticket_paid: ticketData.paid,
      ticket_after_time: ticketData.afterTime,
      ticket_contested: ticketData.contested,
      ticket_contested_at: ticketData.contestedAt || null,
      created_at: result.created_at as string,
      created_by: result.created_by as string,
    };
  } catch (error) {
    console.error('[MDT] Error getting traffic ticket:', error);
    return null;
  }
});

// ==========================================
// Pay Traffic Ticket
// ==========================================

onClientCallback('mdt:payTrafficTicket', async (source: number, data: { reportId: number; securityKey: string }): Promise<ApiResponse> => {
  // This can be called by the citizen (not just LEO)
  try {
    const result = SQLite.single<{ ticket_data: string }>(
      `SELECT ticket_data FROM mdt_reports WHERE id = ? AND is_ticket = 1`,
      [data.reportId]
    );

    if (!result) {
      return { success: false, message: 'Ticket not found' };
    }

    const ticketData = typeof result.ticket_data === 'string'
      ? JSON.parse(result.ticket_data)
      : result.ticket_data;

    if (ticketData.securityKey !== data.securityKey) {
      return { success: false, message: 'Invalid security key' };
    }

    if (ticketData.paid) {
      return { success: false, message: 'Ticket already paid' };
    }

    // Check if overdue
    const payUntil = new Date(ticketData.payUntil);
    const isOverdue = Date.now() > payUntil.getTime();
    const finalFine = isOverdue
      ? Math.floor(ticketData.fine * Config.TrafficTickets.LateFeeMultiplier)
      : ticketData.fine;

    // Update ticket data
    ticketData.paid = true;
    ticketData.afterTime = isOverdue;
    ticketData.paidAt = new Date().toISOString();
    ticketData.finalFine = finalFine;

    SQLite.update(
      `UPDATE mdt_reports SET ticket_data = ?, status = 'closed' WHERE id = ?`,
      [JSON.stringify(ticketData), data.reportId]
    );

    // Add money to society
    exports['qb-management'].AddMoney(Config.TrafficTickets.Society, finalFine);

    return { success: true, data: { finalFine, wasOverdue: isOverdue } };
  } catch (error) {
    console.error('[MDT] Error paying traffic ticket:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// Contest Traffic Ticket
// ==========================================

onClientCallback('mdt:contestTrafficTicket', async (source: number, data: { reportId: number; securityKey: string; reason: string }): Promise<ApiResponse> => {
  try {
    const result = SQLite.single<{ ticket_data: string }>(
      `SELECT ticket_data FROM mdt_reports WHERE id = ? AND is_ticket = 1`,
      [data.reportId]
    );

    if (!result) {
      return { success: false, message: 'Ticket not found' };
    }

    const ticketData = typeof result.ticket_data === 'string'
      ? JSON.parse(result.ticket_data)
      : result.ticket_data;

    if (ticketData.securityKey !== data.securityKey) {
      return { success: false, message: 'Invalid security key' };
    }

    if (ticketData.paid) {
      return { success: false, message: 'Cannot contest a paid ticket' };
    }

    if (ticketData.contested) {
      return { success: false, message: 'Ticket already contested' };
    }

    ticketData.contested = true;
    ticketData.contestedAt = new Date().toISOString();
    ticketData.contestReason = data.reason;

    SQLite.update(
      `UPDATE mdt_reports SET ticket_data = ?, status = 'pending' WHERE id = ?`,
      [JSON.stringify(ticketData), data.reportId]
    );

    return { success: true };
  } catch (error) {
    console.error('[MDT] Error contesting traffic ticket:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// Apply Fine to Player
// ==========================================

onClientCallback('mdt:applyFine', async (source: number, data: { citizenid: string; amount: number; reason: string }): Promise<ApiResponse> => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  try {
    // Get target player if online
    const targetPlayer = exports.qbx_core.GetPlayerByCitizenId(data.citizenid) as QBXPlayer | null;

    if (targetPlayer) {
      // Remove money from online player
      const currentBank = targetPlayer.PlayerData.money.bank || 0;
      if (currentBank >= data.amount) {
        targetPlayer.Functions?.RemoveMoney('bank', data.amount, data.reason);
      } else {
        // Partial bank, rest from cash
        const remaining = data.amount - currentBank;
        targetPlayer.Functions?.RemoveMoney('bank', currentBank, data.reason);
        targetPlayer.Functions?.RemoveMoney('cash', remaining, data.reason);
      }
    } else {
      // Update database directly for offline player
      await MySQL.update(
        `UPDATE players
         SET money = JSON_SET(money, '$.bank', GREATEST(0, JSON_EXTRACT(money, '$.bank') - ?))
         WHERE citizenid = ?`,
        [data.amount, data.citizenid]
      );
    }

    // Add to society
    try {
      exports['qb-management'].AddMoney(Config.TrafficTickets.Society, data.amount);
    } catch (error) {
      console.error('[MDT] Error adding fine to society:', error);
    }

    const officerName = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;

    emit('mdt:server:log', {
      action: 'Fine Applied',
      officer: officerName,
      target: data.citizenid,
      details: `$${data.amount} - ${data.reason}`,
    });

    return { success: true };
  } catch (error) {
    console.error('[MDT] Error applying fine:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// Send to Jail
// ==========================================

onClientCallback('mdt:sendToJail', async (source: number, data: { citizenid: string; months: number; charges: string }): Promise<ApiResponse> => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  // Get target player (must be online)
  const targetPlayer = exports.qbx_core.GetPlayerByCitizenId(data.citizenid) as QBXPlayer | null;

  if (!targetPlayer) {
    return { success: false, message: 'Player must be online to be jailed' };
  }

  // Calculate jail time in seconds
  const jailTimeSeconds = data.months * Config.JailMonthToSeconds;

  try {
    // Use prison system export
    exports['qbx_prison'].JailPlayer(targetPlayer.PlayerData.source, jailTimeSeconds, data.charges);

    const officerName = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;

    emit('mdt:server:log', {
      action: 'Player Jailed',
      officer: officerName,
      target: data.citizenid,
      details: `${data.months} months - ${data.charges}`,
    });

    return { success: true };
  } catch (error) {
    console.error('[MDT] Error sending player to jail:', error);
    return { success: false, message: 'Failed to jail player' };
  }
});

// ==========================================
// Check Overdue Tickets (periodic)
// ==========================================

setInterval(async () => {
  try {
    const overdueTickets = SQLite.query<{ id: number; ticket_data: string }>(
      `SELECT id, ticket_data FROM mdt_reports
       WHERE is_ticket = 1 AND status = 'open'
       AND json_extract(ticket_data, '$.paid') = 0
       AND json_extract(ticket_data, '$.payUntil') < datetime('now')`
    ) || [];

    for (const ticket of overdueTickets) {
      const ticketData = typeof ticket.ticket_data === 'string'
        ? JSON.parse(ticket.ticket_data)
        : ticket.ticket_data;

      if (!ticketData.afterTime) {
        ticketData.afterTime = true;
        ticketData.lateFee = Math.floor(ticketData.fine * (Config.TrafficTickets.LateFeeMultiplier - 1));

        SQLite.update(
          `UPDATE mdt_reports SET ticket_data = ? WHERE id = ?`,
          [JSON.stringify(ticketData), ticket.id]
        );
      }
    }
  } catch (error) {
    console.error('[MDT] Error checking overdue tickets:', error);
  }
}, Config.TrafficTickets.OverdueCheckInterval);
