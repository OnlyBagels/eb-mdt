-- MDT SQLite Schema
-- This file contains all MDT-specific tables that are stored locally in SQLite

-- Reports table
CREATE TABLE IF NOT EXISTS mdt_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'incident' CHECK(type IN ('incident', 'arrest', 'traffic', 'citation', 'investigation', 'other')),
  status TEXT DEFAULT 'open' CHECK(status IN ('open', 'pending', 'closed', 'archived')),
  priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'critical')),
  content TEXT,
  location TEXT,
  created_by TEXT,
  created_by_citizenid TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT,
  is_ticket INTEGER DEFAULT 0,
  ticket_data TEXT
);

CREATE INDEX IF NOT EXISTS idx_reports_report_number ON mdt_reports(report_number);
CREATE INDEX IF NOT EXISTS idx_reports_status ON mdt_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_type ON mdt_reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON mdt_reports(created_at);

-- Report officers table
CREATE TABLE IF NOT EXISTS mdt_report_officers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  officer_name TEXT,
  officer_citizenid TEXT,
  officer_callsign TEXT,
  FOREIGN KEY (report_id) REFERENCES mdt_reports(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_report_officers_report_id ON mdt_report_officers(report_id);

-- Report involved parties table
CREATE TABLE IF NOT EXISTS mdt_report_involved (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  citizenid TEXT,
  name TEXT,
  role TEXT DEFAULT 'suspect' CHECK(role IN ('suspect', 'victim', 'witness', 'accomplice', 'person_of_interest')),
  notes TEXT,
  FOREIGN KEY (report_id) REFERENCES mdt_reports(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_report_involved_report_id ON mdt_report_involved(report_id);
CREATE INDEX IF NOT EXISTS idx_report_involved_citizenid ON mdt_report_involved(citizenid);

-- Report charges table
CREATE TABLE IF NOT EXISTS mdt_report_charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  citizenid TEXT,
  charge_code TEXT,
  charge_title TEXT,
  charge_class TEXT,
  fine INTEGER DEFAULT 0,
  months INTEGER DEFAULT 0,
  guilty_plea INTEGER DEFAULT 0,
  FOREIGN KEY (report_id) REFERENCES mdt_reports(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_report_charges_report_id ON mdt_report_charges(report_id);
CREATE INDEX IF NOT EXISTS idx_report_charges_citizenid ON mdt_report_charges(citizenid);

-- Report evidence table
CREATE TABLE IF NOT EXISTS mdt_report_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  type TEXT DEFAULT 'other' CHECK(type IN ('photo', 'video', 'document', 'audio', 'other')),
  title TEXT,
  description TEXT,
  url TEXT,
  added_by TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES mdt_reports(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_report_evidence_report_id ON mdt_report_evidence(report_id);

-- Vehicle flags table
CREATE TABLE IF NOT EXISTS mdt_vehicle_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL,
  flag_type TEXT DEFAULT 'bolo' CHECK(flag_type IN ('bolo', 'stolen', 'warrant', 'suspicious', 'wanted')),
  description TEXT,
  reported_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_vehicle_flags_vehicle_id ON mdt_vehicle_flags(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_flags_is_active ON mdt_vehicle_flags(is_active);

-- Weapon registry table
CREATE TABLE IF NOT EXISTS mdt_weapon_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  citizen_id TEXT NOT NULL,
  weapon_type TEXT NOT NULL,
  weapon_model TEXT,
  serial_number TEXT UNIQUE NOT NULL,
  registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'stolen', 'destroyed', 'lost', 'surrendered'))
);

CREATE INDEX IF NOT EXISTS idx_weapon_registry_citizen_id ON mdt_weapon_registry(citizen_id);
CREATE INDEX IF NOT EXISTS idx_weapon_registry_serial_number ON mdt_weapon_registry(serial_number);
CREATE INDEX IF NOT EXISTS idx_weapon_registry_status ON mdt_weapon_registry(status);

-- Announcements table
CREATE TABLE IF NOT EXISTS mdt_announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT,
  author_citizenid TEXT,
  department TEXT,
  importance TEXT DEFAULT 'medium' CHECK(importance IN ('low', 'medium', 'high', 'critical')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL
);

CREATE INDEX IF NOT EXISTS idx_announcements_importance ON mdt_announcements(importance);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON mdt_announcements(created_at);
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON mdt_announcements(expires_at);

-- Citizen gang tags table
CREATE TABLE IF NOT EXISTS mdt_citizen_gangs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  citizenid TEXT NOT NULL,
  gang_id INTEGER NOT NULL,
  tagged_by TEXT,
  tagged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_citizen_gangs_citizenid ON mdt_citizen_gangs(citizenid);
CREATE INDEX IF NOT EXISTS idx_citizen_gangs_gang_id ON mdt_citizen_gangs(gang_id);

-- Gang tags reference table
CREATE TABLE IF NOT EXISTS mdt_gang_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#ffffff',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Profile notes table
CREATE TABLE IF NOT EXISTS mdt_profile_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  citizenid TEXT NOT NULL UNIQUE,
  notes TEXT,
  updated_by TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profile_notes_citizenid ON mdt_profile_notes(citizenid);

-- Profile mugshots table
CREATE TABLE IF NOT EXISTS mdt_profile_mugshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  citizenid TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  uploaded_by TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profile_mugshots_citizenid ON mdt_profile_mugshots(citizenid);

-- Warrants table
CREATE TABLE IF NOT EXISTS mdt_warrants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  warrant_number TEXT UNIQUE NOT NULL,
  citizenid TEXT NOT NULL,
  charges TEXT NOT NULL,
  description TEXT,
  issued_by TEXT,
  issued_by_citizenid TEXT,
  issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'served', 'expired', 'cancelled')),
  served_by TEXT,
  served_at DATETIME NULL
);

