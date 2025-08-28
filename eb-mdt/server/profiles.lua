-- server/profiles.lua

-- ========================================
-- CONFIGURATION
-- ========================================

local LICENSE_MANAGEMENT_RANKS = {
    ['lspd'] = 10,      
    ['bcso'] = 10,       
    ['usms'] = 1,
}

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

local function DebugPrint(message, ...)
    if Config and Config.Debug then
        print('^3[MDT Debug]^0', message, ...)
    end
end

local function CanManageLicenses(player)
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        DebugPrint('License check failed: Not LEO or not on duty')
        return false
    end
    
    local jobName = string.lower(player.PlayerData.job.name)
    local gradeLevel = player.PlayerData.job.grade.level or 0
    local requiredRank = LICENSE_MANAGEMENT_RANKS[jobName]
    
    DebugPrint('License check:', jobName, 'Grade:', gradeLevel, 'Required:', requiredRank or 'N/A')
    
    return requiredRank and gradeLevel >= requiredRank
end

-- ========================================
-- PROFILE SEARCH AND RETRIEVAL
-- ========================================

-- Search for citizen profiles
lib.callback.register('mdt:searchProfiles', function(source, searchQuery)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player is LEO and on duty
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return nil
    end
    
    local profiles = {}
    
    if searchQuery and searchQuery ~= '' then
        -- Convert search query to lowercase for case-insensitive search
        local searchPattern = '%' .. string.lower(searchQuery) .. '%'
        
        -- Search by name or citizen ID with case-insensitive partial matching
        local query = [[
            SELECT 
                id,
                citizenid,
                license,
                name,
                phone_number,
                metadata,
                money,
                charinfo,
                job,
                gang,
                position,
                last_updated
            FROM players 
            WHERE 
                LOWER(name) LIKE ? OR 
                LOWER(citizenid) LIKE ? OR 
                LOWER(JSON_EXTRACT(charinfo, '$.firstname')) LIKE ? OR 
                LOWER(JSON_EXTRACT(charinfo, '$.lastname')) LIKE ? OR
                CONCAT(LOWER(JSON_EXTRACT(charinfo, '$.firstname')), ' ', LOWER(JSON_EXTRACT(charinfo, '$.lastname'))) LIKE ?
            LIMIT 50
        ]]
        
        local results = exports.oxmysql:executeSync(query, {
            searchPattern, 
            searchPattern, 
            searchPattern, 
            searchPattern,
            searchPattern
        })
        
        if results then
            for _, citizen in ipairs(results) do
                -- Parse JSON data
                local charinfo = json.decode(citizen.charinfo or '{}')
                local job = json.decode(citizen.job or '{}')
                local metadata = json.decode(citizen.metadata or '{}')
                
                -- Get phone number using the export if available
                local phoneNumber = citizen.phone_number or charinfo.phone or 'Unknown'
                if exports['yseries'] then
                    local success, result = pcall(function()
                        return exports['yseries']:GetPhoneNumberByIdentifier(citizen.citizenid)
                    end)
                    if success and result then
                        phoneNumber = result
                    end
                end
                
                -- Get gang tags for this citizen
                local gangQuery = [[
                    SELECT g.name 
                    FROM mdt_citizen_gangs cg
                    JOIN gangs g ON cg.gang_id = g.id
                    WHERE cg.citizenid = ?
                ]]
                
                local gangResults = exports.oxmysql:executeSync(gangQuery, {citizen.citizenid})
                local gangTags = nil
                
                if gangResults and #gangResults > 0 then
                    local tags = {}
                    for _, gang in ipairs(gangResults) do
                        table.insert(tags, gang.name)
                    end
                    gangTags = table.concat(tags, ', ')
                end
                
                table.insert(profiles, {
                    id = citizen.id,
                    citizenid = citizen.citizenid,
                    firstname = charinfo.firstname or 'Unknown',
                    lastname = charinfo.lastname or 'Unknown',
                    birthdate = charinfo.birthdate or 'Unknown',
                    gender = charinfo.gender == 0 and 'Male' or 'Female',
                    nationality = charinfo.nationality or 'Unknown',
                    phone = phoneNumber,
                    job = job.label or 'Unemployed',
                    jobGrade = job.grade and job.grade.name or '',
                    gangTags = gangTags
                })
            end
        end
    end
    
    return profiles
end)

