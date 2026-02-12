// Dispatch server module
// Handles dispatch calls, unit management, and notifications
import Config from '@common/config';
import { DebugLog } from '@common/index';
import { onClientCallback } from '@communityox/ox_lib/server';
import { SQLite, getFormattedTimestamp, safeJsonParse, sqliteBool } from './db';
import type {
  QBXPlayer,
  DispatchCall,
  DispatchUnit,
  DispatchAlertData,
  DispatchBlipConfig,
  DispatchCallsResponse,
  DispatchApiResponse,
  Vector3,
} from '@common/types';

// Skip if dispatch is disabled
const DispatchConfig = Config.Dispatch;
if (!DispatchConfig?.Enabled) {
  console.log('^3[MDT] Dispatch module is disabled in config^0');
}

// ==========================================
// Helper Functions
// ==========================================

function generateCallId(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `CALL-${timestamp}-${random}`;
}

function isPlayerAuthorized(source: number): QBXPlayer | null {
  const player = exports.qbx_core.GetPlayer(source) as QBXPlayer | null;
  if (!player) return null;

  const jobType = player.PlayerData.job.type;
  const jobName = player.PlayerData.job.name;
  const onDuty = player.PlayerData.job.onduty;

  // Check if job is in allowed dispatch jobs
  const allowedJobs = DispatchConfig?.Jobs || [];
  const isAllowed = allowedJobs.includes(jobType) || allowedJobs.includes(jobName);

  // Check on-duty requirement
  if (DispatchConfig?.OnDutyOnly && !onDuty) {
    return null;
  }

  return isAllowed ? player : null;
}

function canReceiveDispatch(player: QBXPlayer, jobs: string[]): boolean {
  if (!player) return false;

  const jobType = player.PlayerData.job.type;
  const jobName = player.PlayerData.job.name;
  const onDuty = player.PlayerData.job.onduty;

  // Check on-duty requirement
  if (DispatchConfig?.OnDutyOnly && !onDuty) {
    return false;
  }

  // Check if player's job matches any of the dispatch target jobs
  return jobs.includes(jobType) || jobs.includes(jobName);
}

function getBlipConfig(codeName: string, customBlip?: Partial<DispatchBlipConfig>): DispatchBlipConfig {
  const blips = DispatchConfig?.Blips || {};
  const defaultBlip: DispatchBlipConfig = {
    radius: 0,
    sprite: 1,
    color: 1,
    scale: 1.0,
    length: 2,
    sound: 'dispatch',
    sound2: 'GTAO_FM_Events_Soundset',
    offset: false,
    flash: false,
  };

  const presetBlip = blips[codeName] || defaultBlip;

  // Merge custom blip settings if provided
  return {
    ...presetBlip,
    ...customBlip,
  };
}

function dbCallToDispatchCall(row: Record<string, unknown>): DispatchCall {
  const units = SQLite.query<{
    id: number;
    call_id: string;
    citizenid: string;
    name: string;
    callsign: string;
    department: string;
    attached_at: string;
  }>(
    'SELECT * FROM mdt_dispatch_units WHERE call_id = ?',
    [row.call_id as string]
  );

  return {
    id: row.id as number,
    callId: row.call_id as string,
    message: row.message as string,
    codeName: row.code_name as string,
    code: row.code as string,
    icon: row.icon as string,
    priority: row.priority as 1 | 2 | 3,
    coords: {
      x: row.coords_x as number,
      y: row.coords_y as number,
      z: row.coords_z as number,
    },
    street: row.street as string,
    gender: row.gender as string | undefined,
    weapon: row.weapon as string | undefined,
    vehicle: row.vehicle as string | undefined,
    plate: row.plate as string | undefined,
    color: row.color as string | undefined,
    vehicleClass: row.vehicle_class as string | undefined,
    doors: row.doors as number | undefined,
    heading: row.heading as number | undefined,
    camId: row.cam_id as string | undefined,
    callsign: row.callsign as string | undefined,
    name: row.name as string | undefined,
    number: row.phone_number as string | undefined,
    information: row.information as string | undefined,
    alertTime: row.alert_time as number,
    jobs: safeJsonParse(row.jobs as string, ['leo']),
    units: units.map(u => ({
      id: u.id,
      callId: u.call_id,
      citizenid: u.citizenid,
      name: u.name,
      callsign: u.callsign || '',
      department: u.department || '',
      attachedAt: u.attached_at,
    })),
    blip: safeJsonParse(row.blip_data as string, getBlipConfig('default')),
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
    isExpired: sqliteBool(row.is_expired),
    automaticGunfire: sqliteBool(row.automatic_gunfire),
  };
}

