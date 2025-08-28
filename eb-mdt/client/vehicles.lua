-- client/vehicles.lua

-- NUI Callbacks for vehicle operations

-- Search vehicles - Modified to handle empty searches
RegisterNuiCallback('searchVehicles', function(data, cb)
    -- Only search if there's a query, otherwise return empty
    if not data.query or data.query == '' then
        cb({})
        return
    end
    
    lib.callback('mdt:searchVehicles', false, function(vehicles)
        cb(vehicles or {})
    end, data.query)
end)

-- Get specific vehicle
RegisterNuiCallback('getVehicle', function(data, cb)
    lib.callback('mdt:getVehicle', false, function(vehicle)
        cb(vehicle)
    end, data.vehicleId)
end)

-- Remove the getAllVehicles callback since we don't want to load all vehicles
-- RegisterNuiCallback('getAllVehicles', function(data, cb)
--     lib.callback('mdt:getAllVehicles', false, function(result)
--         cb(result or {vehicles = {}, totalCount = 0, totalPages = 0, currentPage = 1})
--     end, data.page, data.perPage)
-- end)

-- VEHICLE FLAG CALLBACKS --

-- Add flag to vehicle
RegisterNuiCallback('addVehicleFlag', function(data, cb)
    lib.callback('mdt:addVehicleFlag', false, function(result)
        cb(result)
    end, data)
end)

-- Remove flag from vehicle
RegisterNuiCallback('removeVehicleFlag', function(data, cb)
    lib.callback('mdt:removeVehicleFlag', false, function(result)
        cb(result)
    end, data)
end)

-- Impound vehicle
RegisterNuiCallback('impoundVehicle', function(data, cb)
    lib.callback('mdt:impoundVehicle', false, function(result)
        cb(result)
    end, data)
end)

-- Vehicle location tracking (for future implementation)
RegisterNuiCallback('trackVehicle', function(data, cb)
    -- This could integrate with a vehicle tracking system
    -- For now, we'll just return a placeholder response
    cb({success = false, message = "Vehicle tracking not implemented"})
end)