-- Get detailed profile
lib.callback.register('mdt:getProfile', function(source, citizenid)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player is LEO and on duty
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return nil
    end
    
    -- Get citizen data
    local query = [[
        SELECT 
            id,
            citizenid,
            license,
            name,
            phone_number,
            metadata,
            money,
            charinfo,
            job,
            gang,
            position,
            last_updated
        FROM players 
        WHERE citizenid = ?
        LIMIT 1
    ]]
    
    local result = exports.oxmysql:executeSync(query, {citizenid})
    
    if not result or not result[1] then
        return nil
    end
    
    local citizen = result[1]
    
    -- Parse JSON data
    local charinfo = json.decode(citizen.charinfo or '{}')
    local job = json.decode(citizen.job or '{}')
    local metadata = json.decode(citizen.metadata or '{}')
    local gang = json.decode(citizen.gang or '{}')
    
    -- Get all jobs for this player
    local jobs = {}
    if job and job.name then
        table.insert(jobs, {
            name = job.name,
            label = job.label or job.name,
            grade = job.grade and job.grade.level or 0,
            gradeName = job.grade and job.grade.name or 'Unknown',
            payment = job.payment or 0,
            isboss = job.isboss or false
        })
    end
    
    -- Get vehicles
    local vehicles = exports.oxmysql:executeSync([[
        SELECT 
            id,
            plate,
            vehicle,
            garage,
            state
        FROM player_vehicles 
        WHERE citizenid = ?
        LIMIT 50
    ]], {citizenid}) or {}
    
    -- Get properties
    local properties = {}
    if exports['nolag_properties'] then
        local success, allProperties = pcall(function()
            return exports['nolag_properties']:GetAllProperties('user')
        end)
        if success and allProperties then
            for _, property in ipairs(allProperties) do
                if property.isOwner and property.isOwner(citizenid) then
                    table.insert(properties, {
                        id = property.id,
                        label = property.label,
                        price = property.price,
                        type = property.type,
                        doorLocked = property.doorLocked,
                        hasKey = property.hasKey and property.hasKey(citizenid) or false
                    })
                end
            end
        end
    end
    
    -- Get phone number
    local phoneNumber = citizen.phone_number or charinfo.phone or 'Unknown'
    if exports['yseries'] then
        local success, result = pcall(function()
            return exports['yseries']:GetPhoneNumberByIdentifier(citizenid)
        end)
        if success and result then
            phoneNumber = result
        end
    end
    
    -- Get criminal record stats
local criminalRecord = {
    arrests = exports.oxmysql:scalar([[
        SELECT COUNT(DISTINCT r.id) 
        FROM mdt_reports r 
        INNER JOIN mdt_report_involved ri ON r.id = ri.report_id 
        WHERE ri.citizenid = ? AND r.type = "arrest"
    ]], {citizenid}) or 0,
    
    citations = exports.oxmysql:scalar([[
        SELECT COUNT(DISTINCT r.id) 
        FROM mdt_reports r 
        INNER JOIN mdt_report_involved ri ON r.id = ri.report_id 
        WHERE ri.citizenid = ? AND r.type = "citation"
    ]], {citizenid}) or 0,
    
    warrants = exports.oxmysql:scalar([[
        SELECT COUNT(*) 
        FROM mdt_warrants 
        WHERE citizenid = ? AND status = "active"
    ]], {citizenid}) or 0
}
    
    -- Get registered weapons
    local weapons = exports.oxmysql:executeSync([[
        SELECT 
            id,
            weapon_type,
            serial_number,
            registration_date,
            status
        FROM mdt_weapon_registry
        WHERE citizen_id = ?
        ORDER BY registration_date DESC
    ]], {citizenid}) or {}
    
    -- Get biometric data
    local finger = metadata.fingerprint or metadata.finger or 'Not on file'
    local bloodType = metadata.bloodtype or metadata.blood_type or 'Unknown'
    local bloodLevel = metadata.blood or 100
    
    -- Check license management permission
    local canManage = CanManageLicenses(player)
    
    return {
        -- Basic Information
        id = citizen.id,
        citizenid = citizen.citizenid,
        firstname = charinfo.firstname or 'Unknown',
        lastname = charinfo.lastname or 'Unknown',
        birthdate = charinfo.birthdate or 'Unknown',
        gender = charinfo.gender == 0 and 'Male' or 'Female',
        nationality = charinfo.nationality or 'Unknown',
        phone = phoneNumber,
        
        -- Biometric Information
        fingerprint = finger,
        bloodType = bloodType,
        blood = bloodLevel,
        
        -- Employment
        job = job.label or 'Unemployed',
        jobGrade = job.grade and job.grade.name or '',
        jobDuty = job.onduty or false,
        jobs = jobs,
        
        -- Licenses
        licenses = metadata.licences or metadata.licenses or {},
        
        -- Other data
        vehicles = vehicles,
        properties = properties,
        criminalRecord = criminalRecord,
        registeredWeapons = weapons,
        
        -- Permissions
        canManageLicenses = canManage
    }
end)

