import Config from '@common/config';
import { Greetings, DebugLog } from '@common/index';
import { cache, onClientCallback } from '@communityox/ox_lib/server';
import type { Officer, QBXPlayer } from '@common/types';

// Import server modules
import './db';
import './profiles';
import './vehicles';
import './weapons';
import './reports';
import './announcements';
import './bolos';
import './fines';
import './dispatch';

Greetings();

// ==========================================
// Activity Tracking
// ==========================================

interface OfficerActivityData {
  lastPosition: { x: number; y: number; z: number };
  lastMoveTime: number;
}

const OfficerActivity: Map<number, OfficerActivityData> = new Map();

const ActivityConfig = Config.ActivityTracking || {
  InactivityTimeout: 5,
  UpdateInterval: 10,
  MovementThreshold: 5.0,
};

// Startup debug info
if (Config.Debug) {
  console.log('^2[MDT] ========================================^0');
  console.log('^2[MDT] Mobile Data Terminal Initialized^0');
  console.log('^3[MDT] Debug Mode: ENABLED^0');
  console.log(`^3[MDT]   - InactivityTimeout: ${ActivityConfig.InactivityTimeout} seconds^0`);
  console.log(`^3[MDT]   - UpdateInterval: ${ActivityConfig.UpdateInterval} seconds^0`);
  console.log(`^3[MDT]   - MovementThreshold: ${ActivityConfig.MovementThreshold} units^0`);
  console.log('^2[MDT] ========================================^0');
}