// ==========================================
// Discord Webhook
// ==========================================

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1471517359750775010/jOnkCFSesbTVCDc9w6zYysuTaNwztIFb9kv3yDgPk6-oPZbC7h00MxPxBGsy0qOgoTsF';

function sendDispatchWebhook(data: DispatchAlertData): void {
  const priority = data.priority || 2;

  // Color based on priority: 1 = red (panic/emergency), 2 = yellow (standard), 3 = green (low)
  const colorMap: Record<number, number> = {
    1: 0xFF0000, // Red - emergency/panic
    2: 0xFFAA00, // Amber - standard
    3: 0x00AA00, // Green - low priority
  };
  const embedColor = colorMap[priority] || 0xFFAA00;

  // Mirror the in-game dispatch UI exactly
  const codeName = data.codeName?.toUpperCase() || 'DISPATCH';
  const code = data.code ? `**${data.code}**\n` : '';

  // Build description to match in-game layout:
  // code (bold, top line)
  // CODENAME (title)
  // message (subtitle)
  // street (location)
  // information (if present)
  let description = `${code}**${codeName}**\n${data.message}`;

  if (data.street) {
    description += `\n${data.street}`;
  }

  if (data.information) {
    description += `\n*${data.information}*`;
  }

  const payload = {
    username: 'MDT Dispatch',
    embeds: [{
      description,
      color: embedColor,
      footer: {
        text: `Dispatch \u2022 ${data.jobs?.map(j => j.toUpperCase()).join(', ') || 'ALL'}`,
      },
      timestamp: new Date().toISOString(),
    }],
  };

  // Fire and forget - don't block dispatch for webhook
  fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => {
    if (DispatchConfig?.Debug) {
      console.error('[MDT Dispatch] Webhook error:', err);
    }
  });
}

// ==========================================
// Dispatch Notification Handler
// ==========================================

