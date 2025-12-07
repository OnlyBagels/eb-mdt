-- server/evidence.lua

-- Get all evidence inventories
lib.callback.register('mdt:getEvidenceInventories', function(source)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player is LEO and on duty
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        -- print('[MDT Evidence] Player not authorized')
        return nil
    end
    
    -- Query for inventories where name starts with "Incident: " and owner is NULL or empty
    local query = [[
        SELECT 
            owner,
            name,
            data,
            lastupdated
        FROM ox_inventory
        WHERE name LIKE 'Incident: %'
          AND (owner IS NULL OR owner = '')
        ORDER BY lastupdated DESC
        LIMIT 100
    ]]
    
    local results = exports.oxmysql:executeSync(query, {})
    local evidenceList = {}
    
    -- print('[MDT Evidence] Query returned ' .. (results and #results or 0) .. ' results')
    
    if results then
        for _, evidence in ipairs(results) do
            -- print('[MDT Evidence] Found - Owner: ' .. (evidence.owner or 'NULL') .. ' | Name: ' .. (evidence.name or 'NULL'))
            
            -- Parse the inventory data
            local success, inventoryData = pcall(json.decode, evidence.data or '[]')
            local itemCount = 0
            
            if not success then
                inventoryData = {}
                -- print('[MDT Evidence] Failed to parse data for: ' .. (evidence.name or 'UNKNOWN'))
            end
            
            -- Count non-empty slots
            if type(inventoryData) == 'table' then
                for key, item in pairs(inventoryData) do
                    if type(item) == 'table' and item.name then
                        itemCount = itemCount + 1
                    end
                end
            end
            
            -- Use name as the unique identifier since owner is blank
            local identifier = evidence.name
            local displayName = evidence.name
            
            -- Extract evidence number from "Incident: XXX" format
            local evidenceNumber = evidence.name:match("Incident:%s*(%d+)") or evidence.name
            
            table.insert(evidenceList, {
                id = identifier,  -- Use name as ID
                evidenceNumber = evidenceNumber,
                owner = displayName,
                itemCount = itemCount,
                lastUpdated = evidence.lastupdated
            })
        end
    end
    
    -- print('[MDT Evidence] Returning ' .. #evidenceList .. ' evidence inventories')
    return evidenceList
end)

-- Get specific evidence inventory details
lib.callback.register('mdt:getEvidenceDetails', function(source, evidenceId)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player is LEO and on duty
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        -- print('[MDT Evidence] Player not authorized for details')
        return nil
    end
    
    -- Validate evidenceId
    if not evidenceId then
        -- print('[MDT Evidence] ERROR: No evidenceId provided!')
        return nil
    end
    
    -- print('[MDT Evidence] Getting details for: ' .. tostring(evidenceId))
    
    -- Get the evidence inventory by name (since owner is blank)
    local query = [[
        SELECT 
            owner,
            name,
            data,
            lastupdated
        FROM ox_inventory
        WHERE name = ?
        LIMIT 1
    ]]
    
    local result = exports.oxmysql:executeSync(query, {evidenceId})
    
    if result and result[1] then
        local evidence = result[1]
        local success, inventoryData = pcall(json.decode, evidence.data or '[]')
        local items = {}
        
        if not success then
            inventoryData = {}
            -- print('[MDT Evidence] Failed to parse inventory data')
        end
        
        -- Parse inventory items
        if type(inventoryData) == 'table' then
            for slot, item in pairs(inventoryData) do
                if type(item) == 'table' and item.name then
                    -- Get item info from ox_inventory
                    local itemInfo = exports.ox_inventory:Items(item.name)
                    
                    table.insert(items, {
                        slot = tonumber(slot) or 0,
                        name = item.name,
                        label = itemInfo and itemInfo.label or item.name,
                        count = item.count or 1,
                        weight = item.weight or 0,
                        metadata = item.metadata or {},
                        description = itemInfo and itemInfo.description or nil,
                        image = item.name
                    })
                end
            end
        end
        
        -- Sort items by slot
        table.sort(items, function(a, b) return a.slot < b.slot end)
        
        -- print('[MDT Evidence] Found ' .. #items .. ' items')
        
        local displayName = evidence.name
        local evidenceNumber = evidence.name:match("Incident:%s*(%d+)") or evidence.name
        
        return {
            id = evidence.name,  -- Use name as ID
            evidenceNumber = evidenceNumber,
            owner = displayName,
            items = items,
            lastUpdated = evidence.lastupdated,
            incidentInfo = {
                description = displayName,
            }
        }
    end
    
    -- print('[MDT Evidence] No evidence found with ID: ' .. tostring(evidenceId))
    return nil
end)