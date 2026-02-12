<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchNui } from '../utils/fetchNui';

  // Types
  interface Profile {
    id: number;
    citizenid: string;
    firstname: string;
    lastname: string;
    birthdate: string;
    gender: string;
    nationality: string;
    phone: string;
    job: string;
    jobGrade: string;
    gangTags?: string | null;
    photoUrl?: string;
    hasWarrant?: boolean;
    convictionCount?: number;
  }

  interface DetailedProfile extends Profile {
    fingerprint: string;
    dna: string;
    bloodType: string;
    blood: string;
    jobDuty: boolean;
    jobs: Array<{ name: string; label: string; grade: number; gradeName: string; payment: number; isboss: boolean }>;
    licenses: Record<string, boolean>;
    vehicles: Array<{ id: number; plate: string; vehicle: string; garage: string; state: number }>;
    properties: Array<{ id: number; label: string; price: number; type: string }>;
    criminalRecord: { arrests: number; citations: number; warrants: number };
    notes?: string;
    registeredWeapons?: Array<{ id: number; weapon_type: string; serial_number: string; registration_date: string; status: string }>;
    canManageLicenses?: boolean;
    citizenGangs?: Array<{ id: number; gang_name: string; gang_color: string; tagged_by: string; tagged_at: string; notes: string }>;
    criminalCharges?: Array<{ id: number; report_id: number; report_number?: string; charge_code: string; charge_title: string; fine: number; months: number; created_at: string }>;
  }

  interface GangTag {
    id: number;
    name: string;
    label?: string;
    color?: string;
  }

  let {
    playerInfo,
    navigationData,
    onNavigateToVehicle,
    onNavigateToFirearm,
    onNavigateToReport
  }: {
    playerInfo: any;
    navigationData: any;
    onNavigateToVehicle: (plate: string) => void;
    onNavigateToFirearm: (serial: string) => void;
    onNavigateToReport?: (reportId: number) => void;
  } = $props();

  // State
  let searchQuery = $state('');
  let profiles = $state<Profile[]>([]);
  let loading = $state(false);
  let selectedProfile = $state<DetailedProfile | null>(null);
  let profileLoading = $state(false);
  let gangTags = $state<GangTag[]>([]);
  let profilePhoto = $state('');
  let profileNotes = $state('');
  let savingNotes = $state(false);
  let canManageLicenses = $state(false);
  let togglingLicense = $state<string | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout>;

  // License config
  const LICENSE_CONFIG = [
    { value: 'id', label: 'ID Card', icon: 'fas fa-id-card' },
    { value: 'driver', label: "Driver's License", icon: 'fas fa-credit-card' },
    { value: 'weapon', label: 'Weapon License', icon: 'fas fa-crosshairs' },
    { value: 'pilot', label: 'Pilot License', icon: 'fas fa-plane' },
    { value: 'hunting', label: 'Hunting License', icon: 'fas fa-tree' },
    { value: 'fishing', label: 'Fishing License', icon: 'fas fa-fish' }
  ];

  onMount(() => {
    loadGangTags();

    // Check license management permissions
    if (playerInfo) {
      const requiredRanks: Record<string, number> = { lspd: 10, bcso: 10, sasp: 4, dhs: 1 };
      const jobName = playerInfo.jobName?.toLowerCase() || '';
      const gradeLevel = playerInfo.gradeLevel || 0;
      canManageLicenses = requiredRanks[jobName] !== undefined && gradeLevel >= requiredRanks[jobName];
    }
  });

  // Handle navigation from other pages
  $effect(() => {
    if (navigationData?.citizenid) {
      viewProfile(navigationData.citizenid);
    }
  });

  // Debounced search
  $effect(() => {
    if (debounceTimer) clearTimeout(debounceTimer);

    if (!searchQuery.trim()) {
      profiles = [];
      return;
    }

    debounceTimer = setTimeout(() => {
      searchProfiles(searchQuery.trim());
    }, 150);
  });

  async function loadGangTags() {
    try {
      const tags = await fetchNui<GangTag[]>('getGangTags', {});
      gangTags = tags || [];
    } catch (error) {
      console.error('Error loading gang tags:', error);
    }
  }

  async function searchProfiles(query: string) {
    if (!query) return;

    loading = true;
    try {
      const results = await fetchNui<Profile[]>('searchProfiles', { query });
      profiles = results || [];
    } catch (error) {
      console.error('Error searching profiles:', error);
      profiles = [];
    } finally {
      loading = false;
    }
  }

  async function viewProfile(citizenid: string) {
    profileLoading = true;
    try {
      const profile = await fetchNui<DetailedProfile>('getProfile', { citizenid });
      if (profile) {
        selectedProfile = profile;
        profilePhoto = profile.photoUrl || '';
        profileNotes = profile.notes || '';
        if (profile.canManageLicenses !== undefined) {
          canManageLicenses = profile.canManageLicenses;
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      selectedProfile = null;
    } finally {
      profileLoading = false;
    }
  }

  async function toggleLicense(license: string, hasLicense: boolean) {
    if (!selectedProfile || !canManageLicenses || togglingLicense) return;

    togglingLicense = license;
    try {
      const result = await fetchNui<{ success: boolean }>(
        'updateLicense',
        { citizenid: selectedProfile.citizenid, license, value: !hasLicense }
      );

      if (result?.success && selectedProfile) {
        selectedProfile = {
          ...selectedProfile,
          licenses: { ...selectedProfile.licenses, [license]: !hasLicense }
        };
      }
    } catch (error) {
      console.error('Error toggling license:', error);
    } finally {
      togglingLicense = null;
    }
  }

  async function saveNotes() {
    if (!selectedProfile) return;

    savingNotes = true;
    try {
      await fetchNui('saveCitizenNotes', {
        citizenid: selectedProfile.citizenid,
        notes: profileNotes
      });
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      savingNotes = false;
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getVehicleState(state: number) {
    switch (state) {
      case 0: return 'Out';
      case 1: return 'Garaged';
      case 2: return 'Impounded';
      case 3: return 'Seized';
      default: return 'Unknown';
    }
  }
</script>

<div class="h-full flex gap-1 overflow-hidden">
  <!-- Left Column - Search -->
  <div class="w-72 mdt-card flex flex-col overflow-hidden">
    <div class="p-1 border-b border-mdt-border-subtle">
      <div class="relative">
        <i class="fas fa-search absolute left-2 top-1/2 -translate-y-1/2 text-xs text-mdt-text-subtle"></i>
        <input
          type="text"
          class="mdt-input w-full pl-8 pr-5"
          placeholder="Search by name, ID, phone..."
          bind:value={searchQuery}
        />
        {#if searchQuery}
          <button
            class="absolute right-2 top-1/2 -translate-y-1/2 text-mdt-text-subtle hover:text-mdt-text"
            onclick={() => searchQuery = ''}
          >
            <i class="fas fa-times text-xs"></i>
          </button>
        {/if}
      </div>
    </div>

    <div class="flex-1 overflow-auto custom-scrollbar">
      {#if loading}
        <div class="flex items-center justify-center py-8">
          <div class="loading-spinner"></div>
        </div>
      {:else if !searchQuery.trim()}
        <div class="flex flex-col items-center justify-center py-4 px-1">
          <i class="fas fa-search text-lg text-mdt-text-subtle mb-1"></i>
          <h3 class="text-xs font-semibold text-mdt-text mb-0.5">Search for a citizen</h3>
          <p class="text-xs text-mdt-text-muted text-center">Enter a name, ID, or phone</p>
        </div>
      {:else if profiles.length > 0}
        <div class="p-0.5">
          {#each profiles as profile (profile.citizenid)}
            {@const isSelected = selectedProfile?.citizenid === profile.citizenid}
            <div
              class="p-1 cursor-pointer transition-colors {isSelected ? 'bg-mdt-bg-surface border-l-2 border-l-primary-400' : 'hover:bg-mdt-bg-hover'}"
              style="border-radius: 2px;"
              onclick={() => viewProfile(profile.citizenid)}
            >
              <div class="flex gap-1">
                <img
                  src={profile.photoUrl || `https://ui-avatars.com/api/?name=${profile.firstname}+${profile.lastname}&background=1e3a5f&color=fff&size=128`}
                  alt="{profile.firstname} {profile.lastname}"
                  class="w-10 h-10 object-cover flex-shrink-0"
                  style="border-radius: 2px;"
                  onerror={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${profile.firstname}+${profile.lastname}&background=1e3a5f&color=fff&size=128`; }}
                />
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-xs text-mdt-text mb-0.5">{profile.firstname} {profile.lastname}</div>
                  <div class="flex gap-0.5 mb-0.5">
                    <span class="px-1 py-0.5 text-xs font-medium {profile.hasWarrant ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}" style="border-radius: 2px;">
                      {profile.hasWarrant ? 'Warrant' : 'Clear'}
                    </span>
                  </div>
                  <div class="flex items-center gap-0.5 text-xs text-mdt-text-muted">
                    <span class="font-mono text-[10px]">{profile.citizenid}</span>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="flex flex-col items-center justify-center py-4 px-1">
          <i class="fas fa-user-slash text-lg text-mdt-text-subtle mb-1"></i>
          <h3 class="text-xs font-semibold text-mdt-text mb-0.5">No profiles found</h3>
        </div>
      {/if}
    </div>
  </div>

  <!-- Middle Column - Profile Details -->
  <div class="flex-1 mdt-card flex flex-col overflow-hidden">
    {#if profileLoading}
      <div class="flex-1 flex items-center justify-center">
        <div class="loading-spinner"></div>
      </div>
    {:else if selectedProfile}
      <div class="p-1.5 border-b border-mdt-border-subtle flex gap-1.5">
        <!-- Photo -->
        <div class="w-20 h-20 overflow-hidden bg-mdt-bg-surface flex-shrink-0" style="border-radius: 2px;">
          <img
            src={profilePhoto || `https://ui-avatars.com/api/?name=${selectedProfile.firstname}+${selectedProfile.lastname}&background=1e3a5f&color=fff&size=256`}
            alt="{selectedProfile.firstname} {selectedProfile.lastname}"
            class="w-full h-full object-cover"
            onerror={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${selectedProfile.firstname}+${selectedProfile.lastname}&background=1e3a5f&color=fff&size=256`; }}
          />
        </div>

        <!-- Basic Info -->
        <div class="flex-1">
          <h2 class="text-sm font-semibold text-mdt-text mb-1">
            {selectedProfile.firstname} {selectedProfile.lastname}
          </h2>
          <div class="grid grid-cols-2 gap-0.5 text-xs">
            <div class="text-mdt-text-muted">
              <span class="text-mdt-text-subtle">ID:</span> {selectedProfile.citizenid}
            </div>
            <div class="text-mdt-text-muted">
              <span class="text-mdt-text-subtle">DOB:</span> {selectedProfile.birthdate}
            </div>
            <div class="text-mdt-text-muted">
              <span class="text-mdt-text-subtle">Gender:</span> {selectedProfile.gender === '0' || selectedProfile.gender === 'male' ? 'Male' : 'Female'}
            </div>
            <div class="text-mdt-text-muted">
              <span class="text-mdt-text-subtle">Phone:</span> {selectedProfile.phone || 'Unknown'}
            </div>
            <div class="text-mdt-text-muted">
              <span class="text-mdt-text-subtle">Nationality:</span> {selectedProfile.nationality || 'Unknown'}
            </div>
            <div class="text-mdt-text-muted">
              <span class="text-mdt-text-subtle">Job:</span> {selectedProfile.job || 'Unemployed'}
            </div>
          </div>
        </div>
      </div>

      <!-- Biometric Data -->
      <div class="p-1.5 border-b border-mdt-border-subtle">
        <h3 class="text-xs font-semibold text-mdt-text mb-1">Biometric Data</h3>
        <div class="grid grid-cols-3 gap-1">
          <div class="bg-mdt-bg-surface p-1" style="border-radius: 2px;">
            <div class="text-[10px] text-mdt-text-subtle mb-0.5">Fingerprint</div>
            <div class="text-xs font-mono text-mdt-text truncate">{selectedProfile.fingerprint || 'N/A'}</div>
          </div>
          <div class="bg-mdt-bg-surface p-1" style="border-radius: 2px;">
            <div class="text-[10px] text-mdt-text-subtle mb-0.5">DNA</div>
            <div class="text-xs font-mono text-mdt-text truncate">{selectedProfile.dna || 'N/A'}</div>
          </div>
          <div class="bg-mdt-bg-surface p-1" style="border-radius: 2px;">
            <div class="text-[10px] text-mdt-text-subtle mb-0.5">Blood Type</div>
            <div class="text-xs font-mono text-mdt-text">{selectedProfile.bloodType || 'N/A'}</div>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div class="p-1.5 flex-1 flex flex-col overflow-hidden">
        <div class="flex items-center justify-between mb-1">
          <h3 class="text-xs font-semibold text-mdt-text">Officer Notes</h3>
          <button
            class="mdt-button mdt-button-primary text-xs py-1 px-2"
            onclick={saveNotes}
            disabled={savingNotes}
          >
            {#if savingNotes}
              <div class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            {:else}
              <i class="fas fa-save text-[10px]"></i>
            {/if}
            Save
          </button>
        </div>
        <textarea
          class="mdt-input flex-1 resize-none text-xs"
          placeholder="Add notes about this citizen..."
          bind:value={profileNotes}
        ></textarea>
      </div>
    {:else}
      <div class="flex-1 flex flex-col items-center justify-center">
        <i class="fas fa-user text-2xl text-mdt-text-subtle mb-3"></i>
        <h3 class="text-sm font-semibold text-mdt-text mb-1">No Profile Selected</h3>
        <p class="text-xs text-mdt-text-muted">Select a profile from the search results</p>
      </div>
    {/if}
  </div>

  <!-- Right Column - Licenses, Vehicles, etc. -->
  <div class="w-72 mdt-card flex flex-col overflow-hidden">
    {#if selectedProfile}
      <div class="flex-1 overflow-auto custom-scrollbar p-1 space-y-1.5">
        <!-- Licenses -->
        <div>
          <h3 class="text-xs font-semibold text-mdt-text mb-0.5">Licenses</h3>
          <div class="space-y-0.5">
            {#each LICENSE_CONFIG as license}
              {@const hasLicense = selectedProfile.licenses?.[license.value] || false}
              <div class="flex items-center justify-between py-1 px-1 bg-mdt-bg-surface" style="border-radius: 2px;">
                <div class="flex items-center gap-1">
                  <i class="{license.icon} text-[10px] {hasLicense ? 'text-status-success' : 'text-mdt-text-subtle'}"></i>
                  <span class="text-xs text-mdt-text-muted">{license.label}</span>
                </div>
                {#if canManageLicenses}
                  <button
                    class="w-5 h-5 flex items-center justify-center transition-colors {hasLicense ? 'bg-status-success-muted text-status-success hover:bg-status-danger-muted hover:text-status-danger' : 'bg-mdt-bg-hover text-mdt-text-subtle hover:bg-status-success-muted hover:text-status-success'}"
                    style="border-radius: 2px;"
                    onclick={() => toggleLicense(license.value, hasLicense)}
                    disabled={togglingLicense === license.value}
                  >
                    {#if togglingLicense === license.value}
                      <div class="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin"></div>
                    {:else}
                      <i class="fas {hasLicense ? 'fa-check' : 'fa-plus'} text-[10px]"></i>
                    {/if}
                  </button>
                {:else}
                  <div class="w-4 h-4 flex items-center justify-center {hasLicense ? 'bg-status-success-muted' : 'bg-mdt-bg-hover'}" style="border-radius: 2px;">
                    <i class="fas {hasLicense ? 'fa-check text-status-success' : 'fa-times text-mdt-text-subtle'} text-[10px]"></i>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <!-- Vehicles -->
        {#if selectedProfile.vehicles && selectedProfile.vehicles.length > 0}
          <div>
            <h3 class="text-xs font-semibold text-mdt-text mb-0.5">Vehicles ({selectedProfile.vehicles.length})</h3>
            <div class="space-y-0.5">
              {#each selectedProfile.vehicles as vehicle}
                <div
                  class="py-1 px-1 bg-mdt-bg-surface hover:bg-mdt-bg-hover cursor-pointer transition-colors"
                  style="border-radius: 2px;"
                  onclick={() => onNavigateToVehicle(vehicle.plate)}
                >
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-mono text-mdt-text">{vehicle.plate}</span>
                    <span class="text-[10px] text-mdt-text-subtle">{getVehicleState(vehicle.state)}</span>
                  </div>
                  <div class="text-[10px] text-mdt-text-muted">{vehicle.vehicle}</div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Weapons -->
        {#if selectedProfile.registeredWeapons && selectedProfile.registeredWeapons.length > 0}
          <div>
            <h3 class="text-xs font-semibold text-mdt-text mb-0.5">Firearms ({selectedProfile.registeredWeapons.length})</h3>
            <div class="space-y-0.5">
              {#each selectedProfile.registeredWeapons as weapon}
                <div
                  class="py-1 px-1 bg-mdt-bg-surface hover:bg-mdt-bg-hover cursor-pointer transition-colors"
                  style="border-radius: 2px;"
                  onclick={() => onNavigateToFirearm(weapon.serial_number)}
                >
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-mdt-text">{weapon.weapon_type}</span>
                    <span class="px-1 py-0.5 text-[10px] font-medium {weapon.status === 'active' ? 'bg-status-success-muted text-status-success' : weapon.status === 'stolen' ? 'bg-status-danger-muted text-status-danger' : 'bg-status-warning-muted text-status-warning'}" style="border-radius: 2px;">
                      {weapon.status}
                    </span>
                  </div>
                  <div class="text-[10px] font-mono text-mdt-text-muted">{weapon.serial_number}</div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Criminal Record -->
        {#if selectedProfile.criminalCharges && selectedProfile.criminalCharges.length > 0}
          <div>
            <h3 class="text-xs font-semibold text-mdt-text mb-0.5">Criminal History ({selectedProfile.criminalCharges.length})</h3>
            <div class="space-y-0.5">
              {#each selectedProfile.criminalCharges.slice(0, 5) as charge}
                <button
                  class="w-full text-left py-1 px-1 bg-mdt-bg-surface hover:bg-mdt-bg-elevated transition-colors cursor-pointer"
                  style="border-radius: 2px;"
                  onclick={() => { if (onNavigateToReport && charge.report_id) onNavigateToReport(charge.report_id); }}
                >
                  <div class="flex items-center justify-between">
                    <div class="text-xs text-mdt-text">{charge.charge_title}</div>
                    {#if charge.report_number}
                      <span class="text-[10px] text-primary-400 font-mono">#{charge.report_number}</span>
                    {/if}
                  </div>
                  <div class="flex items-center gap-1 text-[10px] text-mdt-text-muted mt-0.5">
                    <span>${charge.fine}</span>
                    {#if charge.months > 0}
                      <span>•</span>
                      <span>{charge.months}mo</span>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="flex-1 flex items-center justify-center">
        <p class="text-xs text-mdt-text-muted">Select a profile</p>
      </div>
    {/if}
  </div>
</div>