-- Get all profiles with pagination (Admin function)
lib.callback.register('mdt:getAllProfiles', function(source, page, perPage)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player is LEO and on duty with high rank
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return nil
    end
    
    -- Check if player has sufficient rank (only high-ranking officers)
    local playerGrade = player.PlayerData.job.grade.level or 0
    if playerGrade < 10 then
        return {profiles = {}, totalCount = 0, totalPages = 0, currentPage = page}
    end
    
    page = page or 1
    perPage = perPage or 50
    local offset = (page - 1) * perPage
    
    -- Get total count
    local countQuery = "SELECT COUNT(*) as count FROM players"
    local countResult = exports.oxmysql:executeSync(countQuery, {})
    local totalCount = countResult[1].count or 0
    local totalPages = math.ceil(totalCount / perPage)
    
    -- Get profiles for current page
    local query = [[
        SELECT 
            id,
            citizenid,
            name,
            charinfo,
            job,
            metadata
        FROM players 
        ORDER BY last_updated DESC
        LIMIT ? OFFSET ?
    ]]
    
    local results = exports.oxmysql:executeSync(query, {perPage, offset})
    local profiles = {}
    
    if results then
        for _, citizen in ipairs(results) do
            local charinfo = json.decode(citizen.charinfo or '{}')
            local job = json.decode(citizen.job or '{}')
            
            table.insert(profiles, {
                id = citizen.id,
                citizenid = citizen.citizenid,
                firstname = charinfo.firstname or 'Unknown',
                lastname = charinfo.lastname or 'Unknown',
                birthdate = charinfo.birthdate or 'Unknown',
                gender = charinfo.gender == 0 and 'Male' or 'Female',
                job = job.label or 'Unemployed',
                jobGrade = job.grade and job.grade.name or ''
            })
        end
    end
    
    return {
        profiles = profiles,
        totalCount = totalCount,
        totalPages = totalPages,
        currentPage = page
    }
end)

-- ========================================
-- GANG TAG MANAGEMENT
-- ========================================

-- Get all gang tags
lib.callback.register('mdt:getGangTags', function(source)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return nil
    end
    
    local query = [[
        SELECT id, name, color
        FROM gangs
        ORDER BY name ASC
    ]]
    
    return exports.oxmysql:executeSync(query, {}) or {}
end)

-- Get citizen's gang affiliations
lib.callback.register('mdt:getCitizenGangs', function(source, citizenid)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return nil
    end
    
    local query = [[
        SELECT 
            cg.id,
            cg.gang_id,
            g.name as gang_name,
            g.color as gang_color,
            cg.tagged_by,
            cg.tagged_at,
            cg.notes
        FROM mdt_citizen_gangs cg
        JOIN gangs g ON cg.gang_id = g.id
        WHERE cg.citizenid = ?
        ORDER BY cg.tagged_at DESC
    ]]
    
    return exports.oxmysql:executeSync(query, {citizenid}) or {}
end)