function handleDispatchNotify(data: DispatchAlertData): void {
  if (!DispatchConfig?.Enabled) return;

  const callId = generateCallId();
  const alertTime = data.alertTime || DispatchConfig.AlertTime || 120;
  const jobs = data.jobs || ['leo'];

  // Get blip configuration
  const blipConfig = getBlipConfig(data.codeName, data.alert);

  // Calculate expiry time
  const createdAt = getFormattedTimestamp();
  const expiresAt = new Date(Date.now() + alertTime * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');

  // Insert into database
  const insertId = SQLite.insert(
    `INSERT INTO mdt_dispatch_calls (
      call_id, message, code_name, code, icon, priority,
      coords_x, coords_y, coords_z, street, gender, weapon,
      vehicle, plate, color, vehicle_class, doors, heading,
      cam_id, callsign, name, phone_number, information,
      alert_time, jobs, blip_data, automatic_gunfire, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      callId,
      data.message,
      data.codeName,
      data.code || '',
      data.icon || 'fas fa-exclamation-triangle',
      data.priority || 2,
      data.coords.x,
      data.coords.y,
      data.coords.z,
      data.street || '',
      data.gender || null,
      data.weapon || null,
      data.vehicle || null,
      data.plate || null,
      data.color || null,
      data.vehicleClass || null,
      data.doors || null,
      data.heading || null,
      data.camId || null,
      data.callsign || null,
      data.name || null,
      data.number || null,
      data.information || null,
      alertTime,
      JSON.stringify(jobs),
      JSON.stringify(blipConfig),
      data.automaticGunfire ? 1 : 0,
      expiresAt,
    ]
  );

  if (!insertId) {
    console.error('[MDT Dispatch] Failed to insert dispatch call');
    return;
  }

  // Build the dispatch call object
  const dispatchCall: DispatchCall = {
    id: insertId,
    callId,
    message: data.message,
    codeName: data.codeName,
    code: data.code || '',
    icon: data.icon || 'fas fa-exclamation-triangle',
    priority: data.priority || 2,
    coords: data.coords,
    street: data.street || '',
    gender: data.gender,
    weapon: data.weapon,
    vehicle: data.vehicle,
    plate: data.plate,
    color: data.color,
    vehicleClass: data.vehicleClass,
    doors: data.doors,
    heading: data.heading,
    camId: data.camId,
    callsign: data.callsign,
    name: data.name,
    number: data.number,
    information: data.information,
    alertTime,
    jobs,
    units: [],
    blip: blipConfig,
    createdAt,
    expiresAt,
    isExpired: false,
    automaticGunfire: data.automaticGunfire,
  };

  // Notify all eligible players
  const players = exports.qbx_core.GetQBPlayers() as Record<number, QBXPlayer>;

  for (const [, player] of Object.entries(players)) {
    if (player && canReceiveDispatch(player, jobs)) {
      emitNet('mdt:dispatch:notify', player.PlayerData.source, dispatchCall);
    }
  }

  // Send Discord webhook
  sendDispatchWebhook(data);

  if (DispatchConfig?.Debug) {
    console.log(`[MDT Dispatch] New call: ${callId} - ${data.message}`);
  }
}

// Event listener wrapper
onNet('mdt:dispatch:notify', (data: DispatchAlertData) => {
  handleDispatchNotify(data);
});

// ==========================================
// Get Dispatch Calls
// ==========================================

onClientCallback('mdt:dispatch:getCalls', (source: number): DispatchCallsResponse => {
  if (!DispatchConfig?.Enabled) {
    return { calls: [], canRespond: false };
  }

  const player = isPlayerAuthorized(source);
  if (!player) {
    return { calls: [], canRespond: false };
  }

  const jobType = player.PlayerData.job.type;
  const jobName = player.PlayerData.job.name;

  // Get active calls that haven't expired
  const rows = SQLite.query<Record<string, unknown>>(
    `SELECT * FROM mdt_dispatch_calls
     WHERE is_expired = 0 AND expires_at > datetime('now')
     ORDER BY created_at DESC
     LIMIT ?`,
    [DispatchConfig.MaxCallList || 25]
  );

  // Filter calls by job
  const calls: DispatchCall[] = [];
  for (const row of rows) {
    const jobs = safeJsonParse<string[]>(row.jobs as string, []);
    if (jobs.includes(jobType) || jobs.includes(jobName)) {
      calls.push(dbCallToDispatchCall(row));
    }
  }

  return {
    calls,
    canRespond: true,
  };
});

// ==========================================
// Attach Unit to Call
// ==========================================

onClientCallback('mdt:dispatch:attachUnit', (source: number, data: { callId: string }): DispatchApiResponse => {
  if (!DispatchConfig?.Enabled) {
    return { success: false, message: 'Dispatch is disabled' };
  }

  const player = isPlayerAuthorized(source);
  if (!player) {
    return { success: false, message: 'Not authorized' };
  }

  const citizenid = player.PlayerData.citizenid;
  const name = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;
  const callsign = player.PlayerData.metadata.callsign || '';
  const department = player.PlayerData.job.label;

  // Check if call exists
  const call = SQLite.single<{ id: number }>(
    'SELECT id FROM mdt_dispatch_calls WHERE call_id = ? AND is_expired = 0',
    [data.callId]
  );

  if (!call) {
    return { success: false, message: 'Call not found or expired' };
  }

  // Check if already attached
  const existing = SQLite.single<{ id: number }>(
    'SELECT id FROM mdt_dispatch_units WHERE call_id = ? AND citizenid = ?',
    [data.callId, citizenid]
  );

  if (existing) {
    return { success: false, message: 'Already attached to this call' };
  }

  // Insert unit
  const insertId = SQLite.insert(
    `INSERT INTO mdt_dispatch_units (call_id, citizenid, name, callsign, department)
     VALUES (?, ?, ?, ?, ?)`,
    [data.callId, citizenid, name, callsign, department]
  );

  if (!insertId) {
    return { success: false, message: 'Failed to attach to call' };
  }

  // Notify all clients about the unit attachment
  const unit: DispatchUnit = {
    id: insertId,
    callId: data.callId,
    citizenid,
    name,
    callsign,
    department,
    attachedAt: getFormattedTimestamp(),
  };

  emitNet('mdt:dispatch:unitAttached', -1, { callId: data.callId, unit });

  return { success: true, data: { id: insertId } };
});

// ==========================================
// Detach Unit from Call
// ==========================================

onClientCallback('mdt:dispatch:detachUnit', (source: number, data: { callId: string }): DispatchApiResponse => {
  if (!DispatchConfig?.Enabled) {
    return { success: false, message: 'Dispatch is disabled' };
  }

  const player = isPlayerAuthorized(source);
  if (!player) {
    return { success: false, message: 'Not authorized' };
  }

  const citizenid = player.PlayerData.citizenid;

  // Remove unit
  const changes = SQLite.update(
    'DELETE FROM mdt_dispatch_units WHERE call_id = ? AND citizenid = ?',
    [data.callId, citizenid]
  );

  if (changes === 0) {
    return { success: false, message: 'Not attached to this call' };
  }

  // Notify all clients
  emitNet('mdt:dispatch:unitDetached', -1, { callId: data.callId, citizenid });

  return { success: true };
});

// ==========================================
// Get Latest Dispatch
// ==========================================

onClientCallback('mdt:dispatch:getLatest', (source: number): DispatchCall | null => {
  if (!DispatchConfig?.Enabled) return null;

  const player = isPlayerAuthorized(source);
  if (!player) return null;

  const jobType = player.PlayerData.job.type;
  const jobName = player.PlayerData.job.name;

  // Get latest active call
  const rows = SQLite.query<Record<string, unknown>>(
    `SELECT * FROM mdt_dispatch_calls
     WHERE is_expired = 0 AND expires_at > datetime('now')
     ORDER BY created_at DESC
     LIMIT 10`
  );

  // Find first call that matches player's job
  for (const row of rows) {
    const jobs = safeJsonParse<string[]>(row.jobs as string, []);
    if (jobs.includes(jobType) || jobs.includes(jobName)) {
      return dbCallToDispatchCall(row);
    }
  }

  return null;
});

// ==========================================
// Cleanup Expired Calls
// ==========================================

function cleanupExpiredCalls(): void {
  if (!DispatchConfig?.Enabled) return;

  // Get calls that are about to expire (for fade notification)
  const fadingCalls = SQLite.query<{ call_id: string; expires_at: string }>(
    `SELECT call_id, expires_at FROM mdt_dispatch_calls
     WHERE is_expired = 0
     AND datetime(expires_at) <= datetime('now', '+30 seconds')
     AND datetime(expires_at) > datetime('now')`
  );

  // Calculate opacity for fading calls
  const fadingData: { callId: string; opacity: number }[] = [];
  const now = Date.now();

  for (const call of fadingCalls) {
    const expiresAt = new Date(call.expires_at).getTime();
    const timeRemaining = expiresAt - now;
    const fadeProgress = 1 - timeRemaining / 30000; // 30 second fade window
    const opacity = Math.max(50, Math.floor(255 * (1 - fadeProgress)));
    fadingData.push({ callId: call.call_id, opacity });
  }

  if (fadingData.length > 0) {
    emitNet('mdt:dispatch:updateOpacity', -1, fadingData);
  }

  // Mark expired calls
  const expiredRows = SQLite.query<{ call_id: string }>(
    `SELECT call_id FROM mdt_dispatch_calls
     WHERE is_expired = 0 AND datetime(expires_at) <= datetime('now')`
  );

  if (expiredRows.length > 0) {
    const expiredIds = expiredRows.map(r => r.call_id);

    // Update expired status
    SQLite.update(
      `UPDATE mdt_dispatch_calls SET is_expired = 1
       WHERE is_expired = 0 AND datetime(expires_at) <= datetime('now')`
    );

    // Log to history
    for (const callId of expiredIds) {
      const call = SQLite.single<Record<string, unknown>>(
        'SELECT * FROM mdt_dispatch_calls WHERE call_id = ?',
        [callId]
      );

      if (call) {
        SQLite.insert(
          `INSERT INTO mdt_dispatch_history (call_id, message, code_name, code, priority, street, created_at, closed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            call.call_id,
            call.message,
            call.code_name,
            call.code,
            call.priority,
            call.street,
            call.created_at,
          ]
        );
      }
    }

    // Notify clients about expired calls
    emitNet('mdt:dispatch:callsExpired', -1, expiredIds);

    if (DispatchConfig?.Debug) {
      console.log(`[MDT Dispatch] Cleaned up ${expiredIds.length} expired calls`);
    }
  }

  // Clean up old history (older than 24 hours)
  SQLite.update(
    `DELETE FROM mdt_dispatch_history WHERE datetime(closed_at) < datetime('now', '-24 hours')`
  );
}