// Helper function to check if officer is inactive
function IsOfficerInactive(source: number): boolean {
  const activity = OfficerActivity.get(source);

  if (!activity || !activity.lastMoveTime) {
    if (Config.Debug) {
      DebugLog(`Player ${source}: No activity record - returning INACTIVE`, 'trace');
    }
    return true;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const timeSinceMove = currentTime - activity.lastMoveTime;
  const isInactive = timeSinceMove >= ActivityConfig.InactivityTimeout;

  if (Config.Debug) {
    DebugLog(`Player ${source}: timeSinceMove=${timeSinceMove}, timeout=${ActivityConfig.InactivityTimeout}, isInactive=${isInactive}`, 'trace');
  }

  return isInactive;
}

// Update officer position (called from client)
onNet('mdt:server:updateOfficerPosition', (position: { x: number; y: number; z: number }) => {
  const src = source as number;

  if (Config.Debug) {
    DebugLog(`Received position update from player ${src}`, 'trace');
  }

  if (!position || typeof position !== 'object' || !position.x || !position.y || !position.z) {
    if (Config.Debug) {
      DebugLog(`Player ${src}: Invalid position data`, 'error');
    }
    return;
  }

  const Player = exports.qbx_core.GetPlayer(src) as QBXPlayer | null;

  if (!Player?.PlayerData?.job || Player.PlayerData.job.type !== 'leo' || !Player.PlayerData.job.onduty) {
    return;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const activity = OfficerActivity.get(src);

  if (!activity) {
    OfficerActivity.set(src, {
      lastPosition: position,
      lastMoveTime: currentTime,
    });
    if (Config.Debug) {
      DebugLog(`Player ${src}: FIRST position update registered`, 'info');
    }
    return;
  }

  // Check movement distance
  const lastPos = activity.lastPosition;
  const dx = position.x - lastPos.x;
  const dy = position.y - lastPos.y;
  const dz = position.z - lastPos.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (distance >= ActivityConfig.MovementThreshold) {
    activity.lastMoveTime = currentTime;
    if (Config.Debug) {
      DebugLog(`Player ${src}: Moved ${distance.toFixed(2)} units - ACTIVITY RESET`, 'info');
    }
  }

  activity.lastPosition = position;
});

// Clean up activity tracking when player disconnects
on('playerDropped', () => {
  const src = source as number;
  if (OfficerActivity.has(src)) {
    if (Config.Debug) {
      DebugLog(`Player ${src} disconnected - removing activity record`, 'info');
    }
    OfficerActivity.delete(src);
  }
});

// Get online LEO officers (with activity status)
onClientCallback('mdt:getOnlineOfficers', (source: number): Officer[] => {
  if (Config.Debug) {
    DebugLog(`Callback mdt:getOnlineOfficers called by player ${source}`, 'trace');
  }

  const officers: Officer[] = [];
  const players = exports.qbx_core.GetQBPlayers() as Record<number, QBXPlayer>;

  for (const [, player] of Object.entries(players)) {
    if (player?.PlayerData?.job?.type === 'leo' && player.PlayerData.job.onduty) {
      const callsign = player.PlayerData.metadata.callsign || Config.Defaults.Callsign;
      const playerId = player.PlayerData.source;
      const isInactive = IsOfficerInactive(playerId);

      officers.push({
        id: playerId,
        name: `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`,
        callsign,
        department: player.PlayerData.job.label,
        jobName: player.PlayerData.job.name,
        rank: player.PlayerData.job.grade.name,
        isInactive,
      });
    }
  }

  if (Config.Debug) {
    DebugLog(`Returning ${officers.length} LEO officers`, 'trace');
  }

  return officers;
});

// Build officers list helper
function BuildOfficersList(): Officer[] {
  const officers: Officer[] = [];
  const players = exports.qbx_core.GetQBPlayers() as Record<number, QBXPlayer>;

  for (const [, player] of Object.entries(players)) {
    if (player?.PlayerData?.job?.type === 'leo' && player.PlayerData.job.onduty) {
      const callsign = player.PlayerData.metadata.callsign || Config.Defaults.Callsign;
      const playerId = player.PlayerData.source;
      const isInactive = IsOfficerInactive(playerId);

      officers.push({
        id: playerId,
        name: `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`,
        callsign,
        department: player.PlayerData.job.label,
        jobName: player.PlayerData.job.name,
        rank: player.PlayerData.job.grade.name,
        isInactive,
      });
    }
  }

  return officers;
}

// Listen for job updates
onNet('QBCore:Server:OnJobUpdate', (src: number) => {
  if (Config.Debug) {
    DebugLog(`QBCore:Server:OnJobUpdate triggered for player ${src}`, 'trace');
  }
  const officers = BuildOfficersList();
  emitNet('mdt:updateOnlineOfficers', -1, officers);
});

// Listen for duty toggle
onNet('QBCore:ToggleDuty', () => {
  const src = source as number;
  if (Config.Debug) {
    DebugLog(`QBCore:ToggleDuty triggered for player ${src}`, 'trace');
  }
  setTimeout(() => {
    const officers = BuildOfficersList();
    emitNet('mdt:updateOnlineOfficers', -1, officers);
  }, 100);
});

// Debug command
if (Config.Debug) {
  RegisterCommand(
    'mdtactivity',
    () => {
      console.log('^2[MDT] Current Officer Activity Status:^0');
      console.log('^2[MDT] ========================================^0');

      let count = 0;
      for (const [playerId, activity] of OfficerActivity.entries()) {
        count++;
        const currentTime = Math.floor(Date.now() / 1000);
        const timeSinceMove = currentTime - (activity.lastMoveTime || 0);
        const isInactive = IsOfficerInactive(playerId);
        console.log(`^3[MDT] Player ${playerId}: lastMove=${timeSinceMove}s ago, inactive=${isInactive}^0`);
      }

      if (count === 0) {
        console.log('^3[MDT] No officers in activity tracking table^0');
      }

      console.log('^2[MDT] ========================================^0');
      console.log(`^2[MDT] Total tracked: ${count} officers^0`);
    },
    true
  );

  console.log('^2[MDT] Debug command registered: /mdtactivity (console only)^0');
}

// Export the cache for other modules
export { cache, Config, OfficerActivity, IsOfficerInactive, BuildOfficersList };
