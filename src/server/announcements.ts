// Announcements server module
// Uses SQLite for mdt_announcements table
import Config from '@common/config';
import { DebugLog } from '@common/index';
import { onClientCallback } from '@communityox/ox_lib/server';
import { SQLite, extractParam } from './db';
import type { QBXPlayer, Announcement, AnnouncementsResponse, ApiResponse } from '@common/types';

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

function canManageAnnouncements(player: QBXPlayer): boolean {
  const jobName = player.PlayerData.job.name.toLowerCase();
  const gradeLevel = player.PlayerData.job.grade.level || 0;
  const requiredRank = Config.RankRequirements.AnnouncementManagement[jobName as keyof typeof Config.RankRequirements.AnnouncementManagement];

  return requiredRank !== undefined && gradeLevel >= requiredRank;
}

// ==========================================
// Get Announcements
// ==========================================

onClientCallback('mdt:getAnnouncements', (source: number): AnnouncementsResponse | null => {
  const player = isPlayerAuthorized(source);
  if (!player) return null;

  try {
    // SQLite uses different syntax for date comparison and ordering
    const announcements = SQLite.query<Announcement>(
      `SELECT
         id, title, content, author, author_citizenid, department,
         importance, created_at, expires_at
       FROM mdt_announcements
       WHERE expires_at IS NULL OR expires_at > datetime('now')
       ORDER BY
         CASE importance
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
           ELSE 5
         END,
         created_at DESC
       LIMIT ?`,
      [Config.QueryLimits.Announcements]
    );

    const canManage = canManageAnnouncements(player);
    const playerCitizenId = player.PlayerData.citizenid;

    // Add canDelete property
    const announcementsWithPermissions = (announcements || []).map(announcement => ({
      ...announcement,
      canDelete: canManage || announcement.author_citizenid === playerCitizenId,
    }));

    return {
      announcements: announcementsWithPermissions,
      canCreate: canManage,
    };
  } catch (error) {
    console.error('[MDT] Error fetching announcements:', error);
    return { announcements: [], canCreate: false };
  }
});

// ==========================================
// Create Announcement
// ==========================================

onClientCallback('mdt:createAnnouncement', (source: number, data: {
  title: string;
  content: string;
  importance?: string;
  duration?: number;
}): ApiResponse => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  if (!canManageAnnouncements(player)) {
    return { success: false, message: 'Insufficient rank to create announcements' };
  }

  if (!data.title || data.title === '') {
    return { success: false, message: 'Title is required' };
  }

  if (!data.content || data.content === '') {
    return { success: false, message: 'Content is required' };
  }

  const authorName = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;
  const authorCitizenId = player.PlayerData.citizenid;
  const department = player.PlayerData.job.label;

  // Calculate expiry if duration provided (in hours)
  let expiresAt: string | null = null;
  if (data.duration && Number(data.duration) > 0) {
    const expiryTime = new Date(Date.now() + Number(data.duration) * 3600 * 1000);
    expiresAt = expiryTime.toISOString().slice(0, 19).replace('T', ' ');
  }

  try {
    const result = SQLite.insert(
      `INSERT INTO mdt_announcements (title, content, author, author_citizenid, department, importance, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        data.content,
        authorName,
        authorCitizenId,
        department,
        data.importance || Config.Defaults.AnnouncementImportance,
        expiresAt,
      ]
    );

    if (result) {
      emit('mdt:server:log', {
        action: 'Announcement Created',
        officer: authorName,
        details: `Title: ${data.title} | Importance: ${data.importance || 'medium'}`,
      });

      // Notify all online officers
      const players = exports.qbx_core.GetQBPlayers() as Record<number, QBXPlayer>;
      for (const [, targetPlayer] of Object.entries(players)) {
        if (targetPlayer?.PlayerData?.job?.type === 'leo' && targetPlayer.PlayerData.job.onduty) {
          emitNet('mdt:announcementCreated', targetPlayer.PlayerData.source, {
            title: data.title,
            importance: data.importance || 'medium',
            author: authorName,
          });
        }
      }

      return { success: true, data: { id: result } };
    }

    return { success: false, message: 'Failed to create announcement' };
  } catch (error) {
    console.error('[MDT] Error creating announcement:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// Delete Announcement
// ==========================================

onClientCallback('mdt:deleteAnnouncement', (source: number, data: unknown): ApiResponse => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  const announcementId = typeof data === 'number' ? data : extractParam<number>(data, 'announcementId') || 0;
  if (!announcementId) return { success: false, message: 'Invalid announcement ID' };

  // Get announcement details
  const announcement = SQLite.single<{ author_citizenid: string; title: string }>(
    'SELECT author_citizenid, title FROM mdt_announcements WHERE id = ?',
    [announcementId]
  );

  if (!announcement) {
    return { success: false, message: 'Announcement not found' };
  }

  const canManage = canManageAnnouncements(player);
  const isAuthor = announcement.author_citizenid === player.PlayerData.citizenid;

  if (!canManage && !isAuthor) {
    return { success: false, message: 'You can only delete your own announcements' };
  }

  try {
    SQLite.update('DELETE FROM mdt_announcements WHERE id = ?', [announcementId]);

    const officerName = `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;

    emit('mdt:server:log', {
      action: 'Announcement Deleted',
      officer: officerName,
      details: `Title: ${announcement.title}`,
    });

    // Notify clients to refresh
    emitNet('mdt:refreshAnnouncements', -1);

    return { success: true };
  } catch (error) {
    console.error('[MDT] Error deleting announcement:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// Update Announcement
// ==========================================

onClientCallback('mdt:updateAnnouncement', (source: number, data: {
  id: number;
  title: string;
  content: string;
  importance: string;
}): ApiResponse => {
  const player = isPlayerAuthorized(source);
  if (!player) return { success: false, message: 'Not authorized' };

  const announcement = SQLite.single<{ author_citizenid: string }>(
    'SELECT author_citizenid FROM mdt_announcements WHERE id = ?',
    [data.id]
  );

  if (!announcement) {
    return { success: false, message: 'Announcement not found' };
  }

  const isAuthor = announcement.author_citizenid === player.PlayerData.citizenid;
  if (!isAuthor && !canManageAnnouncements(player)) {
    return { success: false, message: 'Not authorized to edit this announcement' };
  }

  try {
    SQLite.update(
      'UPDATE mdt_announcements SET title = ?, content = ?, importance = ? WHERE id = ?',
      [data.title, data.content, data.importance, data.id]
    );

    emitNet('mdt:refreshAnnouncements', -1);

    return { success: true };
  } catch (error) {
    console.error('[MDT] Error updating announcement:', error);
    return { success: false, message: 'Database error' };
  }
});

// ==========================================
// Cleanup Expired Announcements
// ==========================================

// Run every 5 minutes
setInterval(() => {
  try {
    const result = SQLite.update(
      "DELETE FROM mdt_announcements WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')",
      []
    );

    if (result && result > 0) {
      console.log(`[MDT] Cleaned up ${result} expired announcements`);
      emitNet('mdt:refreshAnnouncements', -1);
    }
  } catch (error) {
    console.error('[MDT] Error cleaning up expired announcements:', error);
  }
}, Config.RefreshIntervals.ExpiredAnnouncements);
