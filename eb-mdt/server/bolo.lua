-- server/bolo.lua
-- Simple BOLO system for loading/saving from YOUR existing bolo_plates table

-- Get active BOLOs
lib.callback.register('mdt:getActiveBolos', function(source)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if not player or player.PlayerData.job.type ~= 'leo' then
        return {}
    end
    
    local query = [[
        SELECT 
            id,
            plate,
            reason,
            officer_name,
            officer_identifier,
            created_at,
            updated_at,
            is_active,
            priority,
            notes
        FROM bolo_plates
        WHERE is_active = 1
        ORDER BY 
            CASE priority 
                WHEN 'CRITICAL' THEN 1
                WHEN 'HIGH' THEN 2
                WHEN 'MEDIUM' THEN 3
                WHEN 'LOW' THEN 4
                ELSE 5
            END,
            created_at DESC
    ]]
    
    local results = exports.oxmysql:executeSync(query, {})
    return results or {}
end)

-- Create new BOLO
lib.callback.register('mdt:createBolo', function(source, data)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if not player or player.PlayerData.job.type ~= 'leo' then
        return {success = false, message = "Not authorized"}
    end
    
    local officerName = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname
    local officerIdentifier = player.PlayerData.citizenid
    
    if not data.plate or data.plate == '' then
        return {success = false, message = "Plate number is required"}
    end
    
    if not data.reason or data.reason == '' then
        return {success = false, message = "Reason is required"}
    end
    
    -- Check if plate already has active BOLO
    local checkQuery = "SELECT id FROM bolo_plates WHERE plate = ? AND is_active = 1"
    local existing = exports.oxmysql:executeSync(checkQuery, {data.plate:upper()})
    
    if existing and #existing > 0 then
        return {success = false, message = "Vehicle already has an active BOLO"}
    end
    
    -- Insert BOLO
    local insertQuery = [[
        INSERT INTO bolo_plates 
        (plate, reason, officer_name, officer_identifier, is_active, priority, notes)
        VALUES (?, ?, ?, ?, 1, ?, ?)
    ]]
    
    local result = exports.oxmysql:insertSync(insertQuery, {
        data.plate:upper(),
        data.reason,
        officerName,
        officerIdentifier,
        data.priority or 'MEDIUM',
        data.notes or ''
    })
    
    if result then
        return {success = true, id = result}
    end
    
    return {success = false, message = "Failed to create BOLO"}
end)

-- Update BOLO
lib.callback.register('mdt:updateBolo', function(source, data)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if not player or player.PlayerData.job.type ~= 'leo' then
        return {success = false, message = "Not authorized"}
    end
    
    if not data.id then
        return {success = false, message = "BOLO ID is required"}
    end
    
    if not data.reason or data.reason == '' then
        return {success = false, message = "Reason is required"}
    end
    
    local updateQuery = [[
        UPDATE bolo_plates 
        SET reason = ?, priority = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND is_active = 1
    ]]
    
    local result = exports.oxmysql:executeSync(updateQuery, {
        data.reason,
        data.priority or 'MEDIUM',
        data.notes or '',
        data.id
    })
    
    if result and result.affectedRows > 0 then
        return {success = true}
    end
    
    return {success = false, message = "Failed to update BOLO"}
end)

-- Deactivate BOLO
lib.callback.register('mdt:deactivateBolo', function(source, data)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if not player or player.PlayerData.job.type ~= 'leo' then
        return {success = false, message = "Not authorized"}
    end
    
    local updateQuery = "UPDATE bolo_plates SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    local result = exports.oxmysql:executeSync(updateQuery, {data.id})
    
    if result and result.affectedRows > 0 then
        return {success = true}
    end
    
    return {success = false, message = "Failed to deactivate BOLO"}
end)

-- Get specific BOLO
lib.callback.register('mdt:getBolo', function(source, boloId)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if not player or player.PlayerData.job.type ~= 'leo' then
        return nil
    end
    
    local query = [[
        SELECT id, plate, reason, officer_name, officer_identifier, 
               created_at, updated_at, is_active, priority, notes
        FROM bolo_plates WHERE id = ?
    ]]
    
    local result = exports.oxmysql:executeSync(query, {boloId})
    return result and result[1] or nil
end)