-- server/weapons.lua

-- Define minimum ranks required to manage weapon registrations per department
local WEAPONS_MANAGEMENT_RANKS = {
    ['lspd'] = 1,      
    ['bcso'] = 1,      
    ['sasp'] = 1,      
    ['usms'] = 1,      
}

-- Helper function to check if player can manage weapon registrations
local function canManageWeapons(player)
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return false
    end
    
    local jobName = player.PlayerData.job.name:lower()
    local gradeLevel = player.PlayerData.job.grade.level or 0
    local requiredRank = WEAPONS_MANAGEMENT_RANKS[jobName]
    
    return requiredRank and gradeLevel >= requiredRank
end

-- Get weapon registry with filters
lib.callback.register('mdt:getWeaponRegistry', function(source, filters)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player is LEO and on duty
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return nil
    end
    
    -- Build query
    local query = [[
        SELECT 
            wr.id,
            wr.citizen_id,
            wr.weapon_type,
            wr.serial_number,
            wr.registration_date,
            wr.notes,
            wr.status,
            p.name as owner_name,
            JSON_EXTRACT(p.charinfo, '$.firstname') as firstname,
            JSON_EXTRACT(p.charinfo, '$.lastname') as lastname
        FROM mdt_weapon_registry wr
        LEFT JOIN players p ON wr.citizen_id = p.citizenid
    ]]
    
    local whereConditions = {}
    local queryParams = {}
    
    -- Apply filters
    if filters then
        if filters.search and filters.search ~= '' then
            table.insert(whereConditions, [[
                (LOWER(wr.serial_number) LIKE ? OR 
                 LOWER(wr.citizen_id) LIKE ? OR 
                 LOWER(p.name) LIKE ? OR
                 LOWER(JSON_EXTRACT(p.charinfo, '$.firstname')) LIKE ? OR
                 LOWER(JSON_EXTRACT(p.charinfo, '$.lastname')) LIKE ? OR
                 CONCAT(LOWER(JSON_EXTRACT(p.charinfo, '$.firstname')), ' ', LOWER(JSON_EXTRACT(p.charinfo, '$.lastname'))) LIKE ?)
            ]])
            local searchPattern = '%' .. string.lower(filters.search) .. '%'
            for i = 1, 6 do
                table.insert(queryParams, searchPattern)
            end
        end
        
        if filters.status and filters.status ~= '' and filters.status ~= 'all' then
            table.insert(whereConditions, "wr.status = ?")
            table.insert(queryParams, filters.status)
        end
    end
    
    if #whereConditions > 0 then
        query = query .. " WHERE " .. table.concat(whereConditions, " AND ")
    end
    
    query = query .. " ORDER BY wr.registration_date DESC LIMIT 100"
    
    local weapons = exports.oxmysql:executeSync(query, queryParams) or {}
    
    -- Format owner names
    for _, weapon in ipairs(weapons) do
        if weapon.firstname then
            weapon.owner_name = weapon.firstname .. ' ' .. weapon.lastname
        end
        weapon.firstname = nil
        weapon.lastname = nil
    end
    
    return {
        weapons = weapons,
        totalCount = #weapons,
        canManage = canManageWeapons(player)
    }
end)

-- Get specific weapon details
lib.callback.register('mdt:getWeaponDetails', function(source, weaponId)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player is LEO and on duty
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return nil
    end
    
    local query = [[
        SELECT 
            wr.id,
            wr.citizen_id,
            wr.weapon_type,
            wr.serial_number,
            wr.registration_date,
            wr.notes,
            wr.status,
            p.name as owner_name,
            JSON_EXTRACT(p.charinfo, '$.firstname') as firstname,
            JSON_EXTRACT(p.charinfo, '$.lastname') as lastname
        FROM mdt_weapon_registry wr
        LEFT JOIN players p ON wr.citizen_id = p.citizenid
        WHERE wr.id = ?
        LIMIT 1
    ]]
    
    local result = exports.oxmysql:executeSync(query, {weaponId})
    
    if result and result[1] then
        local weapon = result[1]
        if weapon.firstname then
            weapon.owner_name = weapon.firstname .. ' ' .. weapon.lastname
        end
        weapon.firstname = nil
        weapon.lastname = nil
        return weapon
    end
    
    return nil
end)

