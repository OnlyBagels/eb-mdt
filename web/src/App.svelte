<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fetchNui, onNuiEvent, isEnvBrowser } from './lib/utils/fetchNui';
  import Dashboard from './lib/components/Dashboard.svelte';
  import Sidebar from './lib/components/Sidebar.svelte';
  import ProfilesPage from './lib/components/ProfilesPage.svelte';
  import VehiclesPage from './lib/components/VehiclesPage.svelte';
  import WeaponsPage from './lib/components/WeaponsPage.svelte';
  import FlagsPage from './lib/components/FlagsPage.svelte';
  import PenalCodePage from './lib/components/PenalCodePage.svelte';
  import ReportsPage from './lib/components/ReportsPage.svelte';
  import TrafficTicketViewer from './lib/components/TrafficTicketViewer.svelte';
  import DispatchPage from './lib/components/DispatchPage.svelte';
  import DispatchAlert from './lib/components/DispatchAlert.svelte';

  // State - visible defaults to true in browser for development
  let visible = $state(isEnvBrowser() ? true : false);
  let currentSection = $state('dashboard');
  let currentTime = $state(new Date());
  let isHeaderHovered = $state(false);

  // Traffic ticket viewer state
  let showTicketViewer = $state(false);
  let ticketViewerData = $state<any>(null);

  // Player and officer data - use mock data in browser
  let playerInfo = $state({
    name: isEnvBrowser() ? 'John Doe' : 'Loading...',
    callsign: isEnvBrowser() ? '1-A-1' : '...',
    department: isEnvBrowser() ? 'LSPD' : '...',
    rank: isEnvBrowser() ? 'Officer' : '...',
    jobName: isEnvBrowser() ? 'lspd' : '',
    gradeLevel: isEnvBrowser() ? 1 : 0,
    citizenid: isEnvBrowser() ? 'ABC12345' : ''
  });
  let onlineOfficers = $state<any[]>(isEnvBrowser() ? [
    { id: 1, name: 'John Doe', callsign: '1-A-1', department: 'LSPD', rank: 'Officer' },
    { id: 2, name: 'Jane Smith', callsign: '1-A-2', department: 'LSPD', rank: 'Sergeant' },
    { id: 3, name: 'Mike Johnson', callsign: '2-B-1', department: 'BCSO', rank: 'Deputy' }
  ] : []);
  let navigationData = $state<any>(null);

  // Menu items
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-tachometer-alt' },
    { id: 'dispatch', label: 'Dispatch', icon: 'fas fa-broadcast-tower' },
    { id: 'profiles', label: 'Profiles', icon: 'fas fa-user' },
    { id: 'reports', label: 'Reports', icon: 'fas fa-file-alt' },
    { id: 'vehicles', label: 'Vehicles', icon: 'fas fa-car' },
    { id: 'flags', label: 'Flags', icon: 'fas fa-flag' },
    { id: 'penalcode', label: 'Penal Code', icon: 'fas fa-balance-scale' },
    { id: 'weapons', label: 'Firearm Registry', icon: 'fas fa-crosshairs' }
  ];

  // Clock update
  let clockInterval: ReturnType<typeof setInterval>;

  onMount(() => {
    clockInterval = setInterval(() => {
      currentTime = new Date();
    }, 1000);

    // Setup NUI listeners
    const unsubVisible = onNuiEvent<boolean>('setVisible', (data) => {
      visible = data;
    });

    const unsubPlayerInfo = onNuiEvent('updatePlayerInfo', (data: any) => {
      playerInfo = data;
    });

    const unsubOfficers = onNuiEvent<any[]>('updateOnlineOfficers', (data) => {
      onlineOfficers = data;
    });

    // Listen for viewTicket events (from ox_inventory item or NPC menu)
    const unsubViewTicket = onNuiEvent<any>('viewTicket', (data) => {
      ticketViewerData = data;
      showTicketViewer = true;
      visible = true; // Make sure MDT is visible when viewing a ticket
    });

    // Sound player for dispatch alerts
    const unsubPlaySound = onNuiEvent<{ file: string; volume?: number }>('playSound', (data) => {
      try {
        const audio = new Audio(`nui://eb-mdt-ts-sqlite/sounds/${data.file}`);
        audio.volume = Math.min(1, Math.max(0, data.volume ?? 0.5));
        audio.play().catch(() => {});
      } catch (e) {
        // Silently fail
      }
    });

    // ESC key handler
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) {
        e.preventDefault();
        closeMDT();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubVisible();
      unsubPlayerInfo();
      unsubOfficers();
      unsubViewTicket();
      unsubPlaySound();
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

  onDestroy(() => {
    if (clockInterval) clearInterval(clockInterval);
  });

  function closeMDT() {
    // If ticket viewer is open, close it first
    if (showTicketViewer) {
      closeTicketViewer();
      return;
    }
    fetchNui('closeMDT', {});
    visible = false;
  }

  function closeTicketViewer() {
    showTicketViewer = false;
    ticketViewerData = null;
    fetchNui('closeMDT', {});
    visible = false;
  }

  function formatTime(date: Date) {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function formatDate(date: Date) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function handleNavigateToProfile(citizenid: string) {
    navigationData = { citizenid, timestamp: Date.now() };
    currentSection = 'profiles';
  }

  function handleNavigateToVehicle(plate: string) {
    navigationData = { searchQuery: plate, vehiclePlate: plate, timestamp: Date.now() };
    currentSection = 'vehicles';
  }

  function handleNavigateToReport(reportId: number) {
    navigationData = { reportId, timestamp: Date.now() };
    currentSection = 'reports';
  }

  function handleNavigateToFlags() {
    currentSection = 'flags';
  }

  function handleSectionChange(section: string) {
    // Clear navigation data when manually changing sections
    navigationData = null;
    currentSection = section;
  }
</script>

{#if visible}
<div class="fixed inset-0 flex items-center justify-center pointer-events-none" style="background: transparent;">
  <div
    class="w-[98vw] max-w-[2000px] h-[95vh] max-h-[1200px] overflow-hidden flex flex-col pointer-events-auto shadow-xl transition-opacity duration-300"
    style="opacity: {isHeaderHovered ? 0.25 : 1}; background-color: rgba(20, 20, 22, 0.95); border: 1px solid rgba(60, 60, 65, 0.8); border-radius: 4px;"
  >
    <!-- Main Layout -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar -->
      <Sidebar
        {menuItems}
        {currentSection}
        {playerInfo}
        onSectionChange={handleSectionChange}
        onLogout={closeMDT}
        onHeaderHover={(hovered) => isHeaderHovered = hovered}
      />

      <!-- Right Side - Header + Content -->
      <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
        <!-- Header -->
        <header
          class="h-14 flex items-center justify-center px-6 relative"
          style="background-color: rgba(35, 35, 40, 0.9); border-bottom: 1px solid rgba(60, 60, 65, 0.8);"
          onmouseenter={() => isHeaderHovered = true}
          onmouseleave={() => isHeaderHovered = false}
        >
          <h1 class="text-base font-semibold tracking-wide uppercase" style="color: rgba(255, 255, 255, 0.9);">
            Mobile Data Terminal
            {#if playerInfo.rank && playerInfo.name}
              <span class="font-normal ml-2" style="color: rgba(255, 255, 255, 0.5);">
                - {playerInfo.rank.replace(/\s*\(\d+\)/, '')} {playerInfo.name}
              </span>
            {/if}
          </h1>
          <div class="absolute right-6 flex items-center gap-4">
            <span class="text-xs font-medium" style="color: rgba(255, 255, 255, 0.5);">
              {formatDate(currentTime)}
            </span>
            <span class="text-xs font-mono tabular-nums" style="color: rgba(255, 255, 255, 0.5);">
              {formatTime(currentTime)}
            </span>
          </div>
        </header>

        <!-- Content Area -->
        <div class="flex-1 flex flex-col min-h-0 overflow-hidden" style="background-color: rgba(20, 20, 22, 0.95);">
          <div class="flex-1 min-h-0 p-2 overflow-hidden">
            {#if currentSection === 'dashboard'}
              <Dashboard
                {onlineOfficers}
                onNavigateToVehicle={handleNavigateToVehicle}
                onNavigateToFlags={handleNavigateToFlags}
              />
            {:else if currentSection === 'dispatch'}
              <DispatchPage />
            {:else if currentSection === 'profiles'}
              <ProfilesPage
                onViewProfile={handleNavigateToProfile}
                onNavigateToReport={handleNavigateToReport}
                {navigationData}
              />
            {:else if currentSection === 'reports'}
              <ReportsPage
                {playerInfo}
                {onlineOfficers}
                {navigationData}
              />
            {:else if currentSection === 'vehicles'}
              <VehiclesPage
                onViewProfile={handleNavigateToProfile}
                {navigationData}
              />
            {:else if currentSection === 'flags'}
              <FlagsPage
                onNavigateToVehicle={handleNavigateToVehicle}
              />
            {:else if currentSection === 'penalcode'}
              <PenalCodePage />
            {:else if currentSection === 'weapons'}
              <WeaponsPage
                onViewProfile={handleNavigateToProfile}
                {navigationData}
              />
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
{/if}

<!-- Traffic Ticket Viewer Modal (standalone, for viewing tickets from inventory/NPC) -->
{#if showTicketViewer && ticketViewerData}
<div class="fixed inset-0 flex items-center justify-center pointer-events-none" style="background: rgba(0, 0, 0, 0.7);">
  <div
    class="w-[500px] max-w-[95vw] h-[80vh] max-h-[700px] overflow-hidden flex flex-col pointer-events-auto shadow-xl"
    style="background-color: rgba(20, 20, 22, 0.98); border: 1px solid rgba(60, 60, 65, 0.8); border-radius: 4px;"
  >
    <TrafficTicketViewer
      ticketData={ticketViewerData}
      onClose={closeTicketViewer}
    />
  </div>
</div>
{/if}

<!-- Dispatch Alert Popup (always visible when on duty, outside MDT) -->
<DispatchAlert />