-- Add gang tag to citizen
lib.callback.register('mdt:addGangTag', function(source, data)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return {success = false, message = "Not authorized"}
    end
    
    local officerName = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname
    
    -- Check if this gang tag already exists for this citizen
    local checkQuery = [[
        SELECT id FROM mdt_citizen_gangs
        WHERE citizenid = ? AND gang_id = ?
    ]]
    
    local existing = exports.oxmysql:executeSync(checkQuery, {data.citizenid, data.gangId})
    
    if existing and #existing > 0 then
        return {success = false, message = "This gang tag already exists for this citizen"}
    end
    
    -- Add the gang tag
    local insertQuery = [[
        INSERT INTO mdt_citizen_gangs (citizenid, gang_id, tagged_by, tagged_at, notes)
        VALUES (?, ?, ?, NOW(), ?)
    ]]
    
    local result = exports.oxmysql:executeSync(insertQuery, {
        data.citizenid,
        data.gangId,
        officerName,
        data.notes or ''
    })
    
    if result and result.affectedRows > 0 then
        -- Log the action
        TriggerEvent('mdt:server:log', {
            action = 'Gang Tag Added',
            officer = officerName,
            target = data.citizenid,
            details = 'Added gang tag'
        })
        
        return {success = true}
    end
    
    return {success = false, message = "Failed to add gang tag"}
end)

-- Remove gang tag from citizen
lib.callback.register('mdt:removeGangTag', function(source, data)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return {success = false, message = "Not authorized"}
    end
    
    local deleteQuery = [[
        DELETE FROM mdt_citizen_gangs 
        WHERE id = ? AND citizenid = ?
    ]]
    
    local result = exports.oxmysql:executeSync(deleteQuery, {data.id, data.citizenid})
    
    if result and result.affectedRows > 0 then
        local officerName = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname
        
        -- Log the action
        TriggerEvent('mdt:server:log', {
            action = 'Gang Tag Removed',
            officer = officerName,
            target = data.citizenid,
            details = 'Removed gang tag'
        })
        
        return {success = true}
    end
    
    return {success = false, message = "Failed to remove gang tag"}
end)

-- ========================================
-- LICENSE MANAGEMENT
-- ========================================

-- Add license to citizen
lib.callback.register('mdt:addLicense', function(source, data)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    --print('^3[MDT Debug] Add License Request from:', src)
    --print('^3[MDT Debug] Player Job:', player and player.PlayerData.job.name or 'nil')
    --print('^3[MDT Debug] Player Job Type:', player and player.PlayerData.job.type or 'nil')
    --print('^3[MDT Debug] Player Grade Level:', player and player.PlayerData.job.grade.level or 'nil')
    --print('^3[MDT Debug] Player On Duty:', player and player.PlayerData.job.onduty or false)
    
    -- Verify player is LEO and on duty
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        print('^1[MDT Debug] Failed: Not authorized (not LEO or not on duty)')
        return {success = false, message = "Not authorized"}
    end
    
    -- Check permissions
    if not CanManageLicenses(player) then
        print('^1[MDT Debug] Failed: Insufficient rank')
        return {success = false, message = "Insufficient rank to manage licenses"}
    end
    
    -- Special check for pilot license
    local playerJob = string.lower(player.PlayerData.job.name)
    if data.license == 'pilot' and playerJob ~= 'usms' then
        print('^1[MDT Debug] Failed: Only USMS can issue pilot licenses')
        return {success = false, message = "Only US Marshals can issue pilot licenses"}
    end
    
    --print('^2[MDT Debug] Permission check passed! Adding license:', data.license)
    
    -- Get the target player (if online) or update database directly
    local targetPlayer = exports.qbx_core:GetPlayerByCitizenId(data.citizenid)
    
    if targetPlayer then
        -- Player is online, update their metadata
        local licenses = targetPlayer.PlayerData.metadata.licences or targetPlayer.PlayerData.metadata.licenses or {}
        licenses[data.license] = true
        targetPlayer.Functions.SetMetaData('licences', licenses)
        
       -- print('^2[MDT Debug] License added to online player')
    else
        -- Player is offline, update database
        local query = [[
            SELECT metadata FROM players WHERE citizenid = ?
        ]]
        
        local result = exports.oxmysql:executeSync(query, {data.citizenid})
        
        if result and result[1] then
            local metadata = json.decode(result[1].metadata or '{}')
            metadata.licences = metadata.licences or metadata.licenses or {}
            metadata.licences[data.license] = true
            
            local updateQuery = [[
                UPDATE players SET metadata = ? WHERE citizenid = ?
            ]]
            
            exports.oxmysql:executeSync(updateQuery, {json.encode(metadata), data.citizenid})
            
          --  print('^2[MDT Debug] License added to offline player')
        else
            return {success = false, message = "Player not found"}
        end
    end
    
    -- Log the action
    local officerName = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname
    TriggerEvent('mdt:server:log', {
        action = 'License Added',
        officer = officerName,
        target = data.citizenid,
        details = 'Added ' .. data.license .. ' license'
    })
    
    return {success = true}
end)

