-- server/vehicles.lua

-- Search for vehicles (FIXED VERSION WITH FLAGS)
lib.callback.register('mdt:searchVehicles', function(source, searchQuery)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player is LEO and on duty
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return nil
    end
    
    local vehicles = {}
    
    if searchQuery and searchQuery ~= '' then
        -- Convert search query to lowercase and trim
        local searchLower = string.lower(string.gsub(searchQuery, "^%s*(.-)%s*$", "%1"))
        local searchPattern = '%' .. searchLower .. '%'
        
        -- Search by plate, vehicle model, or owner with improved name matching
        local query = [[
            SELECT 
                pv.id,
                pv.plate,
                pv.citizenid,
                pv.vehicle,
                pv.hash,
                pv.mods,
                pv.fakeplate,
                pv.garage,
                pv.fuel,
                pv.engine,
                pv.body,
                pv.state,
                pv.depotprice,
                pv.drivingdistance,
                pv.status,
                pv.glovebox,
                pv.trunk,
                pv.damage,
                pv.in_garage,
                pv.job_vehicle,
                pv.job_vehicle_rank,
                pv.gang_vehicle,
                pv.gang_vehicle_rank,
                p.name as owner_name,
                TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.firstname'), '"', '')) as firstname,
                TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.lastname'), '"', '')) as lastname
            FROM player_vehicles pv
            LEFT JOIN players p ON pv.citizenid = p.citizenid
            WHERE 
                LOWER(pv.plate) LIKE ? OR 
                LOWER(pv.vehicle) LIKE ? OR
                LOWER(p.name) LIKE ? OR
                LOWER(TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.firstname'), '"', ''))) LIKE ? OR
                LOWER(TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.lastname'), '"', ''))) LIKE ? OR
                LOWER(CONCAT(
                    TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.firstname'), '"', '')), 
                    ' ', 
                    TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.lastname'), '"', ''))
                )) LIKE ? OR
                LOWER(CONCAT(
                    TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.lastname'), '"', '')), 
                    ' ', 
                    TRIM(REPLACE(JSON_EXTRACT(p.charinfo, '$.firstname'), '"', ''))
                )) LIKE ?
            LIMIT 50
        ]]
        
        local results = exports.oxmysql:executeSync(query, {
            searchPattern,  -- plate
            searchPattern,  -- vehicle
            searchPattern,  -- owner_name
            searchPattern,  -- firstname
            searchPattern,  -- lastname
            searchPattern,  -- firstname + lastname
            searchPattern   -- lastname + firstname
        })
        
        if results then
            for _, vehicle in ipairs(results) do
                -- Get active flags for this vehicle
                local flagsQuery = [[
                    SELECT 
                        id,
                        vehicle_id,
                        flag_type,
                        description,
                        reported_by,
                        created_at,
                        is_active
                    FROM mdt_vehicle_flags
                    WHERE vehicle_id = ? AND is_active = 1
                    ORDER BY created_at DESC
                ]]
                
                local flags = exports.oxmysql:executeSync(flagsQuery, { vehicle.id }) or {}
                
                -- Parse mods JSON
                local mods = json.decode(vehicle.mods or '{}')
                
                table.insert(vehicles, {
                    id = vehicle.id,
                    plate = vehicle.plate,
                    citizenid = vehicle.citizenid,
                    model = vehicle.vehicle,
                    hash = vehicle.hash,
                    owner = (vehicle.firstname and vehicle.lastname) 
                        and (vehicle.firstname .. ' ' .. vehicle.lastname) 
                        or vehicle.owner_name 
                        or 'Unknown',
                    fakeplate = vehicle.fakeplate,
                    garage = vehicle.garage,
                    fuel = vehicle.fuel,
                    engine = vehicle.engine,
                    body = vehicle.body,
                    state = vehicle.state,
                    inGarage = vehicle.in_garage == 1,
                    isJobVehicle = vehicle.job_vehicle == 1,
                    jobVehicleRank = vehicle.job_vehicle_rank,
                    isGangVehicle = vehicle.gang_vehicle == 1,
                    gangVehicleRank = vehicle.gang_vehicle_rank,
                    color = mods.color1 or 0,
                    flags = flags
                })
            end
        end
    end
    
    return vehicles
end)

-- Get specific vehicle by ID with detailed information
lib.callback.register('mdt:getVehicle', function(source, vehicleId)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player is LEO and on duty
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return nil
    end
    
    -- Get vehicle details
    local query = [[
        SELECT 
            pv.id,
            pv.plate,
            pv.citizenid,
            pv.vehicle,
            pv.hash,
            pv.mods,
            pv.fakeplate,
            pv.garage,
            pv.fuel,
            pv.engine,
            pv.body,
            pv.state,
            pv.depotprice,
            pv.drivingdistance,
            pv.status,
            pv.glovebox,
            pv.trunk,
            pv.damage,
            pv.in_garage,
            pv.job_vehicle,
            pv.job_vehicle_rank,
            pv.gang_vehicle,
            pv.gang_vehicle_rank,
            p.name as owner_name,
            JSON_EXTRACT(p.charinfo, '$.firstname') as firstname,
            JSON_EXTRACT(p.charinfo, '$.lastname') as lastname,
            JSON_EXTRACT(p.charinfo, '$.phone') as phone,
            JSON_EXTRACT(p.charinfo, '$.birthdate') as birthdate,
            JSON_EXTRACT(p.charinfo, '$.gender') as gender
        FROM player_vehicles pv
        LEFT JOIN players p ON pv.citizenid = p.citizenid
        WHERE pv.id = ?
    ]]
    
    local result = exports.oxmysql:executeSync(query, {vehicleId})
    
    if not result or #result == 0 then
        return nil
    end
    
    local vehicle = result[1]
    
    -- Get all flags for this vehicle (both active and inactive for history)
    local flagsQuery = [[
        SELECT 
            id,
            vehicle_id,
            flag_type,
            description,
            reported_by,
            created_at,
            is_active
        FROM mdt_vehicle_flags
        WHERE vehicle_id = ?
        ORDER BY created_at DESC
    ]]
    local flags = exports.oxmysql:executeSync(flagsQuery, {vehicle.id}) or {}
    
    -- Parse JSON fields safely
    local function parseJSON(jsonString)
        if not jsonString then return {} end
        local success, result = pcall(json.decode, jsonString)
        return success and result or {}
    end
    
    local mods = parseJSON(vehicle.mods)
    local damage = parseJSON(vehicle.damage)
    local glovebox = parseJSON(vehicle.glovebox)
    local trunk = parseJSON(vehicle.trunk)
    
    -- Format detailed vehicle data
    local detailedVehicle = {
        id = vehicle.id,
        plate = vehicle.plate,
        citizenid = vehicle.citizenid,
        model = vehicle.vehicle,
        modelHash = vehicle.hash,
        owner = vehicle.firstname and (vehicle.firstname .. ' ' .. vehicle.lastname) or vehicle.owner_name or 'Unknown',
        ownerPhone = vehicle.phone or 'Unknown',
        ownerBirthdate = vehicle.birthdate or 'Unknown',
        ownerGender = vehicle.gender or 'Unknown',
        garage = vehicle.garage or 'Unknown',
        fakePlate = vehicle.fakeplate,
        fuel = vehicle.fuel or 100,
        engine = vehicle.engine or 1000,
        body = vehicle.body or 1000,
        state = vehicle.state,
        depotPrice = vehicle.depotprice or 0,
        drivingDistance = vehicle.drivingdistance or 0,
        status = vehicle.status or 'Unknown',
        inGarage = vehicle.in_garage == 1,
        isJobVehicle = vehicle.job_vehicle_rank and vehicle.job_vehicle_rank > 0,
        jobVehicleRank = vehicle.job_vehicle_rank or 0,
        isGangVehicle = vehicle.gang_vehicle == 1,
        gangVehicleRank = vehicle.gang_vehicle_rank or 0,
        mods = mods,
        damage = damage,
        glovebox = glovebox,
        trunk = trunk,
        flags = flags
    }
    
    return detailedVehicle
end)