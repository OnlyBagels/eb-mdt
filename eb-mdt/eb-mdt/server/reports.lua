-- server/reports.lua

-- Get all reports with filters
lib.callback.register('mdt:getReports', function(source, filters)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player is LEO and on duty
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        print('[MDT] Player not authorized or not on duty')
        return nil
    end
    
   -- print('[MDT] Getting reports with filters:', json.encode(filters or {}))
    
    -- Build query based on filters
    local query = [[
        SELECT 
            r.id,
            r.report_number,
            r.title,
            r.type,
            r.status,
            r.priority,
            r.created_by,
            r.created_by_citizenid,
            r.created_at,
            r.updated_at,
            COUNT(DISTINCT ri.id) as involved_count,
            COUNT(DISTINCT rc.id) as charge_count,
            COUNT(DISTINCT re.id) as evidence_count
        FROM mdt_reports r
        LEFT JOIN mdt_report_involved ri ON r.id = ri.report_id
        LEFT JOIN mdt_report_charges rc ON r.id = rc.report_id
        LEFT JOIN mdt_report_evidence re ON r.id = re.report_id
    ]]
    
    local whereConditions = {}
    local queryParams = {}
    
    -- Apply filters
    if filters then
        if filters.search and filters.search ~= '' then
            table.insert(whereConditions, "(LOWER(r.report_number) LIKE ? OR LOWER(r.title) LIKE ? OR LOWER(r.content) LIKE ?)")
            local searchPattern = '%' .. string.lower(filters.search) .. '%'
            table.insert(queryParams, searchPattern)
            table.insert(queryParams, searchPattern)
            table.insert(queryParams, searchPattern)
        end
        
        if filters.type and filters.type ~= 'all' then
            table.insert(whereConditions, "r.type = ?")
            table.insert(queryParams, filters.type)
        end
        
        if filters.status and filters.status ~= 'all' then
            table.insert(whereConditions, "r.status = ?")
            table.insert(queryParams, filters.status)
        end
        
        if filters.priority and filters.priority ~= 'all' then
            table.insert(whereConditions, "r.priority = ?")
            table.insert(queryParams, filters.priority)
        end
        
        if filters.dateFrom and filters.dateFrom ~= '' then
            table.insert(whereConditions, "r.created_at >= ?")
            table.insert(queryParams, filters.dateFrom)
        end
        
        if filters.dateTo and filters.dateTo ~= '' then
            table.insert(whereConditions, "r.created_at <= ?")
            table.insert(queryParams, filters.dateTo)
        end
    end
    
    if #whereConditions > 0 then
        query = query .. " WHERE " .. table.concat(whereConditions, " AND ")
    end
    
    query = query .. [[
        GROUP BY r.id
        ORDER BY r.created_at DESC
        LIMIT 50
    ]]
    
   -- print('[MDT] Executing query:', query)
  --  print('[MDT] With params:', json.encode(queryParams))
    
    local reports = exports.oxmysql:executeSync(query, queryParams)
    
   -- print('[MDT] Found reports:', reports and #reports or 0)
    
    if reports then
        for i, report in ipairs(reports) do
            --print(string.format('[MDT] Report %d: ID=%s, Number=%s, Title=%s', 
              --  i, tostring(report.id), tostring(report.report_number), tostring(report.title)))
        end
    end
    
    return reports or {}
end)

-- Search officers for report involvement
lib.callback.register('mdt:searchOfficersForReport', function(source, query)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player is LEO and on duty
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return nil
    end
    
    if not query or query == '' then
        return {}
    end
    
    local searchPattern = '%' .. string.lower(query) .. '%'
    
    -- Search for officers in the database
    local searchQuery = [[
        SELECT 
            p.citizenid,
            p.name,
            JSON_UNQUOTE(JSON_EXTRACT(p.charinfo, '$.firstname')) as firstname,
            JSON_UNQUOTE(JSON_EXTRACT(p.charinfo, '$.lastname')) as lastname,
            p.job,
            JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.callsign')) as callsign
        FROM players p
        WHERE 
            JSON_UNQUOTE(JSON_EXTRACT(p.job, '$.type')) = 'leo' AND
            (LOWER(p.name) LIKE ? OR
            LOWER(p.citizenid) LIKE ? OR
            LOWER(JSON_UNQUOTE(JSON_EXTRACT(p.charinfo, '$.firstname'))) LIKE ? OR
            LOWER(JSON_UNQUOTE(JSON_EXTRACT(p.charinfo, '$.lastname'))) LIKE ? OR
            CONCAT(LOWER(JSON_UNQUOTE(JSON_EXTRACT(p.charinfo, '$.firstname'))), ' ', LOWER(JSON_UNQUOTE(JSON_EXTRACT(p.charinfo, '$.lastname')))) LIKE ? OR
            LOWER(JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.callsign'))) LIKE ?)
        LIMIT 10
    ]]
    
    local officers = exports.oxmysql:executeSync(searchQuery, {
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
    })
    
    local results = {}
    
    if officers then
        for _, officer in ipairs(officers) do
            local jobData = json.decode(officer.job or '{}')
            local callsign = officer.callsign or 'NO CALLSIGN'
            
            table.insert(results, {
                citizenid = officer.citizenid,
                name = officer.firstname and (officer.firstname .. ' ' .. officer.lastname) or officer.name,
                callsign = callsign,
                department = jobData.label or 'Unknown',
                rank = jobData.grade and jobData.grade.name or 'Unknown'
            })
        end
    end
    
    return results
end)

-- Get specific report details
lib.callback.register('mdt:getReport', function(source, reportId)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player is LEO and on duty
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return nil
    end
    
    -- Get main report data
    local reportQuery = [[
        SELECT 
            id,
            report_number,
            title,
            type,
            status,
            priority,
            content,
            location,
            created_by,
            created_by_citizenid,
            created_at,
            updated_at,
            updated_by
        FROM mdt_reports
        WHERE id = ?
        LIMIT 1
    ]]
    
    local report = exports.oxmysql:singleSync(reportQuery, {reportId})
    
    if not report then
        return nil
    end
    
    -- Get involved parties
    local involvedQuery = [[
        SELECT 
            ri.id,
            ri.citizenid,
            ri.role,
            ri.notes,
            p.name,
            JSON_EXTRACT(p.charinfo, '$.firstname') as firstname,
            JSON_EXTRACT(p.charinfo, '$.lastname') as lastname,
            JSON_EXTRACT(p.charinfo, '$.phone') as phone
        FROM mdt_report_involved ri
        LEFT JOIN players p ON ri.citizenid = p.citizenid
        WHERE ri.report_id = ?
    ]]
    
    local involved = exports.oxmysql:executeSync(involvedQuery, {reportId}) or {}
    
    -- Get charges
    local chargesQuery = [[
        SELECT 
            id,
            citizenid,
            charge_code,
            charge_title,
            charge_class,
            fine,
            months,
            guilty_plea
        FROM mdt_report_charges
        WHERE report_id = ?
    ]]
    
    local charges = exports.oxmysql:executeSync(chargesQuery, {reportId}) or {}
    
    -- Get evidence
    local evidenceQuery = [[
        SELECT 
            id,
            evidence_id,
            description
        FROM mdt_report_evidence
        WHERE report_id = ?
    ]]
    
    local evidence = exports.oxmysql:executeSync(evidenceQuery, {reportId}) or {}
    
    -- Get officers
    local officersQuery = [[
        SELECT 
            id,
            officer_name,
            officer_citizenid,
            officer_callsign
        FROM mdt_report_officers
        WHERE report_id = ?
    ]]
    
    local officers = exports.oxmysql:executeSync(officersQuery, {reportId}) or {}
    
    return {
        report = report,
        involved = involved,
        charges = charges,
        evidence = evidence,
        officers = officers
    }
end)

-- Create new report
lib.callback.register('mdt:createReport', function(source, data)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player is LEO and on duty
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return {success = false, message = "Not authorized"}
    end
    
    local officerName = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname
    local officerCitizenId = player.PlayerData.citizenid
    
    -- Generate report number (format: YYYY-MMDD-XXXX)
    local date = os.date('%Y-%m%d')
    local countQuery = [[
        SELECT COUNT(*) as count 
        FROM mdt_reports 
        WHERE report_number LIKE ?
    ]]
    
    local countResult = exports.oxmysql:singleSync(countQuery, {date .. '-%'})
    local count = (countResult and countResult.count or 0) + 1
    local reportNumber = string.format('%s-%04d', date, count)
    
    -- Insert main report
    local insertQuery = [[
        INSERT INTO mdt_reports (
            report_number, title, type, status, priority, 
            content, location, created_by, created_by_citizenid
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ]]
    
    local reportId = exports.oxmysql:insertSync(insertQuery, {
        reportNumber,
        data.title,
        data.type,
        data.status or 'open',
        data.priority or 'normal',
        data.content,
        data.location,
        officerName,
        officerCitizenId
    })
    
    if not reportId then
        return {success = false, message = "Failed to create report"}
    end
    
    -- Add officers
    if data.officers and #data.officers > 0 then
        for _, officer in ipairs(data.officers) do
            local officerQuery = [[
                INSERT INTO mdt_report_officers (report_id, officer_name, officer_citizenid, officer_callsign)
                VALUES (?, ?, ?, ?)
            ]]
            
            exports.oxmysql:insertSync(officerQuery, {
                reportId,
                officer.name,
                officer.citizenid or '',
                officer.callsign
            })
        end
    end
    
    -- Add involved parties
    if data.involved and #data.involved > 0 then
        for _, person in ipairs(data.involved) do
            local involvedQuery = [[
                INSERT INTO mdt_report_involved (report_id, citizenid, role, notes)
                VALUES (?, ?, ?, ?)
            ]]
            
            exports.oxmysql:insertSync(involvedQuery, {
                reportId,
                person.citizenid,
                person.role,
                person.notes or ''
            })
        end
    end
    
    -- Add charges
    if data.charges and #data.charges > 0 then
        for _, charge in ipairs(data.charges) do
            local chargeQuery = [[
                INSERT INTO mdt_report_charges (
                    report_id, citizenid, charge_code, charge_title, 
                    charge_class, fine, months, guilty_plea
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ]]
            
            exports.oxmysql:insertSync(chargeQuery, {
                reportId,
                charge.citizenid,
                charge.code,
                charge.title,
                charge.class,
                charge.fine,
                charge.months,
                charge.guiltyPlea and 1 or 0
            })
        end
    end
    
    -- Add evidence
    if data.evidence and #data.evidence > 0 then
        for _, evidenceItem in ipairs(data.evidence) do
            local evidenceQuery = [[
                INSERT INTO mdt_report_evidence (report_id, evidence_id, description)
                VALUES (?, ?, ?)
            ]]
            
            exports.oxmysql:insertSync(evidenceQuery, {
                reportId,
                evidenceItem.evidenceId,
                evidenceItem.description or ''
            })
        end
    end
    
    -- Log the action
    TriggerEvent('mdt:server:log', {
        action = 'Report Created',
        officer = officerName,
        details = 'Report #' .. reportNumber .. ' - ' .. data.title
    })
    
    -- Notify other officers
    local players = exports.qbx_core:GetQBPlayers()
    for _, targetPlayer in pairs(players) do
        if targetPlayer and targetPlayer.PlayerData and targetPlayer.PlayerData.job.type == 'leo' and targetPlayer.PlayerData.job.onduty then
            TriggerClientEvent('qbx_core:notify', targetPlayer.PlayerData.source, {
                title = 'New Report',
                description = 'Report #' .. reportNumber .. ' created',
                type = 'info',
                duration = 5000
            })
        end
    end
    
    return {success = true, reportId = reportId, reportNumber = reportNumber}
end)

-- Update report
lib.callback.register('mdt:updateReport', function(source, data)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player is LEO and on duty
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return {success = false, message = "Not authorized"}
    end
    
    local officerName = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname
    
    -- Update main report
    local updateQuery = [[
        UPDATE mdt_reports
        SET title = ?, type = ?, status = ?, priority = ?, 
            content = ?, location = ?, updated_by = ?, updated_at = NOW()
        WHERE id = ?
    ]]
    
    local result = exports.oxmysql:executeSync(updateQuery, {
        data.title,
        data.type,
        data.status,
        data.priority,
        data.content,
        data.location,
        officerName,
        data.reportId
    })
    
    if not result or result.affectedRows == 0 then
        return {success = false, message = "Failed to update report"}
    end
    
    -- Update officers (remove and re-add)
    exports.oxmysql:executeSync('DELETE FROM mdt_report_officers WHERE report_id = ?', {data.reportId})
    
    if data.officers and #data.officers > 0 then
        for _, officer in ipairs(data.officers) do
            local officerQuery = [[
                INSERT INTO mdt_report_officers (report_id, officer_name, officer_citizenid, officer_callsign)
                VALUES (?, ?, ?, ?)
            ]]
            
            exports.oxmysql:insertSync(officerQuery, {
                data.reportId,
                officer.name,
                officer.citizenid or '',
                officer.callsign
            })
        end
    end
    
    -- Update involved parties (remove and re-add)
    exports.oxmysql:executeSync('DELETE FROM mdt_report_involved WHERE report_id = ?', {data.reportId})
    
    if data.involved and #data.involved > 0 then
        for _, person in ipairs(data.involved) do
            local involvedQuery = [[
                INSERT INTO mdt_report_involved (report_id, citizenid, role, notes)
                VALUES (?, ?, ?, ?)
            ]]
            
            exports.oxmysql:insertSync(involvedQuery, {
                data.reportId,
                person.citizenid,
                person.role,
                person.notes or ''
            })
        end
    end
    
    -- Update charges (remove and re-add)
    exports.oxmysql:executeSync('DELETE FROM mdt_report_charges WHERE report_id = ?', {data.reportId})
    
    if data.charges and #data.charges > 0 then
        for _, charge in ipairs(data.charges) do
            local chargeQuery = [[
                INSERT INTO mdt_report_charges (
                    report_id, citizenid, charge_code, charge_title, 
                    charge_class, fine, months, guilty_plea
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ]]
            
            exports.oxmysql:insertSync(chargeQuery, {
                data.reportId,
                charge.citizenid,
                charge.code,
                charge.title,
                charge.class,
                charge.fine,
                charge.months,
                charge.guiltyPlea and 1 or 0
            })
        end
    end
    
    -- Log the action
    TriggerEvent('mdt:server:log', {
        action = 'Report Updated',
        officer = officerName,
        details = 'Report ID: ' .. data.reportId
    })
    
    return {success = true}
end)

-- Delete report
lib.callback.register('mdt:deleteReport', function(source, reportId)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player is LEO and on duty with sufficient rank
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return {success = false, message = "Not authorized"}
    end
    
    -- Check if player has sufficient rank (Sergeant or above)
    local requiredRanks = {
        ['lspd'] = 5,
        ['bcso'] = 7,
        ['sasp'] = 3,
        ['usms'] = 1
    }
    
    local playerJob = player.PlayerData.job.name:lower()
    local playerGrade = player.PlayerData.job.grade.level or 0
    
    if not requiredRanks[playerJob] or playerGrade < requiredRanks[playerJob] then
        return {success = false, message = "Insufficient rank to delete reports"}
    end
    
    -- Get report details for logging
    local report = exports.oxmysql:singleSync('SELECT report_number FROM mdt_reports WHERE id = ?', {reportId})
    
    if not report then
        return {success = false, message = "Report not found"}
    end
    
    -- Delete all related data
    exports.oxmysql:executeSync('DELETE FROM mdt_report_officers WHERE report_id = ?', {reportId})
    exports.oxmysql:executeSync('DELETE FROM mdt_report_involved WHERE report_id = ?', {reportId})
    exports.oxmysql:executeSync('DELETE FROM mdt_report_charges WHERE report_id = ?', {reportId})
    exports.oxmysql:executeSync('DELETE FROM mdt_report_evidence WHERE report_id = ?', {reportId})
    
    -- Delete the report
    local result = exports.oxmysql:executeSync('DELETE FROM mdt_reports WHERE id = ?', {reportId})
    
    if result and result.affectedRows > 0 then
        local officerName = player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname
        
        -- Log the action
        TriggerEvent('mdt:server:log', {
            action = 'Report Deleted',
            officer = officerName,
            details = 'Report #' .. report.report_number
        })
        
        return {success = true}
    end
    
    return {success = false, message = "Failed to delete report"}
end)

-- Search citizens for report involvement
lib.callback.register('mdt:searchCitizensForReport', function(source, query)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    
    -- Verify player is LEO and on duty
    if not player or player.PlayerData.job.type ~= 'leo' or not player.PlayerData.job.onduty then
        return nil
    end
    
    if not query or query == '' then
        return {}
    end
    
    local searchPattern = '%' .. string.lower(query) .. '%'
    
    local searchQuery = [[
        SELECT 
            citizenid,
            name,
            JSON_EXTRACT(charinfo, '$.firstname') as firstname,
            JSON_EXTRACT(charinfo, '$.lastname') as lastname,
            JSON_EXTRACT(charinfo, '$.phone') as phone,
            JSON_EXTRACT(charinfo, '$.birthdate') as birthdate,
            JSON_EXTRACT(charinfo, '$.cid') as cid,
            phone_number
        FROM players
        WHERE 
            LOWER(name) LIKE ? OR
            LOWER(citizenid) LIKE ? OR
            LOWER(JSON_EXTRACT(charinfo, '$.firstname')) LIKE ? OR
            LOWER(JSON_EXTRACT(charinfo, '$.lastname')) LIKE ? OR
            CONCAT(LOWER(JSON_EXTRACT(charinfo, '$.firstname')), ' ', LOWER(JSON_EXTRACT(charinfo, '$.lastname'))) LIKE ?
        LIMIT 10
    ]]
    
    local citizens = exports.oxmysql:fetchSync(searchQuery, {
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
    })
    
    local results = {}
    
    if citizens then
        for _, citizen in ipairs(citizens) do
            -- Get phone number using the export
            local phoneNumber = exports.yseries:GetPhoneNumberByIdentifier(citizen.citizenid)
            
            -- Parse charinfo to get additional data
            local charinfo = {}
            if citizen.firstname then
                charinfo.firstname = citizen.firstname
                charinfo.lastname = citizen.lastname or ""
                charinfo.birthdate = citizen.birthdate
                charinfo.phone = citizen.phone
            end
            
            table.insert(results, {
                citizenid = citizen.citizenid,
                name = citizen.firstname and (citizen.firstname .. ' ' .. citizen.lastname) or citizen.name,
                phone = phoneNumber or citizen.phone_number or charinfo.phone or 'Unknown',
                birthdate = charinfo.birthdate,
                firstname = charinfo.firstname,
                lastname = charinfo.lastname
            })
        end
    end
    
    return results
end)