-- Remove license from citizen
lib.callback.register('mdt:removeLicense', function(source, data)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
 --   print('^3[MDT Debug] Remove License Request from:', src)
    --print('^3[MDT Debug] Player Job:', player and player.PlayerData.job.name or 'nil')
   -- print('^3[MDT Debug] Player Grade Level:', player and player.PlayerData.job.grade.level or 'nil')
    
    -- Verify player is LEO and on duty
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        print('^1[MDT Debug] Failed: Not authorized (not LEO or not on duty)')
        return {success = false, message = "Not authorized"}
    end
    
    -- Check permissions
    if not CanManageLicenses(player) then
        print('^1[MDT Debug] Failed: Insufficient rank')
        return {success = false, message = "Insufficient rank to manage licenses"}
    end
    
    -- Special check for pilot license
    local playerJob = string.lower(player.PlayerData.job.name)
    if data.license == 'pilot' and playerJob ~= 'usms' then
        print('^1[MDT Debug] Failed: Only USMS can manage pilot licenses')
        return {success = false, message = "Only US Marshals can manage pilot licenses"}
    end
    
   -- print('^2[MDT Debug] Permission check passed! Removing license:', data.license)
    
    -- Get the target player (if online) or update database directly
    local targetPlayer = exports.qbx_core:GetPlayerByCitizenId(data.citizenid)
    
    if targetPlayer then
        -- Player is online, update their metadata
        local licenses = targetPlayer.PlayerData.metadata.licences or targetPlayer.PlayerData.metadata.licenses or {}
        licenses[data.license] = false
        targetPlayer.Functions.SetMetaData('licences', licenses)
        
     --   print('^2[MDT Debug] License removed from online player')
    else
        -- Player is offline, update database
        local query = [[
            SELECT metadata FROM players WHERE citizenid = ?
        ]]
        
        local result = exports.oxmysql:executeSync(query, {data.citizenid})
        
        if result and result[1] then
            local metadata = json.decode(result[1].metadata or '{}')
            metadata.licences = metadata.licences or metadata.licenses or {}
            metadata.licences[data.license] = false
            
            local updateQuery = [[
                UPDATE players SET metadata = ? WHERE citizenid = ?
            ]]
            
            exports.oxmysql:executeSync(updateQuery, {json.encode(metadata), data.citizenid})
            
         --   print('^2[MDT Debug] License removed from offline player')
        else
            return {success = false, message = "Player not found"}
        end
    end
    
    -- Log the action
    local officerName = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname
    TriggerEvent('mdt:server:log', {
        action = 'License Removed',
        officer = officerName,
        target = data.citizenid,
        details = 'Removed ' .. data.license .. ' license'
    })
    
    return {success = true}
end)

-- ========================================
-- PHOTO AND NOTES MANAGEMENT
-- ========================================

-- Get citizen photo
lib.callback.register('mdt:getCitizenPhoto', function(source, citizenid)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return nil
    end
    
    local query = [[
        SELECT photo_url
        FROM mdt_citizen_profiles
        WHERE citizenid = ?
        LIMIT 1
    ]]
    
    local result = exports.oxmysql:executeSync(query, {citizenid})
    
    if result and result[1] and result[1].photo_url then
        return result[1].photo_url
    end
    
    return ""
end)

