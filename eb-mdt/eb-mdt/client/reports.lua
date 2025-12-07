-- client/reports.lua

-- NUI Callbacks for report operations

-- Get reports with filters
RegisterNuiCallback('getReports', function(data, cb)
    lib.callback('mdt:getReports', false, function(reports)
        cb(reports or {})
    end, data.filters)
end)

-- Get specific report details
RegisterNuiCallback('getReport', function(data, cb)
    lib.callback('mdt:getReport', false, function(report)
        cb(report)
    end, data.reportId)
end)

-- Create new report
RegisterNuiCallback('createReport', function(data, cb)
    lib.callback('mdt:createReport', false, function(result)
        cb(result)
    end, data)
end)

-- Update existing report
RegisterNuiCallback('updateReport', function(data, cb)
    lib.callback('mdt:updateReport', false, function(result)
        cb(result)
    end, data)
end)

-- Delete report
RegisterNuiCallback('deleteReport', function(data, cb)
    lib.callback('mdt:deleteReport', false, function(result)
        cb(result)
    end, data.reportId)
end)

-- Search citizens for adding to report
RegisterNuiCallback('searchCitizensForReport', function(data, cb)
    lib.callback('mdt:searchCitizensForReport', false, function(citizens)
        cb(citizens or {})
    end, data.query)
end)

-- Search officers for adding to report
RegisterNuiCallback('searchOfficersForReport', function(data, cb)
    lib.callback('mdt:searchOfficersForReport', false, function(officers)
        cb(officers or {})
    end, data.query)
end)

-- Apply charges from report
RegisterNuiCallback('applyChargesFromReport', function(data, cb)
    lib.callback('mdt:server:applyChargesFromReport', false, function(result)
        cb(result)
    end, data)
end)

-- Listen for report updates
RegisterNetEvent('mdt:refreshReports', function()
    SendNUI('refreshReports', {})
end)