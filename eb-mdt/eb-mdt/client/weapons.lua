-- client/weapons.lua

-- NUI Callbacks for weapon registry operations

-- Get weapon registry with filters
RegisterNuiCallback('getWeaponRegistry', function(data, cb)
    lib.callback('mdt:getWeaponRegistry', false, function(result)
        cb(result or {weapons = {}, totalCount = 0, canManage = false})
    end, data)
end)

-- Get specific weapon details
RegisterNuiCallback('getWeaponDetails', function(data, cb)
    lib.callback('mdt:getWeaponDetails', false, function(weapon)
        cb(weapon)
    end, data.weaponId)
end)

-- Register new weapon
RegisterNuiCallback('registerWeapon', function(data, cb)
    lib.callback('mdt:registerWeapon', false, function(result)
        cb(result)
    end, data)
end)

-- Update weapon registration
RegisterNuiCallback('updateWeaponRegistration', function(data, cb)
    lib.callback('mdt:updateWeaponRegistration', false, function(result)
        cb(result)
    end, data)
end)

-- Update weapon status
RegisterNuiCallback('updateWeaponStatus', function(data, cb)
    lib.callback('mdt:updateWeaponStatus', false, function(result)
        cb(result)
    end, data)
end)

-- Delete weapon registration
RegisterNuiCallback('deleteWeaponRegistration', function(data, cb)
    lib.callback('mdt:deleteWeaponRegistration', false, function(result)
        cb(result)
    end, data)
end)

-- Listen for weapon registry updates
RegisterNetEvent('mdt:refreshWeaponRegistry', function()
    SendNUI('refreshWeaponRegistry', {})
end)