<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fetchNui, onNuiEvent, isEnvBrowser } from '../utils/fetchNui';
  import { loadPostals, getNearestPostal } from '../../utils/misc';

  // ox_inventory exact color scheme
  const c = {
    bg: 'rgba(20, 20, 22, 0.95)',
    card: 'rgba(35, 35, 40, 0.9)',
    popover: 'rgba(25, 25, 28, 0.95)',
    border: 'rgba(60, 60, 65, 0.8)',
    accent: 'rgba(45, 45, 50, 0.9)',
    primary: '#22c55e',
    primaryBg: 'rgba(34, 197, 94, 0.2)',
    foreground: 'rgba(255, 255, 255, 0.9)',
    muted: 'rgba(255, 255, 255, 0.5)',
    destructive: '#ef4444',
    warning: '#f59e0b',
    input: 'rgba(35, 35, 40, 0.9)',
    secondary: 'rgba(45, 45, 50, 0.95)',
    headerBg: 'rgba(0, 0, 0, 0.4)'
  };

  interface DispatchUnit {
    id: number;
    callId: string;
    citizenid: string;
    name: string;
    callsign: string;
    department: string;
    attachedAt: string;
  }

  interface DispatchCall {
    id: number;
    callId: string;
    message: string;
    codeName: string;
    code: string;
    icon: string;
    priority: 1 | 2 | 3;
    coords: { x: number; y: number; z: number };
    street: string;
    gender?: string;
    weapon?: string;
    vehicle?: string;
    plate?: string;
    color?: string;
    vehicleClass?: string;
    doors?: number;
    heading?: number;
    camId?: string;
    callsign?: string;
    name?: string;
    number?: string;
    information?: string;
    alertTime: number;
    jobs: string[];
    units: DispatchUnit[];
    createdAt: string;
    expiresAt: string;
    isExpired: boolean;
  }

  let calls = $state<DispatchCall[]>(isEnvBrowser() ? [
    {
      id: 1,
      callId: 'CALL-1234567890-1234',
      message: 'Shots Fired',
      codeName: 'shooting',
      code: '10-13',
      icon: 'fas fa-gun',
      priority: 2,
      coords: { x: 100.5, y: 200.5, z: 25.0 },
      street: 'Vinewood Blvd & Las Lagunas Blvd',
      gender: 'Male',
      weapon: 'Pistol',
      alertTime: 120,
      jobs: ['leo'],
      units: [],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120000).toISOString(),
      isExpired: false
    },
    {
      id: 2,
      callId: 'CALL-1234567890-5678',
      message: 'Vehicle Theft',
      codeName: 'vehicletheft',
      code: '10-16',
      icon: 'fas fa-car-burst',
      priority: 2,
      coords: { x: -200.5, y: 400.5, z: 30.0 },
      street: 'Alta Street',
      vehicle: 'Adder',
      plate: 'ABC123',
      color: 'Red',
      vehicleClass: 'Super',
      alertTime: 150,
      jobs: ['leo'],
      units: [
        { id: 1, callId: 'CALL-1234567890-5678', citizenid: 'ABC123', name: 'John Doe', callsign: '1-A-1', department: 'LSPD', attachedAt: new Date().toISOString() }
      ],
      createdAt: new Date(Date.now() - 60000).toISOString(),
      expiresAt: new Date(Date.now() + 90000).toISOString(),
      isExpired: false
    },
    {
      id: 3,
      callId: 'CALL-1234567890-9999',
      message: 'Officer Panic',
      codeName: 'emergencyButton',
      code: '10-99',
      icon: 'fas fa-skull-crossbones',
      priority: 1,
      coords: { x: 50.0, y: -100.0, z: 20.0 },
      street: 'Mission Row',
      callsign: '2-B-1',
      name: 'Mike Johnson',
      alertTime: 150,
      jobs: ['leo', 'ems'],
      units: [],
      createdAt: new Date(Date.now() - 30000).toISOString(),
      expiresAt: new Date(Date.now() + 120000).toISOString(),
      isExpired: false
    }
  ] : []);
  let selectedCall = $state<DispatchCall | null>(null);
  let isLoading = $state(false);
  let alertsMuted = $state(false);
  let alertsDisabled = $state(false);

  let refreshInterval: ReturnType<typeof setInterval>;

  // Current time for countdown timer
  let currentTime = $state(Date.now());

  onMount(() => {
    loadPostals();
    loadCalls();
    refreshInterval = setInterval(loadCalls, 10000);

    // Update current time every second for countdown
    const timeInterval = setInterval(() => {
      currentTime = Date.now();
    }, 1000);

    // Listen for dispatch events
    const unsubNewCall = onNuiEvent<{ call: DispatchCall }>('dispatch:newCall', (data) => {
      // Check if call already exists
      const exists = calls.find(c => c.callId === data.call.callId);
      if (!exists) {
        calls = [data.call, ...calls].slice(0, 50); // Keep more calls in MDT
      }
    });

    // NOTE: We intentionally do NOT listen to dispatch:callsExpired here
    // The MDT dispatch page keeps all calls until resource restart
    // Only the floating DispatchAlert popup removes expired calls

    const unsubUnitAttached = onNuiEvent<{ callId: string; unit: DispatchUnit }>('dispatch:unitAttached', (data) => {
      calls = calls.map(c => {
        if (c.callId === data.callId) {
          return { ...c, units: [...c.units, data.unit] };
        }
        return c;
      });
      if (selectedCall?.callId === data.callId) {
        selectedCall = { ...selectedCall, units: [...selectedCall.units, data.unit] };
      }
    });

    const unsubUnitDetached = onNuiEvent<{ callId: string; citizenid: string }>('dispatch:unitDetached', (data) => {
      calls = calls.map(c => {
        if (c.callId === data.callId) {
          return { ...c, units: c.units.filter(u => u.citizenid !== data.citizenid) };
        }
        return c;
      });
      if (selectedCall?.callId === data.callId) {
        selectedCall = { ...selectedCall, units: selectedCall.units.filter(u => u.citizenid !== data.citizenid) };
      }
    });

    return () => {
      clearInterval(timeInterval);
      unsubNewCall();
      unsubUnitAttached();
      unsubUnitDetached();
    };
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
  });

  async function loadCalls() {
    if (isEnvBrowser()) return;
    isLoading = true;
    try {
      const result = await fetchNui<{ calls: DispatchCall[]; canRespond: boolean }>('dispatch:getCalls', {});
      if (result) {
        calls = result.calls || [];
      }
    } catch (error) {
      console.error('Error loading dispatch calls:', error);
    } finally {
      isLoading = false;
    }
  }

  async function respondToCall(call: DispatchCall) {
    try {
      await fetchNui('dispatch:respondToCall', { callId: call.callId, coords: call.coords });
    } catch (error) {
      console.error('Error responding to call:', error);
    }
  }

  async function attachToCall(call: DispatchCall) {
    try {
      await fetchNui('dispatch:attachUnit', { callId: call.callId });
    } catch (error) {
      console.error('Error attaching to call:', error);
    }
  }

  async function detachFromCall(call: DispatchCall) {
    try {
      await fetchNui('dispatch:detachUnit', { callId: call.callId });
    } catch (error) {
      console.error('Error detaching from call:', error);
    }
  }

  async function clearBlips() {
    try {
      await fetchNui('dispatch:clearBlips', {});
    } catch (error) {
      console.error('Error clearing blips:', error);
    }
  }

  async function toggleMute() {
    alertsMuted = !alertsMuted;
    try {
      await fetchNui('dispatch:toggleMute', { muted: alertsMuted });
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  }

  async function toggleAlerts() {
    alertsDisabled = !alertsDisabled;
    try {
      await fetchNui('dispatch:toggleAlerts', { disabled: alertsDisabled });
    } catch (error) {
      console.error('Error toggling alerts:', error);
    }
  }

  function formatTime(dateString: string) {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function formatElapsedLive(createdAt: string) {
    // Handle both ISO format and "YYYY-MM-DD HH:mm:ss" format
    let createdTime: number;
    if (createdAt.includes('T') || createdAt.includes('Z')) {
      createdTime = new Date(createdAt).getTime();
    } else {
      // Format is "YYYY-MM-DD HH:mm:ss" - parse as UTC
      createdTime = new Date(createdAt.replace(' ', 'T') + 'Z').getTime();
    }

    const elapsed = currentTime - createdTime;
    if (elapsed < 0) return '0:00';

    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  function getPriorityColor(priority: number) {
    const colors: Record<number, { text: string; bg: string; border: string }> = {
      1: { text: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)', border: '#dc2626' },
      2: { text: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)', border: '#d97706' },
      3: { text: '#22c55e', bg: 'rgba(34, 197, 94, 0.2)', border: '#16a34a' }
    };
    return colors[priority] || colors[2];
  }

  function getPriorityLabel(priority: number) {
    const labels: Record<number, string> = { 1: 'HIGH', 2: 'MEDIUM', 3: 'LOW' };
    return labels[priority] || 'MEDIUM';
  }
</script>

<div class="h-full flex gap-2 overflow-hidden">
  <!-- Calls List -->
  <div class="w-2/5 flex flex-col overflow-hidden" style="background-color: {c.card}; border: 1px solid {c.border}; border-radius: 2px;">
    <!-- Header -->
    <div class="flex items-center justify-between px-2.5 py-1.5 flex-shrink-0" style="border-bottom: 1px solid {c.border};">
      <div class="flex items-center gap-1.5">
        <div class="w-5 h-5 flex items-center justify-center" style="background-color: rgba(239, 68, 68, 0.2); border-radius: 2px;">
          <i class="fas fa-broadcast-tower text-xs" style="color: #ef4444;"></i>
        </div>
        <h3 class="text-xs font-semibold" style="color: {c.foreground};">DISPATCH</h3>
        {#if calls.length > 0}
          <span class="px-1 py-0.5 text-xs font-medium" style="background-color: rgba(239, 68, 68, 0.2); color: #ef4444; border-radius: 2px;">{calls.length}</span>
        {/if}
      </div>
      <div class="flex items-center gap-1">
        <button
          class="w-6 h-6 flex items-center justify-center transition-colors"
          style="color: {alertsMuted ? c.warning : c.muted}; border-radius: 2px;"
          title={alertsMuted ? 'Unmute Alerts' : 'Mute Alerts'}
          onclick={toggleMute}
        >
          <i class="fas {alertsMuted ? 'fa-volume-mute' : 'fa-volume-up'} text-xs"></i>
        </button>
        <button
          class="w-6 h-6 flex items-center justify-center transition-colors"
          style="color: {alertsDisabled ? c.destructive : c.muted}; border-radius: 2px;"
          title={alertsDisabled ? 'Enable Alerts' : 'Disable Alerts'}
          onclick={toggleAlerts}
        >
          <i class="fas {alertsDisabled ? 'fa-bell-slash' : 'fa-bell'} text-xs"></i>
        </button>
        <button
          class="w-6 h-6 flex items-center justify-center transition-colors"
          style="color: {c.muted}; border-radius: 2px;"
          title="Clear All Blips"
          onclick={clearBlips}
        >
          <i class="fas fa-trash text-xs"></i>
        </button>
        <button
          class="w-6 h-6 flex items-center justify-center transition-colors"
          style="color: {c.muted}; border-radius: 2px;"
          title="Refresh"
          onclick={loadCalls}
        >
          <i class="fas fa-sync-alt text-xs {isLoading ? 'animate-spin' : ''}"></i>
        </button>
      </div>
    </div>

    <!-- Calls List -->
    <div class="flex-1 overflow-auto">
      {#if isLoading && calls.length === 0}
        <div class="flex items-center justify-center h-full">
          <div class="w-6 h-6 rounded-full animate-spin" style="border: 2px solid {c.primary}; border-top-color: transparent;"></div>
        </div>
      {:else if calls.length > 0}
        {#each calls as call (call.callId)}
          {@const priorityColor = getPriorityColor(call.priority)}
          <button
            class="w-full text-left px-2.5 py-2 cursor-pointer transition-colors"
            style="border-bottom: 1px solid {c.border}; border-left: 3px solid {priorityColor.border}; background-color: {selectedCall?.callId === call.callId ? c.accent : 'transparent'};"
            onclick={() => selectedCall = call}
          >
            <div class="flex items-center justify-between gap-1 mb-0.5">
              <div class="flex items-center gap-1.5">
                <i class="{call.icon} text-xs" style="color: {priorityColor.text};"></i>
                <span class="text-xs font-semibold" style="color: {c.foreground};">{call.message}</span>
              </div>
              <span class="px-1 py-0.5 text-xs font-medium" style="background-color: {priorityColor.bg}; color: {priorityColor.text}; border-radius: 2px;">
                {getPriorityLabel(call.priority)}
              </span>
            </div>
            <div class="flex items-center gap-1.5 text-xs" style="color: {c.muted};">
              {#if call.code}
                <span class="font-mono">{call.code}</span>
                <span>-</span>
              {/if}
              <span class="truncate">{call.street}{#if call.coords}{@const postal = getNearestPostal(call.coords.x, call.coords.y)}{#if postal} ({postal}){/if}{/if}</span>
            </div>
            <div class="flex items-center justify-between mt-0.5 text-xs" style="color: {c.muted};">
              <span class="flex items-center gap-1">
                <i class="fas fa-clock text-xs"></i>
                {formatElapsedLive(call.createdAt)}
              </span>
              {#if call.units.length > 0}
                <span class="flex items-center gap-0.5">
                  <i class="fas fa-users text-xs"></i>
                  {call.units.length}
                </span>
              {/if}
            </div>
          </button>
        {/each}
      {:else}
        <div class="flex flex-col items-center justify-center h-full">
          <div class="w-10 h-10 flex items-center justify-center mb-2" style="background-color: {c.accent}; border-radius: 2px;">
            <i class="fas fa-check-circle text-lg" style="color: {c.primary};"></i>
          </div>
          <span class="text-xs font-medium" style="color: {c.muted};">No active calls</span>
          <span class="text-xs mt-0.5" style="color: {c.muted};">All quiet</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Call Details -->
  <div class="flex-1 flex flex-col overflow-hidden" style="background-color: {c.card}; border: 1px solid {c.border}; border-radius: 2px;">
    {#if selectedCall}
      {@const priorityColor = getPriorityColor(selectedCall.priority)}

      <!-- Header -->
      <div class="flex items-center justify-between px-2.5 py-1.5 flex-shrink-0" style="border-bottom: 1px solid {c.border}; border-left: 3px solid {priorityColor.border};">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 flex items-center justify-center" style="background-color: {priorityColor.bg}; border-radius: 2px;">
            <i class="{selectedCall.icon}" style="color: {priorityColor.text};"></i>
          </div>
          <div>
            <h3 class="text-sm font-semibold" style="color: {c.foreground};">{selectedCall.message}</h3>
            <div class="flex items-center gap-1.5 text-xs" style="color: {c.muted};">
              {#if selectedCall.code}
                <span class="font-mono">{selectedCall.code}</span>
                <span>-</span>
              {/if}
              <span>{selectedCall.street}{#if selectedCall.coords}{@const postal = getNearestPostal(selectedCall.coords.x, selectedCall.coords.y)}{#if postal} ({postal}){/if}{/if}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="px-1.5 py-0.5 text-xs font-medium" style="background-color: {priorityColor.bg}; color: {priorityColor.text}; border-radius: 2px;">
            {getPriorityLabel(selectedCall.priority)}
          </span>
          <button
            class="px-2 py-1 text-xs font-medium flex items-center gap-1 transition-colors"
            style="background-color: {c.primary}; color: white; border-radius: 2px;"
            onclick={() => respondToCall(selectedCall!)}
          >
            <i class="fas fa-location-arrow"></i>
            Respond
          </button>
        </div>
      </div>

      <!-- Details Grid -->
      <div class="flex-1 overflow-auto p-2.5 space-y-3">
        <!-- Time Info -->
        <div class="grid grid-cols-2 gap-2">
          <div class="px-2.5 py-2" style="background-color: {c.accent}; border-radius: 2px;">
            <span class="text-xs font-medium block mb-0.5" style="color: {c.muted};">Received</span>
            <span class="text-sm font-medium" style="color: {c.foreground};">{formatTime(selectedCall.createdAt)}</span>
          </div>
          <div class="px-2.5 py-2" style="background-color: {c.accent}; border-radius: 2px;">
            <span class="text-xs font-medium block mb-0.5" style="color: {c.muted};">Elapsed</span>
            <span class="text-sm font-medium" style="color: {c.foreground};">{formatElapsedLive(selectedCall.createdAt)}</span>
          </div>
        </div>

        <!-- Additional Details -->
        {#if selectedCall.information || selectedCall.gender || selectedCall.weapon || selectedCall.vehicle}
          <div class="px-2.5 py-2" style="background-color: {c.accent}; border-radius: 2px;">
            <span class="text-xs font-semibold block mb-1.5" style="color: {c.foreground};">DETAILS</span>
            <div class="space-y-1">
              {#if selectedCall.information}
                <div class="flex items-start gap-2">
                  <i class="fas fa-info-circle text-xs mt-0.5" style="color: {c.muted};"></i>
                  <span class="text-xs" style="color: {c.foreground};">{selectedCall.information}</span>
                </div>
              {/if}
              {#if selectedCall.gender}
                <div class="flex items-center gap-2">
                  <i class="fas fa-user text-xs" style="color: {c.muted};"></i>
                  <span class="text-xs" style="color: {c.foreground};">Gender: {selectedCall.gender}</span>
                </div>
              {/if}
              {#if selectedCall.weapon}
                <div class="flex items-center gap-2">
                  <i class="fas fa-crosshairs text-xs" style="color: {c.muted};"></i>
                  <span class="text-xs" style="color: {c.foreground};">Weapon: {selectedCall.weapon}</span>
                </div>
              {/if}
              {#if selectedCall.callsign && selectedCall.name}
                <div class="flex items-center gap-2">
                  <i class="fas fa-id-badge text-xs" style="color: {c.muted};"></i>
                  <span class="text-xs" style="color: {c.foreground};">Officer: {selectedCall.callsign} - {selectedCall.name}</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Vehicle Info -->
        {#if selectedCall.vehicle || selectedCall.plate}
          <div class="px-2.5 py-2" style="background-color: {c.accent}; border-radius: 2px;">
            <span class="text-xs font-semibold block mb-1.5" style="color: {c.foreground};">VEHICLE</span>
            <div class="grid grid-cols-2 gap-2">
              {#if selectedCall.vehicle}
                <div>
                  <span class="text-xs block" style="color: {c.muted};">Model</span>
                  <span class="text-xs font-medium" style="color: {c.foreground};">{selectedCall.vehicle}</span>
                </div>
              {/if}
              {#if selectedCall.plate}
                <div>
                  <span class="text-xs block" style="color: {c.muted};">Plate</span>
                  <span class="text-xs font-mono font-medium" style="color: {c.foreground};">{selectedCall.plate}</span>
                </div>
              {/if}
              {#if selectedCall.color}
                <div>
                  <span class="text-xs block" style="color: {c.muted};">Color</span>
                  <span class="text-xs font-medium" style="color: {c.foreground};">{selectedCall.color}</span>
                </div>
              {/if}
              {#if selectedCall.vehicleClass}
                <div>
                  <span class="text-xs block" style="color: {c.muted};">Class</span>
                  <span class="text-xs font-medium" style="color: {c.foreground};">{selectedCall.vehicleClass}</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Coordinates -->
        <div class="px-2.5 py-2" style="background-color: {c.accent}; border-radius: 2px;">
          <span class="text-xs font-semibold block mb-1" style="color: {c.foreground};">LOCATION</span>
          <span class="text-xs font-mono" style="color: {c.muted};">
            X: {selectedCall.coords.x.toFixed(2)} | Y: {selectedCall.coords.y.toFixed(2)} | Z: {selectedCall.coords.z.toFixed(2)}
          </span>
        </div>

        <!-- Responding Units -->
        <div class="px-2.5 py-2" style="background-color: {c.accent}; border-radius: 2px;">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-semibold" style="color: {c.foreground};">RESPONDING UNITS</span>
            <span class="text-xs" style="color: {c.muted};">{selectedCall.units.length} unit(s)</span>
          </div>
          {#if selectedCall.units.length > 0}
            <div class="space-y-1">
              {#each selectedCall.units as unit (unit.id)}
                <div class="flex items-center justify-between px-2 py-1" style="background-color: {c.card}; border-radius: 2px;">
                  <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full" style="background-color: {c.primary};"></div>
                    <span class="text-xs font-medium" style="color: {c.foreground};">{unit.name}</span>
                    <span class="text-xs font-mono" style="color: {c.muted};">{unit.callsign}</span>
                  </div>
                  <span class="text-xs" style="color: {c.muted};">{unit.department}</span>
                </div>
              {/each}
            </div>
          {:else}
            <div class="flex items-center gap-2 text-xs" style="color: {c.muted};">
              <i class="fas fa-exclamation-circle"></i>
              <span>No units responding</span>
            </div>
          {/if}
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-2">
          <button
            class="flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            style="background-color: {c.primary}; color: white; border-radius: 2px;"
            onclick={() => attachToCall(selectedCall!)}
          >
            <i class="fas fa-plus"></i>
            Attach
          </button>
          <button
            class="flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            style="background-color: {c.secondary}; color: {c.foreground}; border: 1px solid {c.border}; border-radius: 2px;"
            onclick={() => detachFromCall(selectedCall!)}
          >
            <i class="fas fa-minus"></i>
            Detach
          </button>
        </div>
      </div>
    {:else}
      <div class="flex flex-col items-center justify-center h-full">
        <div class="w-12 h-12 flex items-center justify-center mb-2" style="background-color: {c.accent}; border-radius: 2px;">
          <i class="fas fa-broadcast-tower text-xl" style="color: {c.muted};"></i>
        </div>
        <span class="text-sm font-medium" style="color: {c.muted};">Select a call</span>
        <span class="text-xs mt-0.5" style="color: {c.muted};">Click on a call to view details</span>
      </div>
    {/if}
  </div>
</div>