// Run cleanup every 5 seconds
if (DispatchConfig?.Enabled) {
  setInterval(cleanupExpiredCalls, 5000);
}

// ==========================================
// Emergency Commands (911/311)
// ==========================================

onNet('mdt:dispatch:emergencyCall', (data: { message: string; type: '911' | '311'; anonymous: boolean }) => {
  if (!DispatchConfig?.Enabled) return;

  const src = source as number;
  const player = exports.qbx_core.GetPlayer(src) as QBXPlayer | null;

  if (!player) return;

  // Check phone requirement
  if (DispatchConfig.PhoneRequired) {
    const hasPhone = DispatchConfig.PhoneItems.some(item =>
      exports.ox_inventory.GetItemCount(src, item) > 0
    );

    if (!hasPhone) {
      emitNet('ox_lib:notify', src, {
        title: 'No Phone',
        description: 'You need a phone to make emergency calls',
        type: 'error',
      });
      return;
    }
  }

  const coords = GetEntityCoords(GetPlayerPed(src));
  const name = data.anonymous
    ? 'Anonymous'
    : `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;
  const phone = data.anonymous ? 'Hidden' : player.PlayerData.charinfo.phone || 'Unknown';

  const jobs = data.type === '911' ? ['leo'] : ['ems'];
  const codeName = data.type === '911' ? '911call' : '311call';

  // Trigger dispatch notification
  emit('mdt:dispatch:notify', {
    message: data.anonymous ? 'Anonymous Emergency Call' : 'Emergency Call',
    codeName,
    code: data.type,
    icon: 'fas fa-phone',
    priority: 2,
    coords: { x: coords[0], y: coords[1], z: coords[2] },
    name,
    number: phone,
    information: data.message,
    alertTime: DispatchConfig.AlertTime,
    jobs,
  } as DispatchAlertData);
});

// ==========================================
// Commands
// ==========================================

if (DispatchConfig?.Enabled) {
  // Dispatch menu command
  RegisterCommand('dispatch', (source: number) => {
    if (source > 0) {
      emitNet('mdt:dispatch:openMenu', source);
    }
  }, false);

  // 911 command - args is array of strings split by space
  RegisterCommand('911', (source: number, args: string[]) => {
    if (source <= 0) return;
    const message = args.join(' ').trim();
    if (message) {
      emitNet('mdt:dispatch:emergencyCall', source, { message, type: '911', anonymous: false });
    } else {
      emitNet('ox_lib:notify', source, {
        title: '911',
        description: 'Usage: /911 [message]',
        type: 'error',
      });
    }
  }, false);

  // Anonymous 911 command
  RegisterCommand('911a', (source: number, args: string[]) => {
    if (source <= 0) return;
    const message = args.join(' ').trim();
    if (message) {
      emitNet('mdt:dispatch:emergencyCall', source, { message, type: '911', anonymous: true });
    } else {
      emitNet('ox_lib:notify', source, {
        title: '911',
        description: 'Usage: /911a [message]',
        type: 'error',
      });
    }
  }, false);

  // 311 command
  RegisterCommand('311', (source: number, args: string[]) => {
    if (source <= 0) return;
    const message = args.join(' ').trim();
    if (message) {
      emitNet('mdt:dispatch:emergencyCall', source, { message, type: '311', anonymous: false });
    } else {
      emitNet('ox_lib:notify', source, {
        title: '311',
        description: 'Usage: /311 [message]',
        type: 'error',
      });
    }
  }, false);

  // Anonymous 311 command
  RegisterCommand('311a', (source: number, args: string[]) => {
    if (source <= 0) return;
    const message = args.join(' ').trim();
    if (message) {
      emitNet('mdt:dispatch:emergencyCall', source, { message, type: '311', anonymous: true });
    } else {
      emitNet('ox_lib:notify', source, {
        title: '311',
        description: 'Usage: /311a [message]',
        type: 'error',
      });
    }
  }, false);

  // Test dispatch command (admin only)
  RegisterCommand('testdispatch', (source: number, args: string[]) => {
    if (source > 0) {
      // Check if player is admin
      const isAdmin = IsPlayerAceAllowed(source.toString(), 'command');
      if (!isAdmin) {
        emitNet('ox_lib:notify', source, {
          title: 'Access Denied',
          description: 'You do not have permission to use this command',
          type: 'error',
        });
        return;
      }
    }

    const type = args[0] || 'shooting';
    const ped = source > 0 ? GetPlayerPed(source.toString()) : null;
    let coords = { x: 200.0, y: -900.0, z: 30.0 }; // Default: near Legion Square

    if (ped) {
      const pedCoords = GetEntityCoords(ped);
      coords = { x: pedCoords[0], y: pedCoords[1], z: pedCoords[2] };
    }

    // Generate test dispatch based on type
    const testCalls: Record<string, Partial<DispatchAlertData>> = {
      shooting: {
        message: 'Test: Shots Fired',
        codeName: 'shooting',
        code: '10-71',
        icon: 'fas fa-gun',
        priority: 2,
        weapon: 'WEAPON_PISTOL',
      },
      robbery: {
        message: 'Test: Store Robbery in Progress',
        codeName: 'storeRobbery',
        code: '10-90',
        icon: 'fas fa-cash-register',
        priority: 1,
      },
      vehicletheft: {
        message: 'Test: Vehicle Theft Reported',
        codeName: 'vehicleTheft',
        code: '10-35',
        icon: 'fas fa-car',
        priority: 3,
        vehicle: 'Adder',
        plate: 'TEST123',
        color: 'Red',
      },
      pursuit: {
        message: 'Test: High Speed Pursuit',
        codeName: 'pursuit',
        code: '10-80',
        icon: 'fas fa-car-side',
        priority: 1,
        vehicle: 'Sultan RS',
        plate: 'FAST999',
        color: 'Blue',
      },
      officerdown: {
        message: 'Test: Officer Down',
        codeName: 'officerDown',
        code: '10-99',
        icon: 'fas fa-user-shield',
        priority: 1,
      },
    };

    const callData = testCalls[type.toLowerCase()] || testCalls.shooting;

    const dispatchData: DispatchAlertData = {
      message: callData.message || 'Test Dispatch',
      codeName: callData.codeName || 'test',
      code: callData.code || '10-00',
      icon: callData.icon || 'fas fa-bell',
      priority: callData.priority || 2,
      coords,
      jobs: ['police', 'leo', 'lspd', 'bcso', 'sasp', 'sast'],
      ...callData,
    };

    // Trigger the dispatch
    handleDispatchNotify(dispatchData);

    const msg = `Test dispatch '${type}' created at ${coords.x.toFixed(1)}, ${coords.y.toFixed(1)}`;
    if (source > 0) {
      emitNet('ox_lib:notify', source, {
        title: 'Test Dispatch',
        description: msg,
        type: 'success',
      });
    }
    console.log(`^2[MDT] ${msg}^0`);
  }, true);

  console.log('^2[MDT] Dispatch module initialized^0');
  console.log('^3[MDT] Test command: /testdispatch [shooting|robbery|vehicletheft|pursuit|officerdown]^0');
}

// ==========================================
// FiveM Exports for External Resources (Lua/JS)
// ==========================================

/**
 * Send a custom dispatch alert from external resources
 *
 * Lua usage:
 * exports['eb-mdt-sqlite']:CustomAlert({
 *   message = 'Store Robbery in Progress',
 *   codeName = 'storeRobbery',
 *   code = '10-90',
 *   coords = { x = 100.0, y = 200.0, z = 30.0 },
 *   jobs = { 'police', 'leo' },
 *   alertTime = 120, -- seconds (optional, defaults to config)
 *   priority = 1, -- 1-3 (optional)
 *   icon = 'fas fa-cash-register', -- (optional)
 *   street = 'Vinewood Blvd', -- (optional)
 *   information = 'Suspect armed', -- (optional)
 *   vehicle = 'Sultan RS', -- (optional)
 *   plate = 'ABC123', -- (optional)
 *   color = 'Red', -- (optional)
 *   weapon = 'WEAPON_PISTOL', -- (optional)
 *   gender = 'male', -- (optional)
 * })
 */
global.exports('CustomAlert', (data: DispatchAlertData) => {
  if (!DispatchConfig?.Enabled) {
    console.warn('[MDT] CustomAlert called but dispatch is disabled');
    return false;
  }

  if (!data || !data.message || !data.coords) {
    console.error('[MDT] CustomAlert requires at least message and coords');
    return false;
  }

  handleDispatchNotify(data);
  return true;
});

/**
 * Send a simple dispatch alert with minimal parameters
 *
 * Lua usage:
 * exports['eb-mdt-sqlite']:SendAlert(
 *   'Shots Fired',           -- message
 *   '10-71',                 -- code
 *   { x = 100.0, y = 200.0, z = 30.0 }, -- coords
 *   60,                      -- alertTime in seconds (optional)
 *   { 'police', 'leo' }      -- jobs (optional, defaults to 'leo')
 * )
 */
global.exports('SendAlert', (
  message: string,
  code: string,
  coords: Vector3,
  alertTime?: number,
  jobs?: string[]
) => {
  if (!DispatchConfig?.Enabled) {
    console.warn('[MDT] SendAlert called but dispatch is disabled');
    return false;
  }

  if (!message || !coords) {
    console.error('[MDT] SendAlert requires message and coords');
    return false;
  }

  handleDispatchNotify({
    message,
    codeName: code,
    code,
    coords,
    alertTime: alertTime || DispatchConfig.AlertTime || 120,
    jobs: jobs || ['leo'],
  });

  return true;
});

/**
 * Send a dispatch alert for a specific player's location
 *
 * Lua usage:
 * exports['eb-mdt-sqlite']:SendAlertAtPlayer(
 *   source,                  -- player server id
 *   'Robbery in Progress',   -- message
 *   '10-90',                 -- code
 *   90,                      -- alertTime in seconds (optional)
 *   { 'police' }             -- jobs (optional)
 * )
 */
global.exports('SendAlertAtPlayer', (
  playerId: number,
  message: string,
  code: string,
  alertTime?: number,
  jobs?: string[]
) => {
  if (!DispatchConfig?.Enabled) {
    console.warn('[MDT] SendAlertAtPlayer called but dispatch is disabled');
    return false;
  }

  const ped = GetPlayerPed(playerId.toString());
  if (!ped) {
    console.error(`[MDT] SendAlertAtPlayer: Player ${playerId} not found`);
    return false;
  }

  const pedCoords = GetEntityCoords(ped);
  const coords = { x: pedCoords[0], y: pedCoords[1], z: pedCoords[2] };

  handleDispatchNotify({
    message,
    codeName: code,
    code,
    coords,
    alertTime: alertTime || DispatchConfig.AlertTime || 120,
    jobs: jobs || ['leo'],
  });

  return true;
});

/**
 * Check if dispatch system is enabled
 *
 * Lua usage:
 * local isEnabled = exports['eb-mdt-sqlite']:IsDispatchEnabled()
 */
global.exports('IsDispatchEnabled', () => {
  return DispatchConfig?.Enabled || false;
});

/**
 * Get current dispatch configuration
 *
 * Lua usage:
 * local config = exports['eb-mdt-sqlite']:GetDispatchConfig()
 */
global.exports('GetDispatchConfig', () => {
  return {
    enabled: DispatchConfig?.Enabled || false,
    alertTime: DispatchConfig?.AlertTime || 120,
    jobs: DispatchConfig?.Jobs || [],
    onDutyOnly: DispatchConfig?.OnDutyOnly || false,
  };
});

// Export for use in other modules
export { generateCallId, isPlayerAuthorized, canReceiveDispatch, getBlipConfig, handleDispatchNotify };