-- Register new weapon
lib.callback.register('mdt:registerWeapon', function(source, data)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player has permission
    if not canManageWeapons(player) then
        return {success = false, message = "Insufficient rank to register weapons"}
    end
    
    -- Validate data
    if not data.citizen_id or data.citizen_id == '' then
        return {success = false, message = "Citizen ID is required"}
    end
    
    if not data.weapon_type or data.weapon_type == '' then
        return {success = false, message = "Weapon type is required"}
    end
    
    if not data.serial_number or data.serial_number == '' then
        return {success = false, message = "Serial number is required"}
    end
    
    -- Check if serial number already exists
    local checkQuery = [[
        SELECT id FROM mdt_weapon_registry
        WHERE serial_number = ?
        LIMIT 1
    ]]
    
    local existing = exports.oxmysql:executeSync(checkQuery, {data.serial_number})
    
    if existing and existing[1] then
        return {success = false, message = "Serial number already exists"}
    end
    
    -- Insert new registration
    local insertQuery = [[
        INSERT INTO mdt_weapon_registry (citizen_id, weapon_type, serial_number, registration_date, notes, status)
        VALUES (?, ?, ?, NOW(), ?, ?)
    ]]
    
    local result = exports.oxmysql:insertSync(insertQuery, {
        data.citizen_id,
        data.weapon_type,
        data.serial_number,
        data.notes or '',
        data.status or 'active'
    })
    
    if result then
        local officerName = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname
        
        -- Log the action
        TriggerEvent('mdt:server:log', {
            action = 'Weapon Registered',
            officer = officerName,
            target = data.citizen_id,
            details = 'Type: ' .. data.weapon_type .. ' | Serial: ' .. data.serial_number
        })
        
        -- Notify online officers if weapon is marked as stolen
        if data.status == 'stolen' then
            local players = exports.qbx_core:GetQBPlayers()
            for _, targetPlayer in pairs(players) do
                if targetPlayer and targetPlayer.PlayerData and targetPlayer.PlayerData.job.type == 'leo' and targetPlayer.PlayerData.job.onduty then
                    TriggerClientEvent('qbx_core:notify', targetPlayer.PlayerData.source, {
                        title = 'Stolen Weapon Alert',
                        description = 'Serial: ' .. data.serial_number,
                        type = 'warning',
                        duration = 8000
                    })
                end
            end
        end
        
        return {success = true, id = result}
    end
    
    return {success = false, message = "Failed to register weapon"}
end)

-- Update weapon registration
lib.callback.register('mdt:updateWeaponRegistration', function(source, data)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player has permission
    if not canManageWeapons(player) then
        return {success = false, message = "Insufficient rank to update weapon registrations"}
    end
    
    -- Update the registration
    local updateQuery = [[
        UPDATE mdt_weapon_registry
        SET weapon_type = ?, notes = ?, status = ?
        WHERE id = ?
    ]]
    
    local result = exports.oxmysql:executeSync(updateQuery, {
        data.weapon_type,
        data.notes or '',
        data.status,
        data.weaponId
    })
    
    if result and result.affectedRows > 0 then
        local officerName = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname
        
        -- Log the action
        TriggerEvent('mdt:server:log', {
            action = 'Weapon Registration Updated',
            officer = officerName,
            details = 'Weapon ID: ' .. data.weaponId
        })
        
        return {success = true}
    end
    
    return {success = false, message = "Failed to update weapon registration"}
end)

