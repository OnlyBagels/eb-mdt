-- server/announcements.lua

-- Define minimum ranks required to manage announcements per department
local ANNOUNCEMENT_RANKS = {
    ['lspd'] = 11,      -- Sergeant and above
    ['bcso'] = 10,      -- Sergeant and above
    ['sasp'] = 5,      -- Corporal and above
    ['usms'] = 4,      -- Deputy Marshal and above
}

-- Helper function to check if player can manage announcements
local function canManageAnnouncements(player)
    if not player or not player.PlayerData.job.type == 'leo' or not player.PlayerData.job.onduty then
        return false
    end
    
    local jobName = player.PlayerData.job.name:lower()
    local gradeLevel = player.PlayerData.job.grade.level or 0
    local requiredRank = ANNOUNCEMENT_RANKS[jobName]
    
    return requiredRank and gradeLevel >= requiredRank
end

-- Get all active announcements
lib.callback.register('mdt:getAnnouncements', function(source)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player is LEO and on duty
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return nil
    end
    
    -- Get announcements that haven't expired
    local query = [[
        SELECT 
            id,
            title,
            content,
            author,
            author_citizenid,
            department,
            importance,
            created_at,
            expires_at
        FROM mdt_announcements
        WHERE expires_at IS NULL OR expires_at > NOW()
        ORDER BY 
            FIELD(importance, 'critical', 'high', 'medium', 'low'),
            created_at DESC
        LIMIT 50
    ]]
    
    local announcements = exports.oxmysql:fetchSync(query, {})
    
    -- Add permission info for each announcement
    local canManage = canManageAnnouncements(player)
    local playerCitizenId = player.PlayerData.citizenid
    
    if announcements then
        for _, announcement in ipairs(announcements) do
            -- Player can delete if they have permission OR they created the announcement
            announcement.canDelete = canManage or announcement.author_citizenid == playerCitizenId
        end
    end
    
    return {
        announcements = announcements or {},
        canCreate = canManage
    }
end)

-- Create new announcement
lib.callback.register('mdt:createAnnouncement', function(source, data)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player has permission
    if not canManageAnnouncements(player) then
        return {success = false, message = "Insufficient rank to create announcements"}
    end
    
    -- Validate data
    if not data.title or data.title == '' then
        return {success = false, message = "Title is required"}
    end
    
    if not data.content or data.content == '' then
        return {success = false, message = "Content is required"}
    end
    
    -- Prepare author info
    local authorName = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname
    local authorCitizenId = player.PlayerData.citizenid
    local department = player.PlayerData.job.label
    
    -- Calculate expiry if duration is provided (in hours)
    local expiresAt = nil
    if data.duration and tonumber(data.duration) > 0 then
        -- MySQL DATE_ADD equivalent
        expiresAt = os.date('%Y-%m-%d %H:%M:%S', os.time() + (tonumber(data.duration) * 3600))
    end
    
    -- Insert announcement
    local insertQuery = [[
        INSERT INTO mdt_announcements (title, content, author, author_citizenid, department, importance, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ]]
    
    local result = exports.oxmysql:insertSync(insertQuery, {
        data.title,
        data.content,
        authorName,
        authorCitizenId,
        department,
        data.importance or 'medium',
        expiresAt
    })
    
    if result then
        -- Log the action
        TriggerEvent('mdt:server:log', {
            action = 'Announcement Created',
            officer = authorName,
            details = 'Title: ' .. data.title .. ' | Importance: ' .. (data.importance or 'medium')
        })
        
        -- Notify all online officers
        local players = exports.qbx_core:GetQBPlayers()
        for _, targetPlayer in pairs(players) do
            if targetPlayer and targetPlayer.PlayerData and targetPlayer.PlayerData.job.type == 'leo' and targetPlayer.PlayerData.job.onduty then
                TriggerClientEvent('mdt:announcementCreated', targetPlayer.PlayerData.source, {
                    title = data.title,
                    importance = data.importance or 'medium',
                    author = authorName
                })
            end
        end
        
        return {success = true, id = result}
    end
    
    return {success = false, message = "Failed to create announcement"}
end)

-- Delete announcement
lib.callback.register('mdt:deleteAnnouncement', function(source, announcementId)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return {success = false, message = "Not authorized"}
    end
    
    -- Get announcement details first
    local checkQuery = [[
        SELECT author_citizenid, title
        FROM mdt_announcements
        WHERE id = ?
    ]]
    
    local announcement = exports.oxmysql:fetchSync(checkQuery, {announcementId})
    
    if not announcement or not announcement[1] then
        return {success = false, message = "Announcement not found"}
    end
    
    local canManage = canManageAnnouncements(player)
    local isAuthor = announcement[1].author_citizenid == player.PlayerData.citizenid
    
    -- Check if player can delete (has permission OR is the author)
    if not canManage and not isAuthor then
        return {success = false, message = "You can only delete your own announcements"}
    end
    
    -- Delete the announcement
    local deleteQuery = [[
        DELETE FROM mdt_announcements
        WHERE id = ?
    ]]
    
    local result = exports.oxmysql:executeSync(deleteQuery, {announcementId})
    
    if result and result.affectedRows and result.affectedRows > 0 then
        local officerName = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname
        
        -- Log the action
        TriggerEvent('mdt:server:log', {
            action = 'Announcement Deleted',
            officer = officerName,
            details = 'Title: ' .. announcement[1].title
        })
        
        -- Notify all online officers to refresh
        TriggerClientEvent('mdt:refreshAnnouncements', -1)
        
        return {success = true}
    end
    
    return {success = false, message = "Failed to delete announcement"}
end)

-- Update announcement (for future implementation)
lib.callback.register('mdt:updateAnnouncement', function(source, data)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if not player or not canManageAnnouncements(player) then
        return {success = false, message = "Not authorized"}
    end
    
    -- Get announcement to check ownership
    local checkQuery = [[
        SELECT author_citizenid
        FROM mdt_announcements
        WHERE id = ?
    ]]
    
    local announcement = exports.oxmysql:fetchSync(checkQuery, {data.id})
    
    if not announcement or not announcement[1] then
        return {success = false, message = "Announcement not found"}
    end
    
    -- Only author or high-ranking officers can edit
    local isAuthor = announcement[1].author_citizenid == player.PlayerData.citizenid
    if not isAuthor and not canManageAnnouncements(player) then
        return {success = false, message = "Not authorized to edit this announcement"}
    end
    
    local updateQuery = [[
        UPDATE mdt_announcements
        SET title = ?, content = ?, importance = ?
        WHERE id = ?
    ]]
    
    local result = exports.oxmysql:executeSync(updateQuery, {
        data.title,
        data.content,
        data.importance,
        data.id
    })
    
    if result and result.affectedRows and result.affectedRows > 0 then
        TriggerClientEvent('mdt:refreshAnnouncements', -1)
        return {success = true}
    end
    
    return {success = false, message = "Failed to update announcement"}
end)

-- Clean up expired announcements (run periodically)
CreateThread(function()
    while true do
        Wait(300000) -- Check every 5 minutes
        
        local deleteQuery = [[
            DELETE FROM mdt_announcements
            WHERE expires_at IS NOT NULL AND expires_at <= NOW()
        ]]
        
        local result = exports.oxmysql:executeSync(deleteQuery, {})
        
        if result and result.affectedRows and result.affectedRows > 0 then
            print(('[MDT] Cleaned up %d expired announcements'):format(result))
            -- Notify clients to refresh if any were deleted
            TriggerClientEvent('mdt:refreshAnnouncements', -1)
        end
    end
end)