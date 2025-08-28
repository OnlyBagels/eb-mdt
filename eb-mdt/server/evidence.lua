-- server/evidence.lua

-- Get all evidence inventories
lib.callback.register('mdt:getEvidenceInventories', function(source)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player is LEO and on duty
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        print('[MDT Evidence] Player not authorized')
        return nil
    end
    
    -- Query for inventories with "Incident: " in the name field
    local query = [[
        SELECT 
            owner,
            name,
            data,
            lastupdated
        FROM ox_inventory
        WHERE name LIKE 'Incident: %'
        ORDER BY lastupdated DESC
        LIMIT 100
    ]]
    
    local results = exports.oxmysql:executeSync(query, {})
    local evidenceList = {}
    
    print('[MDT Evidence] Query returned ' .. (results and #results or 0) .. ' results')
    
    if results then
        for _, evidence in ipairs(results) do
            print('[MDT Evidence] Processing: ' .. evidence.name .. ' | Owner: ' .. (evidence.owner or 'NULL'))
            
            -- Parse the inventory data
            local success, inventoryData = pcall(json.decode, evidence.data or '[]')
            local itemCount = 0
            
            if not success then
                inventoryData = {}
                print('[MDT Evidence] Failed to parse data for: ' .. evidence.name)
            end
            
            -- Count non-empty slots
            if type(inventoryData) == 'table' then
                -- Handle both array and object formats
                for key, item in pairs(inventoryData) do
                    if type(item) == 'table' and item.name then
                        itemCount = itemCount + 1
                    end
                end
            end
            
            -- Extract evidence number from "Incident: XXX" format
            local evidenceNumber = evidence.name:match("Incident: (%d+)") or evidence.name
            
            table.insert(evidenceList, {
                id = evidence.name,
                evidenceNumber = evidenceNumber,
                owner = evidence.name,  -- Use the name as the display description
                itemCount = itemCount,
                lastUpdated = evidence.lastupdated
            })
        end
    end
    
    print('[MDT Evidence] Returning ' .. #evidenceList .. ' evidence inventories')
    return evidenceList
end)

-- Get specific evidence inventory details
lib.callback.register('mdt:getEvidenceDetails', function(source, evidenceId)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player is LEO and on duty
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        print('[MDT Evidence] Player not authorized for details')
        return nil
    end
    
    print('[MDT Evidence] Getting details for: ' .. evidenceId)
    
    -- Get the evidence inventory
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
            print('[MDT Evidence] Failed to parse inventory data')
        end
        
        -- Parse inventory items
        if type(inventoryData) == 'table' then
            for slot, item in pairs(inventoryData) do
                if type(item) == 'table' and item.name then
                    -- Get item info from ox_inventory
                    local itemInfo = exports.ox_inventory:GetItem(item.name)
                    
                    table.insert(items, {
                        slot = tonumber(slot) or 0,
                        name = item.name,
                        label = itemInfo and itemInfo.label or item.name,
                        count = item.count or 1,
                        weight = item.weight or 0,
                        metadata = item.metadata or {},
                        description = itemInfo and itemInfo.description or nil,
                        image = item.name -- Client will construct the image URL
                    })
                end
            end
        end
        
        -- Sort items by slot
        table.sort(items, function(a, b) return a.slot < b.slot end)
        
        print('[MDT Evidence] Found ' .. #items .. ' items')
        
        -- Try to get additional info from the name
        local incidentInfo = nil
        if evidence.name and evidence.name:match("^Incident: ") then
            incidentInfo = {
                description = evidence.name,
            }
        end
        
        return {
            id = evidence.name,
            evidenceNumber = evidence.name:match("Incident: (%d+)") or evidence.name,
            owner = evidence.name,  -- Use name as the display
            items = items,
            lastUpdated = evidence.lastupdated,
            incidentInfo = incidentInfo
        }
    end
    
    print('[MDT Evidence] No evidence found with ID: ' .. evidenceId)
    return nil
end)