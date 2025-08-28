-- client/main.lua
local isMDTOpen = false

-- Function to get player info
local function getPlayerInfo()
    local playerData = exports.qbx_core:GetPlayerData()
    if playerData and playerData.job and playerData.job.type == 'leo' then
        -- Extract rank number from the grade level
        local rankNum = playerData.job.grade.level or 0
        local rankString = playerData.job.grade.name .. ' (' .. tostring(rankNum) .. ')'
        
        return {
            name = playerData.charinfo.firstname .. ' ' .. playerData.charinfo.lastname,
            callsign = playerData.metadata.callsign or 'NO CALLSIGN',
            department = playerData.job.label,
            rank = rankString,
            jobName = playerData.job.name,
            gradeLevel = rankNum
        }
    end
    return nil
end

-- Command to open MDT
RegisterCommand('mdt', function()
    local playerData = exports.qbx_core:GetPlayerData()
    
    -- Check if player is LEO
    if not playerData or not playerData.job or playerData.job.type ~= 'leo' then
        exports.qbx_core:Notify('You must be a law enforcement officer to use the MDT', 'error')
        return
    end
    
    -- Check if on duty
    if not playerData.job.onduty then
        exports.qbx_core:Notify('You must be on duty to access the MDT', 'error')
        return
    end
    
    isMDTOpen = not isMDTOpen
    
    if isMDTOpen then
        -- Send player info when opening MDT
        local playerInfo = getPlayerInfo()
        if playerInfo then
            SendNUI('updatePlayerInfo', playerInfo)
        end
        
        -- Request online officers when opening MDT
        lib.callback('mdt:getOnlineOfficers', false, function(officers)
            if officers then
                SendNUI('updateOnlineOfficers', officers)
            end
        end)
    end
    
    ShowNUI('setVisibleMDT', isMDTOpen)
end, false)

-- Key mapping for MDT (default: F3)
RegisterKeyMapping('mdt', 'Open MDT', 'keyboard', 'F3')

-- Handle closing MDT from UI
RegisterNuiCallback('closeMDT', function(data, cb)
    isMDTOpen = false
    cb(true)
end)

-- Update online officers periodically
CreateThread(function()
    while true do
        Wait(5000) -- Update every 5 seconds
        if isMDTOpen then
            lib.callback('mdt:getOnlineOfficers', false, function(officers)
                if officers then
                    SendNUI('updateOnlineOfficers', officers)
                end
            end)
        end
    end
end)

-- Listen for online officer updates from server
RegisterNetEvent('mdt:updateOnlineOfficers', function(officers)
    if isMDTOpen then
        SendNUI('updateOnlineOfficers', officers)
    end
end)

-- Update player info when job changes
RegisterNetEvent('QBCore:Player:SetPlayerData', function(PlayerData)
    if isMDTOpen and PlayerData.job then
        local playerInfo = getPlayerInfo()
        if playerInfo then
            SendNUI('updatePlayerInfo', playerInfo)
        end
    end
end)