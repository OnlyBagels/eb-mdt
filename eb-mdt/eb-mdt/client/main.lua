-- client/main.lua
local QBCore = exports['qb-core']:GetCoreObject()

local isMDTOpen = false
local tabletObj = nil
local tabletDict = "amb@code_human_in_bus_passenger_idles@female@tablet@base"
local tabletAnim = "base"
local tabletProp = `prop_cs_tablet`
local tabletBone = 60309
local tabletOffset = vector3(0.03, 0.002, -0.0)
local tabletRot = vector3(10.0, 160.0, 0.0)

---------------------------------------------------
-- PLAYER INFO FUNCTION
---------------------------------------------------
local function getPlayerInfo()
    local playerData = exports.qbx_core:GetPlayerData()
    if playerData and playerData.job and playerData.job.type == 'leo' then
        local rankNum = playerData.job.grade.level or 0
        local rankString = playerData.job.grade.name .. ' (' .. tostring(rankNum) .. ')'
        return {
            name = playerData.charinfo.firstname .. ' ' .. playerData.charinfo.lastname,
            callsign = playerData.metadata.callsign or 'NO CALLSIGN',
            department = playerData.job.label,
            rank = rankString,
            jobName = playerData.job.name,
            gradeLevel = rankNum
        }
    end
    return nil
end

---------------------------------------------------
-- TABLET ANIMATION HANDLERS
---------------------------------------------------
local function playTabletAnimation()
    local ped = PlayerPedId()

    RequestAnimDict(tabletDict)
    while not HasAnimDictLoaded(tabletDict) do Wait(100) end

    RequestModel(tabletProp)
    while not HasModelLoaded(tabletProp) do Wait(100) end

    tabletObj = CreateObject(tabletProp, 0.0, 0.0, 0.0, true, true, false)
    AttachEntityToEntity(
        tabletObj, ped, GetPedBoneIndex(ped, tabletBone),
        tabletOffset.x, tabletOffset.y, tabletOffset.z,
        tabletRot.x, tabletRot.y, tabletRot.z,
        true, false, false, false, 2, true
    )

    SetModelAsNoLongerNeeded(tabletProp)

    CreateThread(function()
        while isMDTOpen do
            Wait(0)
            if not IsEntityPlayingAnim(ped, tabletDict, tabletAnim, 3) then
                TaskPlayAnim(ped, tabletDict, tabletAnim, 3.0, 3.0, -1, 49, 0, false, false, false)
            end
        end

        -- Clean up when closed
        ClearPedSecondaryTask(ped)
        Wait(250)
        if DoesEntityExist(tabletObj) then
            DetachEntity(tabletObj, true, false)
            DeleteEntity(tabletObj)
        end
        tabletObj = nil
    end)
end

local function stopTabletAnimation()
    local ped = PlayerPedId()
    ClearPedSecondaryTask(ped)
    if DoesEntityExist(tabletObj) then
        DetachEntity(tabletObj, true, false)
        DeleteEntity(tabletObj)
        tabletObj = nil
    end
end

---------------------------------------------------
-- MDT TOGGLE FUNCTION
---------------------------------------------------
local function toggleMDT(state)
    isMDTOpen = state

    if state then
        local playerInfo = getPlayerInfo()
        if playerInfo then
            SendNUI('updatePlayerInfo', playerInfo)
        end

        lib.callback('mdt:getOnlineOfficers', false, function(officers)
            if officers then
                SendNUI('updateOnlineOfficers', officers)
            end
        end)

        playTabletAnimation()
        SetNuiFocus(true, true)
    else
        stopTabletAnimation()
        SetNuiFocus(false, false)
    end

    ShowNUI('setVisibleMDT', state)
end

---------------------------------------------------
-- MDT COMMAND
---------------------------------------------------
RegisterCommand('mdt', function()
    local playerData = exports.qbx_core:GetPlayerData()
    
    if not playerData or not playerData.job or playerData.job.type ~= 'leo' then
        exports.qbx_core:Notify('You must be a law enforcement officer to use the MDT', 'error')
        return
    end
    
    if not playerData.job.onduty then
        exports.qbx_core:Notify('You must be on duty to access the MDT', 'error')
        return
    end

    toggleMDT(not isMDTOpen)
end, false)

RegisterKeyMapping('mdt', 'Open MDT', 'keyboard', 'F3')

---------------------------------------------------
-- NUI CALLBACKS (CLOSE + ESC)
---------------------------------------------------
RegisterNuiCallback('closeMDT', function(_, cb)
    if isMDTOpen then
        toggleMDT(false)
    end
    cb(true)
end)

-- Detect ESC press while MDT is open
CreateThread(function()
    while true do
        Wait(0)
        if isMDTOpen and IsControlJustPressed(0, 200) then -- 200 = ESC key
            toggleMDT(false)
            Wait(300)
        end
    end
end)

---------------------------------------------------
-- AUTO UPDATES
---------------------------------------------------
CreateThread(function()
    while true do
        Wait(5000)
        if isMDTOpen then
            lib.callback('mdt:getOnlineOfficers', false, function(officers)
                if officers then
                    SendNUI('updateOnlineOfficers', officers)
                end
            end)
        end
    end
end)

RegisterNetEvent('mdt:updateOnlineOfficers', function(officers)
    if isMDTOpen then
        SendNUI('updateOnlineOfficers', officers)
    end
end)

RegisterNetEvent('QBCore:Player:SetPlayerData', function(PlayerData)
    if isMDTOpen and PlayerData.job then
        local playerInfo = getPlayerInfo()
        if playerInfo then
            SendNUI('updatePlayerInfo', playerInfo)
        end
    end
end)

---------------------------------------------------
-- CLEANUP ON RESOURCE STOP
---------------------------------------------------
AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() then
        stopTabletAnimation()
        SetNuiFocus(false, false)
    end
end)