-- Update citizen photo
lib.callback.register('mdt:updateCitizenPhoto', function(source, data)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return {success = false, message = "Not authorized"}
    end
    
    local officerName = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname
    
    -- Check if profile exists
    local checkQuery = [[
        SELECT id FROM mdt_citizen_profiles
        WHERE citizenid = ?
        LIMIT 1
    ]]
    
    local existing = exports.oxmysql:executeSync(checkQuery, {data.citizenid})
    
    if existing and existing[1] then
        -- Update existing photo
        local updateQuery = [[
            UPDATE mdt_citizen_profiles
            SET photo_url = ?, photo_updated_by = ?, photo_updated_at = NOW()
            WHERE citizenid = ?
        ]]
        
        exports.oxmysql:executeSync(updateQuery, {data.url, officerName, data.citizenid})
    else
        -- Create new profile entry
        local insertQuery = [[
            INSERT INTO mdt_citizen_profiles (citizenid, photo_url, photo_updated_by, photo_updated_at)
            VALUES (?, ?, ?, NOW())
        ]]
        
        exports.oxmysql:executeSync(insertQuery, {data.citizenid, data.url, officerName})
    end
    
    return {success = true}
end)

-- Get citizen notes
lib.callback.register('mdt:getCitizenNotes', function(source, citizenid)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return nil
    end
    
    local query = [[
        SELECT notes
        FROM mdt_citizen_profiles
        WHERE citizenid = ?
        LIMIT 1
    ]]
    
    local result = exports.oxmysql:executeSync(query, {citizenid})
    
    if result and result[1] and result[1].notes then
        return result[1].notes
    end
    
    return ""
end)

-- Save citizen notes
lib.callback.register('mdt:saveCitizenNotes', function(source, data)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return {success = false, message = "Not authorized"}
    end
    
    local officerName = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname
    
    -- Check if profile exists
    local checkQuery = [[
        SELECT id FROM mdt_citizen_profiles
        WHERE citizenid = ?
        LIMIT 1
    ]]
    
    local existing = exports.oxmysql:executeSync(checkQuery, {data.citizenid})
    
    if existing and existing[1] then
        -- Update existing notes
        local updateQuery = [[
            UPDATE mdt_citizen_profiles
            SET notes = ?, notes_updated_by = ?, notes_updated_at = NOW()
            WHERE citizenid = ?
        ]]
        
        exports.oxmysql:executeSync(updateQuery, {data.notes, officerName, data.citizenid})
    else
        -- Create new profile entry
        local insertQuery = [[
            INSERT INTO mdt_citizen_profiles (citizenid, notes, notes_updated_by, notes_updated_at)
            VALUES (?, ?, ?, NOW())
        ]]
        
        exports.oxmysql:executeSync(insertQuery, {data.citizenid, data.notes, officerName})
    end
    
    return {success = true}
end)

-- ========================================
-- CRIMINAL RECORD FUNCTIONS
-- ========================================

-- Get citizen's criminal records
lib.callback.register('mdt:getCitizenReports', function(source, citizenid)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return nil
    end
    
    local query = [[
        SELECT 
            r.id,
            r.report_number,
            r.title,
            r.type,
            r.status,
            r.created_at,
            r.created_by
        FROM mdt_reports r
        WHERE JSON_CONTAINS(r.involved, JSON_OBJECT('citizenid', ?))
        ORDER BY r.created_at DESC
        LIMIT 50
    ]]
    
    return exports.oxmysql:executeSync(query, {citizenid}) or {}
end)

-- Get citizen's active warrants
lib.callback.register('mdt:getCitizenWarrants', function(source, citizenid)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return nil
    end
    
    local query = [[
        SELECT 
            id,
            warrant_number,
            charges,
            issued_by,
            issued_at,
            status
        FROM mdt_warrants
        WHERE citizenid = ? AND status = 'active'
        ORDER BY issued_at DESC
    ]]
    
    return exports.oxmysql:executeSync(query, {citizenid}) or {}
end)