-- Update weapon status
lib.callback.register('mdt:updateWeaponStatus', function(source, data)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player has permission
    if not canManageWeapons(player) then
        return {success = false, message = "Insufficient rank to update weapon status"}
    end
    
    -- Get current weapon info for logging
    local weaponQuery = [[
        SELECT serial_number, citizen_id, status as old_status
        FROM mdt_weapon_registry
        WHERE id = ?
    ]]
    
    local weapon = exports.oxmysql:singleSync(weaponQuery, {data.weaponId})
    
    if not weapon then
        return {success = false, message = "Weapon not found"}
    end
    
    -- Update the status
    local updateQuery = [[
        UPDATE mdt_weapon_registry
        SET status = ?
        WHERE id = ?
    ]]
    
    local result = exports.oxmysql:executeSync(updateQuery, {
        data.status,
        data.weaponId
    })
    
    if result and result.affectedRows > 0 then
        local officerName = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname
        
        -- Log the action
        TriggerEvent('mdt:server:log', {
            action = 'Weapon Status Updated',
            officer = officerName,
            target = weapon.citizen_id,
            details = 'Serial: ' .. weapon.serial_number .. ' | ' .. weapon.old_status .. ' → ' .. data.status
        })
        
        -- Notify all officers if weapon is marked as stolen
        if data.status == 'stolen' then
            local players = exports.qbx_core:GetQBPlayers()
            for _, targetPlayer in pairs(players) do
                if targetPlayer and targetPlayer.PlayerData and targetPlayer.PlayerData.job.type == 'leo' and targetPlayer.PlayerData.job.onduty then
                    TriggerClientEvent('qbx_core:notify', targetPlayer.PlayerData.source, {
                        title = 'Weapon Reported Stolen',
                        description = 'Serial: ' .. weapon.serial_number,
                        type = 'warning',
                        duration = 8000
                    })
                end
            end
        elseif data.status == 'active' and weapon.old_status == 'stolen' then
            -- Notify if recovered
            local players = exports.qbx_core:GetQBPlayers()
            for _, targetPlayer in pairs(players) do
                if targetPlayer and targetPlayer.PlayerData and targetPlayer.PlayerData.job.type == 'leo' and targetPlayer.PlayerData.job.onduty then
                    TriggerClientEvent('qbx_core:notify', targetPlayer.PlayerData.source, {
                        title = 'Stolen Weapon Recovered',
                        description = 'Serial: ' .. weapon.serial_number,
                        type = 'success',
                        duration = 5000
                    })
                end
            end
        end
        
        return {success = true}
    end
    
    return {success = false, message = "Failed to update weapon status"}
end)

-- Delete weapon registration
lib.callback.register('mdt:deleteWeaponRegistration', function(source, data)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player has permission (higher rank required for deletion)
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return {success = false, message = "Not authorized"}
    end
    
    -- Check for higher rank requirement for deletion
    local deleteRanks = {
        ['lspd'] = 6,
        ['bcso'] = 8,
        ['sasp'] = 4,
        ['usms'] = 2
    }
    
    local jobName = player.PlayerData.job.name:lower()
    local gradeLevel = player.PlayerData.job.grade.level or 0
    
    if not deleteRanks[jobName] or gradeLevel < deleteRanks[jobName] then
        return {success = false, message = "Insufficient rank to delete weapon registrations"}
    end
    
    -- Get weapon info for logging
    local weaponQuery = [[
        SELECT serial_number, citizen_id
        FROM mdt_weapon_registry
        WHERE id = ?
    ]]
    
    local weapon = exports.oxmysql:singleSync(weaponQuery, {data.weaponId})
    
    if not weapon then
        return {success = false, message = "Weapon not found"}
    end
    
    -- Delete the registration
    local deleteQuery = [[
        DELETE FROM mdt_weapon_registry
        WHERE id = ?
    ]]
    
    local result = exports.oxmysql:executeSync(deleteQuery, {data.weaponId})
    
    if result and result.affectedRows > 0 then
        local officerName = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname
        
        -- Log the action
        TriggerEvent('mdt:server:log', {
            action = 'Weapon Registration Deleted',
            officer = officerName,
            target = weapon.citizen_id,
            details = 'Serial: ' .. weapon.serial_number
        })
        
        return {success = true}
    end
    
    return {success = false, message = "Failed to delete weapon registration"}
end)

-- Check weapon by serial number (for other scripts to use)
exports('CheckWeaponRegistration', function(serialNumber)
    if not serialNumber then return nil end
    
    local query = [[
        SELECT 
            wr.*,
            p.name as owner_name,
            JSON_EXTRACT(p.charinfo, '$.firstname') as firstname,
            JSON_EXTRACT(p.charinfo, '$.lastname') as lastname
        FROM mdt_weapon_registry wr
        LEFT JOIN players p ON wr.citizen_id = p.citizenid
        WHERE wr.serial_number = ?
        LIMIT 1
    ]]
    
    local result = exports.oxmysql:singleSync(query, {serialNumber})
    
    if result then
        if result.firstname then
            result.owner_name = result.firstname .. ' ' .. result.lastname
        end
        result.firstname = nil
        result.lastname = nil
        return result
    end
    
    return nil
end)

-- Get citizen's registered weapons (for profile page)
exports('GetCitizenWeapons', function(citizenid)
    if not citizenid then return {} end
    
    local query = [[
        SELECT 
            id,
            weapon_type,
            serial_number,
            registration_date,
            status
        FROM mdt_weapon_registry
        WHERE citizen_id = ?
        ORDER BY registration_date DESC
    ]]
    
    local weapons = exports.oxmysql:executeSync(query, {citizenid})
    return weapons or {}
end)