import { isEnvBrowser } from './misc';

// Mock data for browser development
const mockData: Record<string, unknown> = {
  getAnnouncements: {
    announcements: [
      { id: 1, title: 'Officer Meeting', content: 'All officers report to PD at 1800 hours.', importance: 'high', author: 'Sgt. Johnson', department: 'LSPD', created_at: new Date().toISOString(), canDelete: true },
      { id: 2, title: 'New SOP Update', content: 'Please review the updated pursuit policies.', importance: 'medium', author: 'Lt. Smith', department: 'LSPD', created_at: new Date().toISOString(), canDelete: false }
    ],
    canCreate: true
  },
  getActiveBolos: [
    { id: 1, plate: 'ABC123', reason: 'Red Dominator, suspect armed and dangerous', officer_name: 'Officer Davis', created_at: new Date().toISOString(), flag_type: 'bolo', is_active: true, priority: 'HIGH' },
    { id: 2, plate: 'XYZ789', reason: 'Blue Sultan, fleeing from traffic stop', officer_name: 'Officer Wilson', created_at: new Date().toISOString(), flag_type: 'stolen', is_active: true, priority: 'MEDIUM' }
  ],
  searchProfiles: [
    { citizenid: 'ABC12345', firstname: 'John', lastname: 'Doe', birthdate: '1990-05-15', phone: '555-1234', hasWarrant: false },
    { citizenid: 'DEF67890', firstname: 'Jane', lastname: 'Smith', birthdate: '1985-08-22', phone: '555-5678', gangTags: 'Ballas', hasWarrant: true }
  ],
  getProfile: {
    citizenid: 'ABC12345',
    firstname: 'John',
    lastname: 'Doe',
    birthdate: '1990-05-15',
    phone: '555-1234',
    fingerprint: 'FP-12345',
    dna: 'DNA-67890',
    bloodType: 'O+',
    gender: 'Male',
    nationality: 'American',
    job: 'Mechanic',
    jobGrade: 'Senior',
    notes: 'No prior incidents.',
    licenses: { driver: true, weapon: false, hunting: true },
    vehicles: [{ id: 1, plate: 'ABC123', vehicle: 'Dominator', state: 1 }],
    registeredWeapons: [{ id: 1, serial_number: 'WPN-001', weapon_type: 'pistol', status: 'active' }],
    criminalRecord: { arrests: 0, citations: 1, warrants: 0 },
    criminalCharges: [{ id: 1, charge_title: 'Speeding', charge_class: 'Infraction', fine: 500, months: 0, created_at: new Date().toISOString() }],
    canManageLicenses: true
  },
  searchVehicles: [
    { id: 1, plate: 'ABC123', model: 'Dominator', owner: 'John Doe', citizenid: 'ABC12345', state: 1, flags: [] },
    { id: 2, plate: 'XYZ789', model: 'Sultan', owner: 'Jane Smith', citizenid: 'DEF67890', state: 0, flags: [{ id: 1, flag_type: 'bolo', description: 'Wanted' }] }
  ],
  getVehicle: {
    id: 1,
    plate: 'ABC123',
    model: 'Dominator',
    owner: 'John Doe',
    citizenid: 'ABC12345',
    state: 1,
    locationStatus: 'Garaged',
    garage: 'Public Parking',
    canViewLocation: true,
    flags: [{ id: 1, flag_type: 'bolo', description: 'Vehicle of interest', reported_by: 'Officer Jones', created_at: new Date().toISOString(), is_active: true }]
  },
  getAllVehicleFlags: [
    { id: 'mdt_1', plate: 'ABC123', flag_type: 'bolo', description: 'Vehicle of interest', reported_by: 'Officer Jones', created_at: new Date().toISOString(), is_active: true, source: 'mdt' },
    { id: 'mdt_2', plate: 'XYZ789', flag_type: 'stolen', description: 'Reported stolen from Sandy Shores', reported_by: 'Officer Davis', created_at: new Date().toISOString(), is_active: true, source: 'mdt' }
  ],
  getAIIntegrationEnabled: false,
  getWeaponRegistry: {
    weapons: [
      { id: 1, citizen_id: 'ABC12345', owner_name: 'John Doe', weapon_type: 'Pistol', weapon_model: 'Combat Pistol', serial_number: 'WPN-001', registration_date: new Date().toISOString(), notes: '', status: 'active' },
      { id: 2, citizen_id: 'DEF67890', owner_name: 'Jane Smith', weapon_type: 'Rifle', weapon_model: 'Carbine Rifle', serial_number: 'WPN-002', registration_date: new Date().toISOString(), notes: 'Hunting use only', status: 'active' }
    ],
    totalCount: 2,
    canManage: true
  },
  getReports: [
    { id: 1, report_number: '2024-1228-0001', title: 'Traffic Stop - Speeding', type: 'traffic', status: 'open', priority: 'normal', created_by: 'Officer Jones', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), involved_count: 1, charge_count: 1, evidence_count: 0 },
    { id: 2, report_number: '2024-1228-0002', title: 'Armed Robbery - Fleeca Bank', type: 'incident', status: 'open', priority: 'high', created_by: 'Sgt. Davis', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), involved_count: 2, charge_count: 3, evidence_count: 2 }
  ],
  getReport: {
    report: { id: 1, report_number: '2024-1228-0001', title: 'Traffic Stop - Speeding', type: 'traffic', status: 'open', priority: 'normal', content: 'Subject was pulled over for speeding on Route 68.', location: 'Route 68' },
    officers: [{ id: 1, officer_name: 'Officer Jones', officer_callsign: '1-A-1' }],
    involved: [{ id: 1, citizenid: 'ABC12345', name: 'John Doe', role: 'suspect' }],
    charges: [{ id: 1, citizenid: 'ABC12345', charge_code: 'TC-001', charge_title: 'Speeding', charge_class: 'Infraction', fine: 500, months: 0, guilty_plea: false }],
    evidence: []
  },
  searchCitizensForReport: [
    { citizenid: 'ABC12345', name: 'John Doe', phone: '555-1234' },
    { citizenid: 'DEF67890', name: 'Jane Smith', phone: '555-5678' }
  ],
  searchOfficersForReport: [
    { citizenid: 'OFF001', name: 'Officer Jones', callsign: '1-A-1', department: 'LSPD', rank: 'Officer' },
    { citizenid: 'OFF002', name: 'Sgt. Davis', callsign: '1-L-1', department: 'LSPD', rank: 'Sergeant' }
  ],
  getGangTags: [
    { id: 1, name: 'Ballas', color: '#800080' },
    { id: 2, name: 'Families', color: '#00FF00' },
    { id: 3, name: 'Vagos', color: '#FFD700' }
  ]
};

export async function fetchNui<T = unknown>(
  eventName: string,
  data?: unknown,
  mock?: { data: T; delay?: number },
): Promise<T> {
  if (isEnvBrowser()) {
    // Use built-in mock data if no mock provided
    const mockResult = mock?.data ?? mockData[eventName];
    await new Promise((resolve) => setTimeout(resolve, mock?.delay ?? 150));
    console.log(`[Mock NUI] ${eventName}:`, mockResult);
    return (mockResult ?? {}) as T;
  }

  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(data),
  };

  const resourceName = window.GetParentResourceName ? window.GetParentResourceName() : 'eb-mdt';
  const resp = await fetch(`https://${resourceName}/${eventName}`, options);

  return (await resp.json()) as T;
}
