-- client/evidence.lua

-- NUI Callbacks for evidence operations

-- Get all evidence inventories
RegisterNuiCallback('getEvidenceInventories', function(data, cb)
    lib.callback('mdt:getEvidenceInventories', false, function(inventories)
        cb(inventories or {})
    end)
end)

-- Get specific evidence details
RegisterNuiCallback('getEvidenceDetails', function(data, cb)
    lib.callback('mdt:getEvidenceDetails', false, function(details)
        cb(details)
    end, data.evidenceId)
end)

-- Open evidence inventory (using ox_inventory)
RegisterNuiCallback('openEvidenceInventory', function(data, cb)
    -- Close the MDT temporarily to open the inventory
    ShowNUI('setVisibleMDT', false)
    
    -- Open the evidence inventory using ox_inventory
    exports.ox_inventory:openInventory('stash', data.evidenceId)
    
    cb(true)
end)

-- Listen for inventory close to reopen MDT
RegisterNetEvent('ox_inventory:closedInventory', function()
    -- Check if MDT should be reopened
    local playerData = exports.qbx_core:GetPlayerData()
    if playerData and playerData.job and playerData.job.type == 'leo' and playerData.job.onduty then
        -- Small delay to ensure smooth transition
        SetTimeout(100, function()
            ShowNUI('setVisibleMDT', true)
            -- Request evidence refresh
            SendNUI('refreshEvidence', {})
        end)
    end
end)