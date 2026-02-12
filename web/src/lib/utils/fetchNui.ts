// NUI Fetch utility for FiveM
export const isEnvBrowser = (): boolean => !(window as any).invokeNative;

// Mock data for browser development
const mockData: Record<string, any> = {
  getAnnouncements: [
    { id: 1, title: 'Officer Meeting', content: 'All officers report to PD at 1800 hours.', importance: 'high', created_by: 'Sgt. Johnson', created_at: new Date().toISOString() },
    { id: 2, title: 'New SOP Update', content: 'Please review the updated pursuit policies.', importance: 'normal', created_by: 'Lt. Smith', created_at: new Date().toISOString() }
  ],
  getActiveBolos: [
    { id: 1, plate: 'ABC123', description: 'Red Dominator, suspect armed and dangerous', reported_by: 'Officer Davis', created_at: new Date().toISOString(), flag_type: 'bolo' },
    { id: 2, plate: 'XYZ789', description: 'Blue Sultan, fleeing from traffic stop', reported_by: 'Officer Wilson', created_at: new Date().toISOString(), flag_type: 'stolen' }
  ],
  searchProfiles: [
    { citizenid: 'ABC12345', firstname: 'John', lastname: 'Doe', birthdate: '1990-05-15', phone: '555-1234', gangTag: null },
    { citizenid: 'DEF67890', firstname: 'Jane', lastname: 'Smith', birthdate: '1985-08-22', phone: '555-5678', gangTag: 'Ballas' }
  ],
  getProfile: {
    citizenid: 'ABC12345',
    firstname: 'John',
    lastname: 'Doe',
    birthdate: '1990-05-15',
    phone: '555-1234',
    fingerprint: 'FP-12345',
    dna: 'DNA-67890',
    gangTag: null,
    notes: 'No prior incidents.',
    mugshot: null,
    licenses: [
      { type: 'driver', label: "Driver's License", active: true },
      { type: 'weapon', label: 'Weapons License', active: false },
      { type: 'hunting', label: 'Hunting License', active: true }
    ],
    vehicles: [
      { id: 1, plate: 'ABC123', model: 'Dominator', state: 1 }
    ],
    weapons: [
      { id: 1, serial_number: 'WPN-001', weapon_type: 'pistol', status: 'active' }
    ],
    charges: [
      { id: 1, charge_title: 'Speeding', charge_class: 'Infraction', fine: 500, months: 0, created_at: new Date().toISOString() }
    ]
  },
  searchVehicles: [
    { id: 1, plate: 'ABC123', model: 'Dominator', owner: 'John Doe', citizenid: 'ABC12345', state: 1 },
    { id: 2, plate: 'XYZ789', model: 'Sultan', owner: 'Jane Smith', citizenid: 'DEF67890', state: 0 }
  ],
  getVehicle: {
    id: 1,
    plate: 'ABC123',
    model: 'Dominator',
    owner: 'John Doe',
    citizenid: 'ABC12345',
    state: 1,
    locationStatus: 'Garage',
    flags: [
      { id: 1, flag_type: 'bolo', description: 'Vehicle of interest', reported_by: 'Officer Jones', created_at: new Date().toISOString(), is_active: true }
    ]
  },
  getAllVehicleFlags: [
    { id: 1, plate: 'ABC123', flag_type: 'bolo', description: 'Vehicle of interest', reported_by: 'Officer Jones', created_at: new Date().toISOString(), is_active: true, source: 'mdt' },
    { id: 2, plate: 'XYZ789', flag_type: 'stolen', description: 'Reported stolen from Sandy Shores', reported_by: 'Officer Davis', created_at: new Date().toISOString(), is_active: true, source: 'mdt' }
  ],
  getAIIntegrationEnabled: false,
  getWeaponRegistry: {
    weapons: [
      { id: 1, citizen_id: 'ABC12345', owner_name: 'John Doe', weapon_type: 'pistol', weapon_model: 'Glock 19', serial_number: 'WPN-001', registration_date: new Date().toISOString(), notes: '', status: 'active' },
      { id: 2, citizen_id: 'DEF67890', owner_name: 'Jane Smith', weapon_type: 'rifle', weapon_model: 'AR-15', serial_number: 'WPN-002', registration_date: new Date().toISOString(), notes: 'Hunting use only', status: 'active' }
    ],
    canManage: true
  },
  getReports: [
    { id: 1, report_number: 'RPT-001', title: 'Traffic Stop - Speeding', type: 'traffic', status: 'open', priority: 'normal', created_by: 'Officer Jones', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 2, report_number: 'RPT-002', title: 'Armed Robbery - Fleeca Bank', type: 'incident', status: 'open', priority: 'high', created_by: 'Sgt. Davis', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ],
  getReport: {
    report: { id: 1, title: 'Traffic Stop - Speeding', type: 'traffic', status: 'open', priority: 'normal', content: 'Subject was pulled over for speeding on Route 68.', location: 'Route 68', tags: ['traffic', 'speeding'] },
    officers: [{ officer_name: 'Officer Jones', officer_callsign: '1-A-1' }],
    involved: [],
    charges: [],
    evidence: []
  },
  searchCitizensForReport: [
    { citizenid: 'ABC12345', name: 'John Doe', phone: '555-1234' },
    { citizenid: 'DEF67890', name: 'Jane Smith', phone: '555-5678' }
  ]
};

export async function fetchNui<T = unknown>(eventName: string, data?: unknown): Promise<T> {
  if (isEnvBrowser()) {
    // Return mock data for browser development
    return new Promise((resolve) => {
      setTimeout(() => {
        const result = mockData[eventName] ?? ({} as T);
        console.log(`[Mock NUI] ${eventName}:`, result);
        resolve(result as T);
      }, 150);
    });
  }

  const resourceName = (window as any).GetParentResourceName
    ? (window as any).GetParentResourceName()
    : 'eb-mdt';

  const response = await fetch(`https://${resourceName}/${eventName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8'
    },
    body: JSON.stringify(data)
  });

  return response.json();
}

export function onNuiEvent<T = unknown>(action: string, handler: (data: T) => void): () => void {
  const eventHandler = (event: MessageEvent) => {
    const { action: eventAction, data } = event.data;
    if (eventAction === action) {
      handler(data as T);
    }
  };

  window.addEventListener('message', eventHandler);
  return () => window.removeEventListener('message', eventHandler);
}
