-- server/mdt_officers.lua

-- Initialize MySQL using oxmysql (CRITICAL FIX)
local MySQL = exports.oxmysql

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

-- ============================================================================
-- AUTOMATIC CHARGE APPLICATION SYSTEM (with eb-banking integration)
-- ============================================================================

-- Helper function to apply charge to online player
local function applyChargeToPlayer(Player, charge, reportId)
    local citizenid = Player.PlayerData.citizenid
    local playerId = Player.PlayerData.source
    
    -- Calculate reduced fine if fineReduction is provided
    local originalFine = charge.fine
    local finalFine = originalFine
    
    if charge.fineReduction and charge.fineReduction > 0 then
        local reductionAmount = (originalFine * charge.fineReduction) / 100
        finalFine = originalFine - reductionAmount
        print(string.format("^3[MDT] Fine reduced by %d%% ($%d -> $%d)^0", charge.fineReduction, originalFine, finalFine))
    end
    
    -- Build description for transaction
    local description = string.format("MDT Fine: %s (Â§%s) - Report #%d", 
        charge.title, 
        charge.code, 
        reportId
    )
    
    -- Remove money for fine using eb-banking (allow negative balance)
    if finalFine > 0 then
        local success = exports['eb-banking']:RemoveBankMoney(
            playerId, 
            finalFine, 
            description
        )
        
        if not success then
            print(string.format("^3[MDT] Failed to charge %s ($%d) to player %s^0", charge.title, finalFine, citizenid))
            return false
        end
        
        print(string.format("^2[MDT] Charged %s $%d fine for %s (may result in negative balance)^0", citizenid, finalFine, charge.title))
    end
    
    -- Add jail time if applicable (customize based on your jail system)
    if charge.months > 0 then
        -- Convert months to seconds (1 month = 5 minutes = 300 seconds by default)
        local jailTime = charge.months * 300
        
        -- CUSTOMIZE THIS TO YOUR JAIL SYSTEM:
        -- TriggerEvent('prison:server:SetJailStatus', playerId, jailTime)
        -- exports['yourjailsystem']:JailPlayer(playerId, jailTime)
        -- TriggerEvent('qb-prison:server:SetJailTime', playerId, jailTime)
        
        print(string.format("^2[MDT] Applied %d months (%d seconds) jail time to %s^0", charge.months, jailTime, citizenid))
    end
    
    -- Log the charge to history with final fine
    MySQL:insert('INSERT INTO mdt_charge_history (citizenid, charge_code, charge_title, fine, months, report_id, applied_at) VALUES (?, ?, ?, ?, ?, ?, NOW())', {
        citizenid,
        charge.code,
        charge.title,
        finalFine,  -- Log the reduced fine
        charge.months,
        reportId
    })
    
    -- NO NOTIFICATIONS TO PLAYER - Silent charge application
    
    return true
end

-- Helper function to save offline charges
local function saveOfflineCharge(citizenid, charge, reportId)
    -- Calculate reduced fine if fineReduction is provided
    local originalFine = charge.fine
    local finalFine = originalFine
    
    if charge.fineReduction and charge.fineReduction > 0 then
        local reductionAmount = (originalFine * charge.fineReduction) / 100
        finalFine = originalFine - reductionAmount
        print(string.format("^3[MDT] Offline charge - Fine reduced by %d%% ($%d -> $%d)^0", charge.fineReduction, originalFine, finalFine))
    end
    
    MySQL:insert('INSERT INTO mdt_pending_charges (citizenid, charge_code, charge_title, fine, months, report_id, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())', {
        citizenid,
        charge.code,
        charge.title,
        finalFine,  -- Save the reduced fine
        charge.months,
        reportId
    })
    
    print(string.format("^3[MDT] Saved pending charge for offline player %s: %s ($%d)^0", citizenid, charge.title, finalFine))
end

-- Apply charges from report to players
lib.callback.register('mdt:server:applyChargesFromReport', function(source, data)
    local charges = data.charges
    local reportId = data.reportId
    
    if not charges or #charges == 0 then
        return { success = false, message = "No charges to apply" }
    end

    print(string.format("^4[MDT] Processing %d charges from Report #%d^0", #charges, reportId))

    local appliedCount = 0
    local failedCount = 0
    local offlineCount = 0
    
    for _, charge in ipairs(charges) do
        local citizenid = charge.citizenid
        
        -- Get the player by citizenid
        local Player = exports.qbx_core:GetPlayerByCitizenId(citizenid)
        
        if Player then
            -- Player is online, apply charges directly
            local success = applyChargeToPlayer(Player, charge, reportId)
            if success then
                appliedCount = appliedCount + 1
            else
                failedCount = failedCount + 1
            end
        else
            -- Player is offline, save charges to database
            saveOfflineCharge(citizenid, charge, reportId)
            offlineCount = offlineCount + 1
        end
    end
    
    print(string.format("^2[MDT] Charge application complete: %d applied, %d offline, %d failed^0", appliedCount, offlineCount, failedCount))
    
    return { 
        success = true, 
        appliedCount = appliedCount,
        offlineCount = offlineCount,
        failedCount = failedCount,
        message = string.format("Applied %d charges (%d offline, %d failed)", appliedCount + offlineCount, offlineCount, failedCount)
    }
end)

-- Apply pending charges when player logs in (SILENTLY)
RegisterNetEvent('QBCore:Server:OnPlayerLoaded', function()
    local src = source
    local Player = exports.qbx_core:GetPlayer(src)
    if not Player then return end
    
    local citizenid = Player.PlayerData.citizenid
    
    -- Check for pending charges
    local pendingCharges = MySQL:query('SELECT * FROM mdt_pending_charges WHERE citizenid = ?', { citizenid })
    
    if pendingCharges and #pendingCharges > 0 then
        print(string.format("^4[MDT] Applying %d pending charges for %s^0", #pendingCharges, citizenid))
        
        local appliedCount = 0
        local totalFine = 0
        local totalMonths = 0
        
        for _, charge in ipairs(pendingCharges) do
            local success = applyChargeToPlayer(Player, charge, charge.report_id)
            if success then
                appliedCount = appliedCount + 1
                totalFine = totalFine + charge.fine
                totalMonths = totalMonths + charge.months
            end
        end
        
        -- Delete applied pending charges
        MySQL:execute('DELETE FROM mdt_pending_charges WHERE citizenid = ?', { citizenid })
        
        -- NO NOTIFICATION TO PLAYER - Silent application
        
        print(string.format("^2[MDT] Applied %d pending charges for %s (Total: $%d, %d months)^0", appliedCount, citizenid, totalFine, totalMonths))
    end
end)
-- Get citizen charges history
lib.callback.register('mdt:server:getCitizenCharges', function(source, citizenid)
    if not citizenid then
        return { success = false, message = "No citizen ID provided" }
    end
    
    -- Get all charges for this citizen from charge history
    local charges = MySQL:query([[
        SELECT 
            ch.id,
            ch.charge_code,
            ch.charge_title,
            ch.fine,
            ch.months,
            ch.report_id,
            ch.applied_at,
            r.report_number,
            r.title as report_title
        FROM mdt_charge_history ch
        LEFT JOIN mdt_reports r ON ch.report_id = r.id
        WHERE ch.citizenid = ?
        ORDER BY ch.applied_at DESC
    ]], { citizenid })
    
    if charges then
        return { success = true, charges = charges }
    else
        return { success = false, message = "Failed to fetch charges" }
    end
end)