CREATE INDEX IF NOT EXISTS idx_warrants_citizenid ON mdt_warrants(citizenid);
CREATE INDEX IF NOT EXISTS idx_warrants_status ON mdt_warrants(status);
CREATE INDEX IF NOT EXISTS idx_warrants_warrant_number ON mdt_warrants(warrant_number);

-- Triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_reports_timestamp
AFTER UPDATE ON mdt_reports
FOR EACH ROW
BEGIN
  UPDATE mdt_reports SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_profile_notes_timestamp
AFTER UPDATE ON mdt_profile_notes
FOR EACH ROW
BEGIN
  UPDATE mdt_profile_notes SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- ==========================================
-- Dispatch Tables
-- ==========================================

-- Dispatch calls table
CREATE TABLE IF NOT EXISTS mdt_dispatch_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id TEXT UNIQUE NOT NULL,
  message TEXT NOT NULL,
  code_name TEXT NOT NULL,
  code TEXT,
  icon TEXT,
  priority INTEGER DEFAULT 2 CHECK(priority IN (1, 2, 3)),
  coords_x REAL NOT NULL,
  coords_y REAL NOT NULL,
  coords_z REAL NOT NULL,
  street TEXT,
  gender TEXT,
  weapon TEXT,
  vehicle TEXT,
  plate TEXT,
  color TEXT,
  vehicle_class TEXT,
  doors INTEGER,
  heading REAL,
  cam_id TEXT,
  callsign TEXT,
  name TEXT,
  phone_number TEXT,
  information TEXT,
  alert_time INTEGER DEFAULT 120,
  jobs TEXT NOT NULL,
  blip_data TEXT NOT NULL,
  automatic_gunfire INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  is_expired INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_dispatch_calls_call_id ON mdt_dispatch_calls(call_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_calls_code_name ON mdt_dispatch_calls(code_name);
CREATE INDEX IF NOT EXISTS idx_dispatch_calls_created_at ON mdt_dispatch_calls(created_at);
CREATE INDEX IF NOT EXISTS idx_dispatch_calls_expires_at ON mdt_dispatch_calls(expires_at);
CREATE INDEX IF NOT EXISTS idx_dispatch_calls_is_expired ON mdt_dispatch_calls(is_expired);

-- Dispatch units table (officers attached to calls)
CREATE TABLE IF NOT EXISTS mdt_dispatch_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id TEXT NOT NULL,
  citizenid TEXT NOT NULL,
  name TEXT NOT NULL,
  callsign TEXT,
  department TEXT,
  attached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (call_id) REFERENCES mdt_dispatch_calls(call_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dispatch_units_call_id ON mdt_dispatch_units(call_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_units_citizenid ON mdt_dispatch_units(citizenid);

-- Dispatch call history (for logging/statistics)
CREATE TABLE IF NOT EXISTS mdt_dispatch_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id TEXT NOT NULL,
  message TEXT NOT NULL,
  code_name TEXT NOT NULL,
  code TEXT,
  priority INTEGER,
  street TEXT,
  responded_by TEXT,
  response_time INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_dispatch_history_call_id ON mdt_dispatch_history(call_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_history_code_name ON mdt_dispatch_history(code_name);
CREATE INDEX IF NOT EXISTS idx_dispatch_history_created_at ON mdt_dispatch_history(created_at);
