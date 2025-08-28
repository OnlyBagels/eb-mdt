-- server/mdt_officers.lua

-- Get online LEO officers
lib.callback.register('mdt:getOnlineOfficers', function(source)
    local officers = {}
    local players = exports.qbx_core:GetQBPlayers()
    
    for _, player in pairs(players) do
        if player and player.PlayerData and player.PlayerData.job.type == 'leo' and player.PlayerData.job.onduty then
            -- Get callsign from metadata
            local callsign = player.PlayerData.metadata.callsign or 'NO CALLSIGN'
            
            table.insert(officers, {
                id = player.PlayerData.source,
                name = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname,
                callsign = callsign,
                department = player.PlayerData.job.label,
                rank = player.PlayerData.job.grade.name
            })
        end
    end
    
    return officers
end)

-- You can also listen for job updates to push real-time updates
RegisterNetEvent('QBCore:Server:OnJobUpdate', function(source, job)
    -- When someone's job changes, update all open MDTs
    local players = exports.qbx_core:GetQBPlayers()
    local officers = {}
    
    for _, player in pairs(players) do
        if player and player.PlayerData and player.PlayerData.job.type == 'leo' and player.PlayerData.job.onduty then
            local callsign = player.PlayerData.metadata.callsign or 'NO CALLSIGN'
            
            table.insert(officers, {
                id = player.PlayerData.source,
                name = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname,
                callsign = callsign,
                department = player.PlayerData.job.label,
                rank = player.PlayerData.job.grade.name
            })
        end
    end
    
    -- Send update to all clients
    TriggerClientEvent('mdt:updateOnlineOfficers', -1, officers)
end)

-- Listen for duty toggle
RegisterNetEvent('QBCore:ToggleDuty', function()
    local src = source
    -- Small delay to ensure duty status is updated
    SetTimeout(100, function()
        local players = exports.qbx_core:GetQBPlayers()
        local officers = {}
        
        for _, player in pairs(players) do
            if player and player.PlayerData and player.PlayerData.job.type == 'leo' and player.PlayerData.job.onduty then
                local callsign = player.PlayerData.metadata.callsign or 'NO CALLSIGN'
                
                table.insert(officers, {
                    id = player.PlayerData.source,
                    name = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname,
                    callsign = callsign,
                    department = player.PlayerData.job.label,
                    rank = player.PlayerData.job.grade.name
                })
            end
        end
        
        -- Send update to all clients
        TriggerClientEvent('mdt:updateOnlineOfficers', -1, officers)
    end)
end)