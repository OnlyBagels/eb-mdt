-- client/bolo.lua
-- Simple BOLO system client callbacks

-- Get active BOLOs
RegisterNuiCallback('getActiveBolos', function(data, cb)
    lib.callback('mdt:getActiveBolos', false, function(bolos)
        cb(bolos or {})
    end)
end)

-- Create new BOLO
RegisterNuiCallback('createBolo', function(data, cb)
    lib.callback('mdt:createBolo', false, function(result)
        cb(result)
    end, data)
end)

-- Update BOLO
RegisterNuiCallback('updateBolo', function(data, cb)
    lib.callback('mdt:updateBolo', false, function(result)
        cb(result)
    end, data)
end)

-- Deactivate BOLO
RegisterNuiCallback('deactivateBolo', function(data, cb)
    lib.callback('mdt:deactivateBolo', false, function(result)
        cb(result)
    end, data)
end)

-- Get specific BOLO
RegisterNuiCallback('getBolo', function(data, cb)
    lib.callback('mdt:getBolo', false, function(bolo)
        cb(bolo)
    end, data.id)
end)