-- ========================================
-- EXPORT FUNCTIONS
-- ========================================

-- Export to check if a citizen has a specific license
exports('HasLicense', function(citizenid, license)
    local query = [[
        SELECT metadata FROM players WHERE citizenid = ? LIMIT 1
    ]]
    
    local result = exports.oxmysql:executeSync(query, {citizenid})
    
    if result and result[1] then
        local metadata = json.decode(result[1].metadata or '{}')
        local licenses = metadata.licences or metadata.licenses or {}
        return licenses[license] == true
    end
    
    return false
end)

-- Export to get all licenses for a citizen
exports('GetCitizenLicenses', function(citizenid)
    local query = [[
        SELECT metadata FROM players WHERE citizenid = ? LIMIT 1
    ]]
    
    local result = exports.oxmysql:executeSync(query, {citizenid})
    
    if result and result[1] then
        local metadata = json.decode(result[1].metadata or '{}')
        return metadata.licences or metadata.licenses or {}
    end
    
    return {}
end)

-- ========================================
-- DEBUG COMMANDS
-- ========================================

RegisterCommand('mdtdebug', function(source)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if player then
        print('^2=== MDT Debug Info ===^0')
        print('Player:', player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname)
        print('Job Name:', player.PlayerData.job.name)
        print('Job Type:', player.PlayerData.job.type)
        print('Grade Level:', player.PlayerData.job.grade.level)
        print('Grade Name:', player.PlayerData.job.grade.name)
        print('On Duty:', player.PlayerData.job.onduty)
        print('Can Manage Licenses:', CanManageLicenses(player))
        print('^2=====================^0')
        
        -- Also notify the player in chat
        TriggerClientEvent('chat:addMessage', src, {
            color = {255, 255, 255},
            multiline = true,
            args = {"MDT Debug", string.format("Job: %s | Grade: %d | On Duty: %s | Can Manage Licenses: %s", 
                player.PlayerData.job.name, 
                player.PlayerData.job.grade.level or 0, 
                tostring(player.PlayerData.job.onduty),
                tostring(CanManageLicenses(player))
            )}
        })
    end
end, false)

-- Command to force refresh player info
RegisterCommand('mdtrefresh', function(source)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if player and player.PlayerData.job.type == 'leo' then
        TriggerClientEvent('mdt:client:updatePlayerInfo', src, {
            name = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname,
            callsign = player.PlayerData.metadata.callsign or 'N/A',
            department = player.PlayerData.job.label or 'Unknown',
            rank = player.PlayerData.job.grade.name or 'Unknown',
            jobName = player.PlayerData.job.name,
            gradeLevel = player.PlayerData.job.grade.level or 0
        })
        
        TriggerClientEvent('chat:addMessage', src, {
            color = {255, 255, 255},
            args = {"MDT", "Player info refreshed"}
        })
    end
end, false)

-- ========================================
-- EVENTS
-- ========================================

-- Update player info when MDT opens
RegisterNetEvent('mdt:server:openMDT', function()
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if not player then return end
    
    -- Send player info to client
    TriggerClientEvent('mdt:client:updatePlayerInfo', src, {
        name = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname,
        callsign = player.PlayerData.metadata.callsign or 'N/A',
        department = player.PlayerData.job.label or 'Unknown',
        rank = player.PlayerData.job.grade.name or 'Unknown',
        jobName = player.PlayerData.job.name,
        gradeLevel = player.PlayerData.job.grade.level or 0
    })
end)

-- Log MDT actions
RegisterNetEvent('mdt:server:log', function(data)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    if not player then return end
    
    -- Insert log entry
    local query = [[
        INSERT INTO mdt_logs (officer, officer_citizenid, action, target, details, timestamp)
        VALUES (?, ?, ?, ?, ?, NOW())
    ]]
    
    exports.oxmysql:execute(query, {
        data.officer or 'Unknown',
        player.PlayerData.citizenid,
        data.action,
        data.target or '',
        data.details or '',
    })
end)