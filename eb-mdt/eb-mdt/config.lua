return {

    -- MDT Access Jobs (law enforcement officer types)
    AllowedJobs = {
        'lspd',
        'bcso',
        'usms',
        'sasp'
    },
    
    -- Keybind to open MDT (can be changed by players)
    DefaultKeybind = 'F3',
    
    -- Auto-refresh intervals (in seconds)
    RefreshIntervals = {
        ActiveUnits = 5,
        Warrants = 30,
        BOLOs = 30,
    },
    
    -- Maximum number of items to display
    MaxDisplayItems = {
        Warrants = 50,
        BOLOs = 25,
        Announcements = 10,
    },
    
    -- Penal Code Categories
    PenalCodes = {
        {
            category = "Traffic Violations",
            codes = {
                { code = "1001", description = "Speeding", fine = 500 },
                { code = "1002", description = "Reckless Driving", fine = 750 },
                { code = "1003", description = "Running Red Light", fine = 300 },
            }
        },
        {
            category = "Misdemeanors",
            codes = {
                { code = "2001", description = "Disorderly Conduct", fine = 1000 },
                { code = "2002", description = "Public Intoxication", fine = 500 },
                { code = "2003", description = "Vandalism", fine = 1500 },
            }
        },
        {
            category = "Felonies",
            codes = {
                { code = "3001", description = "Armed Robbery", fine = 10000, jailTime = 60 },
                { code = "3002", description = "Murder", fine = 25000, jailTime = 120 },
                { code = "3003", description = "Drug Trafficking", fine = 15000, jailTime = 90 },
            }
        }
    }
}