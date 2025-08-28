-- client/announcements.lua

-- NUI Callbacks for announcement operations

-- Get all announcements
RegisterNuiCallback('getAnnouncements', function(data, cb)
    lib.callback('mdt:getAnnouncements', false, function(result)
        cb(result or {announcements = {}, canCreate = false})
    end)
end)

-- Create new announcement
RegisterNuiCallback('createAnnouncement', function(data, cb)
    lib.callback('mdt:createAnnouncement', false, function(result)
        cb(result)
    end, data)
end)

-- Delete announcement
RegisterNuiCallback('deleteAnnouncement', function(data, cb)
    lib.callback('mdt:deleteAnnouncement', false, function(result)
        cb(result)
    end, data.id)
end)

-- Update announcement (for future use)
RegisterNuiCallback('updateAnnouncement', function(data, cb)
    lib.callback('mdt:updateAnnouncement', false, function(result)
        cb(result)
    end, data)
end)

-- Listen for announcement refresh events
RegisterNetEvent('mdt:refreshAnnouncements', function()
    SendNUI('refreshAnnouncements', {})
end)

-- Listen for new announcement notifications
RegisterNetEvent('mdt:announcementCreated', function(data)
    -- Show notification using qbx_core
    if data.importance == 'critical' then
        exports.qbx_core:Notify('CRITICAL MDT Announcement: ' .. data.title, 'error', 10000)
    elseif data.importance == 'high' then
        exports.qbx_core:Notify('Important MDT Announcement: ' .. data.title, 'warning', 8000)
    else
        exports.qbx_core:Notify('New MDT Announcement: ' .. data.title, 'info', 5000)
    end
    
    -- Send to NUI for real-time update
    SendNUI('newAnnouncement', data)
end)