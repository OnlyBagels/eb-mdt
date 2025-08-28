-- client/profiles.lua

-- NUI Callbacks for profile operations

-- Search profiles - Modified to handle empty searches
RegisterNuiCallback('searchProfiles', function(data, cb)
    -- Only search if there's a query, otherwise return empty
    if not data.query or data.query == '' then
        cb({})
        return
    end
    
    lib.callback('mdt:searchProfiles', false, function(profiles)
        cb(profiles or {})
    end, data.query)
end)

-- Get specific profile
RegisterNuiCallback('getProfile', function(data, cb)
    lib.callback('mdt:getProfile', false, function(profile)
        cb(profile)
    end, data.citizenid)
end)

-- Remove the getAllProfiles callback since we don't want to load all profiles
-- RegisterNuiCallback('getAllProfiles', function(data, cb)
--     lib.callback('mdt:getAllProfiles', false, function(result)
--         cb(result or {profiles = {}, totalCount = 0, totalPages = 0, currentPage = 1})
--     end, data.page, data.perPage)
-- end)

-- GANG TAG CALLBACKS --

-- Get all gang tags
RegisterNuiCallback('getGangTags', function(data, cb)
    lib.callback('mdt:getGangTags', false, function(tags)
        cb(tags or {})
    end)
end)

-- Get citizen's gang affiliations
RegisterNuiCallback('getCitizenGangs', function(data, cb)
    lib.callback('mdt:getCitizenGangs', false, function(gangs)
        cb(gangs or {})
    end, data.citizenid)
end)

-- Add gang tag to citizen
RegisterNuiCallback('addGangTag', function(data, cb)
    lib.callback('mdt:addGangTag', false, function(result)
        cb(result)
    end, data)
end)

-- Remove gang tag from citizen
RegisterNuiCallback('removeGangTag', function(data, cb)
    lib.callback('mdt:removeGangTag', false, function(result)
        cb(result)
    end, data)
end)

-- LICENSE MANAGEMENT CALLBACKS --

-- Add license to citizen
RegisterNuiCallback('addLicense', function(data, cb)
    lib.callback('mdt:addLicense', false, function(result)
        cb(result)
    end, data)
end)

-- Remove license from citizen
RegisterNuiCallback('removeLicense', function(data, cb)
    lib.callback('mdt:removeLicense', false, function(result)
        cb(result)
    end, data)
end)

-- PHOTO AND NOTES CALLBACKS --

-- Get citizen photo
RegisterNuiCallback('getCitizenPhoto', function(data, cb)
    lib.callback('mdt:getCitizenPhoto', false, function(photo)
        cb(photo or {photoUrl = ""})
    end, data.citizenid)
end)

-- Update citizen photo
RegisterNuiCallback('updateCitizenPhoto', function(data, cb)
    lib.callback('mdt:updateCitizenPhoto', false, function(result)
        cb(result)
    end, data)
end)

-- Get citizen notes
RegisterNuiCallback('getCitizenNotes', function(data, cb)
    lib.callback('mdt:getCitizenNotes', false, function(notes)
        cb(notes or {notes = ""})
    end, data.citizenid)
end)

-- Save citizen notes
RegisterNuiCallback('saveCitizenNotes', function(data, cb)
    lib.callback('mdt:saveCitizenNotes', false, function(result)
        cb(result)
    end, data)
end)

-- CRIMINAL RECORD CALLBACKS --

-- Get citizen criminal statistics
RegisterNuiCallback('getCitizenCriminalStats', function(data, cb)
    lib.callback('mdt:getCitizenCriminalStats', false, function(stats)
        cb(stats or {arrests = 0, citations = 0, warrants = 0})
    end, data.citizenid)
end)

-- Get citizen's registered weapons
RegisterNuiCallback('getCitizenWeapons', function(data, cb)
    lib.callback('mdt:getCitizenWeapons', false, function(weapons)
        cb(weapons or {})
    end, data.citizenid)
end)