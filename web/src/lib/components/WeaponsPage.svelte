<script lang="ts">
  import { fetchNui } from '../utils/fetchNui';

  interface WeaponRegistration {
    id: number;
    citizen_id: string;
    owner_name?: string;
    weapon_type: string;
    weapon_model?: string;
    serial_number: string;
    registration_date: string;
    notes: string;
    status: string;
  }

  interface CitizenSearchResult {
    citizenid: string;
    name: string;
    phone: string;
  }

  let {
    onViewProfile,
    navigationData
  }: {
    onViewProfile: (citizenid: string) => void;
    navigationData: any;
  } = $props();

  const WEAPON_TYPES = [
    { value: 'pistol', label: 'Pistol' },
    { value: 'smg', label: 'SMG' },
    { value: 'shotgun', label: 'Shotgun' },
    { value: 'rifle', label: 'Rifle' },
    { value: 'sniper', label: 'Sniper Rifle' },
    { value: 'melee', label: 'Melee Weapon' },
    { value: 'other', label: 'Other' }
  ];

  let searchQuery = $state('');
  let statusFilter = $state<string | null>(null);
  let weapons = $state<WeaponRegistration[]>([]);
  let loading = $state(false);
  let canManage = $state(false);
  let expandedWeaponId = $state<number | null>(null);
  let expandedWeaponData = $state<WeaponRegistration | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout>;

  // Modal states
  let registrationModalOpen = $state(false);
  let editingWeapon = $state<WeaponRegistration | null>(null);
  let formData = $state({
    citizen_id: '',
    owner_name: '',
    weapon_type: '',
    weapon_model: '',
    serial_number: '',
    notes: '',
    status: 'active'
  });

  // Citizen search modal
  let citizenSearchModalOpen = $state(false);
  let citizenSearchQuery = $state('');
  let citizenSearchResults = $state<CitizenSearchResult[]>([]);
  let citizenSearchLoading = $state(false);

  // Change owner modal
  let changeOwnerModalOpen = $state(false);
  let changeOwnerSearchQuery = $state('');
  let changeOwnerSearchResults = $state<CitizenSearchResult[]>([]);
  let changeOwnerSearchLoading = $state(false);
  let selectedNewOwner = $state<CitizenSearchResult | null>(null);
  let changingOwnerWeaponId = $state<number | null>(null);

  // Context menu
  let contextMenu = $state<{ type: 'owner' | 'info'; x: number; y: number; weaponId: number } | null>(null);

  // Edit info modal
  let editInfoModalOpen = $state(false);
  let editInfoWeaponId = $state<number | null>(null);
  let editInfoNotes = $state('');

  // Handle navigation data
  $effect(() => {
    const query = navigationData?.searchQuery;
    if (query) {
      searchQuery = query;
      searchAndExpand(query);
    }
  });

  // Debounced search
  $effect(() => {
    if (debounceTimer) clearTimeout(debounceTimer);

    if (searchQuery.trim() || statusFilter) {
      debounceTimer = setTimeout(() => {
        loadWeapons();
      }, 300);
    } else {
      weapons = [];
    }
  });

  // Check permissions on mount
  $effect(() => {
    checkPermissions();
  });

  // Close context menu on click
  function handleDocumentClick() {
    contextMenu = null;
  }

  async function checkPermissions() {
    try {
      const result = await fetchNui<{ weapons: WeaponRegistration[]; canManage: boolean }>('getWeaponRegistry', {
        search: '',
        status: null
      });
      if (result) {
        canManage = result.canManage;
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  }

  async function loadWeapons() {
    if (!searchQuery.trim() && !statusFilter) {
      weapons = [];
      return;
    }

    loading = true;
    try {
      const result = await fetchNui<{ weapons: WeaponRegistration[]; canManage: boolean }>('getWeaponRegistry', {
        search: searchQuery,
        status: statusFilter
      });
      if (result) {
        weapons = result.weapons || [];
        canManage = result.canManage;
      }
    } catch (error) {
      console.error('Error loading weapons:', error);
    } finally {
      loading = false;
    }
  }

  async function searchAndExpand(query: string) {
    if (!query.trim()) {
      weapons = [];
      return;
    }

    loading = true;
    expandedWeaponId = null;
    expandedWeaponData = null;

    try {
      const result = await fetchNui<{ weapons: WeaponRegistration[]; canManage: boolean }>('getWeaponRegistry', {
        search: query,
        status: statusFilter
      });

      if (result) {
        weapons = result.weapons || [];
        canManage = result.canManage;

        if (result.weapons && result.weapons.length > 0) {
          const exactMatch = result.weapons.find(w => w.serial_number.toUpperCase() === query.toUpperCase());
          const weaponToExpand = exactMatch || (result.weapons.length === 1 ? result.weapons[0] : null);

          if (weaponToExpand) {
            await toggleExpand(weaponToExpand.id);
          }
        }
      }
    } catch (error) {
      console.error('Error searching weapons:', error);
    } finally {
      loading = false;
    }
  }

  async function toggleExpand(weaponId: number) {
    if (expandedWeaponId === weaponId) {
      expandedWeaponId = null;
      expandedWeaponData = null;
      return;
    }

    expandedWeaponId = weaponId;
    try {
      const weapon = await fetchNui<WeaponRegistration>('getWeaponDetails', { weaponId });
      if (weapon) {
        expandedWeaponData = weapon;
      }
    } catch (error) {
      console.error('Error loading weapon details:', error);
    }
  }

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      active: 'text-green-400',
      expired: 'text-yellow-400',
      revoked: 'text-red-400',
      stolen: 'text-red-400',
      lost: 'text-orange-400'
    };
    return colors[status] || 'text-mdt-text-subtle';
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function openRegistrationModal(weapon?: WeaponRegistration) {
    if (weapon) {
      editingWeapon = weapon;
      formData = {
        citizen_id: weapon.citizen_id,
        owner_name: weapon.owner_name || '',
        weapon_type: weapon.weapon_type,
        weapon_model: weapon.weapon_model || '',
        serial_number: weapon.serial_number,
        notes: weapon.notes || '',
        status: weapon.status
      };
    } else {
      editingWeapon = null;
      formData = {
        citizen_id: '',
        owner_name: '',
        weapon_type: '',
        weapon_model: '',
        serial_number: '',
        notes: '',
        status: 'active'
      };
    }
    registrationModalOpen = true;
  }

  async function searchCitizens() {
    if (!citizenSearchQuery.trim()) return;

    citizenSearchLoading = true;
    try {
      const results = await fetchNui<CitizenSearchResult[]>('searchCitizensForReport', {
        query: citizenSearchQuery
      });
      citizenSearchResults = results || [];
    } catch (error) {
      console.error('Error searching citizens:', error);
    } finally {
      citizenSearchLoading = false;
    }
  }

  async function searchCitizensForOwnerChange(query: string) {
    if (!query.trim()) {
      changeOwnerSearchResults = [];
      return;
    }

    changeOwnerSearchLoading = true;
    try {
      const results = await fetchNui<CitizenSearchResult[]>('searchCitizensForReport', {
        query: query
      });
      changeOwnerSearchResults = results || [];
    } catch (error) {
      console.error('Error searching citizens:', error);
    } finally {
      changeOwnerSearchLoading = false;
    }
  }

  function selectCitizen(citizen: CitizenSearchResult) {
    formData = {
      ...formData,
      citizen_id: citizen.citizenid,
      owner_name: citizen.name
    };
    citizenSearchModalOpen = false;
    citizenSearchQuery = '';
    citizenSearchResults = [];
  }

  async function saveWeaponRegistration() {
    if (!formData.weapon_type || !formData.serial_number || !formData.citizen_id) {
      return;
    }

    loading = true;
    try {
      const result = await fetchNui<{ success: boolean }>(
        editingWeapon ? 'updateWeaponRegistration' : 'registerWeapon',
        {
          ...formData,
          weaponId: editingWeapon ? editingWeapon.id : undefined
        }
      );

      if (result.success) {
        registrationModalOpen = false;
        loadWeapons();
        if (expandedWeaponId && editingWeapon) {
          toggleExpand(expandedWeaponId);
        }
      }
    } catch (error) {
      console.error('Error saving weapon registration:', error);
    } finally {
      loading = false;
    }
  }

  function handleOwnerContextMenu(e: MouseEvent, weaponId: number) {
    e.preventDefault();
    e.stopPropagation();
    if (!canManage) return;
    contextMenu = {
      type: 'owner',
      x: e.clientX,
      y: e.clientY,
      weaponId
    };
  }

  function handleInfoContextMenu(e: MouseEvent, weaponId: number) {
    e.preventDefault();
    e.stopPropagation();
    if (!canManage) return;
    contextMenu = {
      type: 'info',
      x: e.clientX,
      y: e.clientY,
      weaponId
    };
  }

  function openChangeOwnerModal(weaponId: number) {
    changingOwnerWeaponId = weaponId;
    changeOwnerModalOpen = true;
    changeOwnerSearchQuery = '';
    changeOwnerSearchResults = [];
    selectedNewOwner = null;
    contextMenu = null;
  }

  async function confirmOwnerChange() {
    if (!selectedNewOwner || !changingOwnerWeaponId) return;

    loading = true;
    try {
      const result = await fetchNui<{ success: boolean }>('changeWeaponOwner', {
        weaponId: changingOwnerWeaponId,
        newCitizenId: selectedNewOwner.citizenid,
        newOwnerName: selectedNewOwner.name
      });

      if (result.success) {
        changeOwnerModalOpen = false;
        selectedNewOwner = null;
        changingOwnerWeaponId = null;
        loadWeapons();
        if (expandedWeaponId) {
          toggleExpand(expandedWeaponId);
        }
      }
    } catch (error) {
      console.error('Error changing weapon owner:', error);
    } finally {
      loading = false;
    }
  }

  function openEditInfoModal(weaponId: number) {
    const weapon = weapons.find(w => w.id === weaponId);
    if (weapon) {
      editInfoWeaponId = weaponId;
      editInfoNotes = expandedWeaponData?.notes || weapon.notes || '';
      editInfoModalOpen = true;
    }
    contextMenu = null;
  }

  async function saveInfoOnly() {
    if (!editInfoWeaponId) return;

    const weapon = weapons.find(w => w.id === editInfoWeaponId);
    if (!weapon) return;

    loading = true;
    try {
      const result = await fetchNui<{ success: boolean }>('updateWeaponRegistration', {
        weaponId: editInfoWeaponId,
        weapon_type: weapon.weapon_type,
        weapon_model: weapon.weapon_model || '',
        notes: editInfoNotes,
        status: weapon.status
      });

      if (result.success) {
        editInfoModalOpen = false;
        editInfoWeaponId = null;
        editInfoNotes = '';
        loadWeapons();
        if (expandedWeaponId === editInfoWeaponId) {
          toggleExpand(editInfoWeaponId);
        }
      }
    } catch (error) {
      console.error('Error saving weapon info:', error);
    } finally {
      loading = false;
    }
  }
</script>

<svelte:document onclick={handleDocumentClick} />

<div class="h-full flex flex-col">
  <!-- Search and Filter -->
  <div class="p-1 border-b border-mdt-border-subtle">
    <div class="flex items-center gap-1 mb-1">
      <div class="relative flex-1">
        <i class="fas fa-search absolute left-2 top-1/2 -translate-y-1/2 text-mdt-text-subtle text-xs"></i>
        <input
          type="text"
          placeholder="Search by serial number, owner name, or citizen ID..."
          class="mdt-input w-full pl-8 py-1 text-xs"
          bind:value={searchQuery}
          style="border-radius: 2px;"
        />
      </div>
      {#if canManage}
        <button
          class="mdt-button mdt-button-primary text-xs flex items-center gap-1 py-1 px-1.5"
          onclick={() => openRegistrationModal()}
          style="border-radius: 2px;"
        >
          <i class="fas fa-plus"></i>
          Register
        </button>
      {/if}
    </div>
    <div class="flex items-center gap-1">
      <div class="relative">
        <select
          class="mdt-input pr-6 py-1 text-xs appearance-none cursor-pointer"
          bind:value={statusFilter}
          style="border-radius: 2px;"
        >
          <option value={null}>All Status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
          <option value="stolen">Stolen</option>
          <option value="lost">Lost</option>
        </select>
        <i class="fas fa-chevron-down absolute right-2 top-1/2 -translate-y-1/2 text-mdt-text-subtle text-xs pointer-events-none"></i>
      </div>
    </div>
  </div>

  <!-- Results -->
  <div class="flex-1 overflow-auto custom-scrollbar">
    {#if loading}
      <div class="flex items-center justify-center h-64">
        <div class="loading-spinner"></div>
      </div>
    {:else if !searchQuery.trim() && !statusFilter}
      <div class="flex flex-col items-center justify-center h-64 text-mdt-text-subtle">
        <i class="fas fa-search text-2xl mb-2 opacity-40"></i>
        <span class="text-xs">Start typing to search firearms</span>
      </div>
    {:else if weapons.length === 0}
      <div class="flex flex-col items-center justify-center h-64 text-mdt-text-subtle">
        <i class="fas fa-search text-2xl mb-2 opacity-40"></i>
        <span class="text-xs">No results found</span>
      </div>
    {:else}
      <div>
        {#each weapons as weapon (weapon.id)}
          {@const isExpanded = expandedWeaponId === weapon.id}
          <div class="border-b border-mdt-border-subtle last:border-b-0">
            <!-- Row -->
            <div
              class="flex items-center px-1 py-1 cursor-pointer transition-colors {isExpanded ? 'bg-mdt-bg-elevated' : 'hover:bg-mdt-bg-elevated/50'}"
              onclick={() => toggleExpand(weapon.id)}
            >
              <div class="w-32 shrink-0">
                <span class="font-mono text-xs font-semibold text-mdt-text bg-mdt-bg-surface border border-mdt-border-subtle px-1 py-0.5 inline-block" style="border-radius: 2px;">
                  {weapon.serial_number}
                </span>
              </div>
              <span class="text-xs text-mdt-text w-24 shrink-0 capitalize truncate">{weapon.weapon_type}</span>
              <div class="flex-1 text-left truncate min-w-0">
                {#if weapon.owner_name}
                  <button
                    class="text-xs text-primary-400 hover:text-primary-300"
                    onclick={(e) => { e.stopPropagation(); onViewProfile(weapon.citizen_id); }}
                  >
                    {weapon.owner_name}
                  </button>
                {:else}
                  <span class="text-xs text-mdt-text-subtle">Unknown</span>
                {/if}
              </div>
              <span class="text-xs font-medium w-20 text-right capitalize {getStatusColor(weapon.status)}">
                {weapon.status}
              </span>
              <i class="fas fa-chevron-down text-mdt-text-subtle text-xs ml-2 transition-transform {isExpanded ? 'rotate-180' : ''}"></i>
            </div>

            <!-- Expanded Details -->
            {#if isExpanded && expandedWeaponData}
              <div class="bg-mdt-bg-elevated px-1 py-1 border-t border-mdt-border-subtle">
                <div class="mb-1">
                  <h3 class="text-xs font-semibold text-mdt-text mb-1">Weapon Information</h3>
                  <div class="grid grid-cols-4 gap-1.5">
                    <div>
                      <span class="text-xs text-mdt-text-subtle block mb-0.5">Serial Number</span>
                      <span class="text-xs text-mdt-text font-mono bg-mdt-bg-surface px-1 py-0.5 border border-mdt-border-subtle inline-block" style="border-radius: 2px;">
                        {expandedWeaponData.serial_number}
                      </span>
                    </div>
                    <div>
                      <span class="text-xs text-mdt-text-subtle block mb-0.5">Owner</span>
                      {#if expandedWeaponData.owner_name}
                        <button
                          class="text-xs text-primary-400 hover:text-primary-300"
                          onclick={(e) => { e.stopPropagation(); onViewProfile(expandedWeaponData!.citizen_id); }}
                          oncontextmenu={(e) => handleOwnerContextMenu(e, weapon.id)}
                        >
                          {expandedWeaponData.owner_name}
                        </button>
                      {:else}
                        <span class="text-xs text-mdt-text-subtle">Unknown</span>
                      {/if}
                    </div>
                    <div>
                      <span class="text-xs text-mdt-text-subtle block mb-0.5">Weapon</span>
                      <span class="text-xs text-mdt-text capitalize">{expandedWeaponData.weapon_type}</span>
                      {#if expandedWeaponData.weapon_model}
                        <span class="text-xs text-mdt-text"> - {expandedWeaponData.weapon_model}</span>
                      {/if}
                    </div>
                    <div>
                      <span class="text-xs text-mdt-text-subtle block mb-0.5">Registration Date</span>
                      <span class="text-xs text-mdt-text">{formatDate(expandedWeaponData.registration_date)}</span>
                    </div>
                  </div>

                  <div class="mt-1">
                    <span class="text-xs text-mdt-text-subtle block mb-0.5">Information</span>
                    <p
                      class="text-xs bg-mdt-bg-surface p-1 border border-mdt-border-subtle min-h-[24px] {canManage ? 'cursor-context-menu' : ''} {expandedWeaponData.notes ? 'text-mdt-text' : 'text-mdt-text-subtle italic'}"
                      style="border-radius: 2px;"
                      oncontextmenu={(e) => handleInfoContextMenu(e, weapon.id)}
                    >
                      {expandedWeaponData.notes || 'No information available. Right-click to add.'}
                    </p>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Registration Modal -->
{#if registrationModalOpen}
<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) registrationModalOpen = false; }}>
  <div class="modal-container max-w-sm" onclick={(e) => e.stopPropagation()} style="border-radius: 2px;">
    <div class="modal-header" style="padding: 4px 6px;">
      <span class="text-xs font-medium text-mdt-text">
        {editingWeapon ? 'Edit Weapon Registration' : 'Register New Weapon'}
      </span>
      <button onclick={() => registrationModalOpen = false} class="text-mdt-text-subtle hover:text-mdt-text">
        <i class="fas fa-times text-xs"></i>
      </button>
    </div>
    <div class="modal-content space-y-1" style="padding: 4px 6px;">
      <div>
        <label class="block text-xs text-mdt-text-subtle mb-0.5">Owner</label>
        <div class="flex gap-1">
          <input
            type="text"
            class="mdt-input flex-1 text-xs py-1"
            placeholder="Search for citizen..."
            value={formData.owner_name}
            readonly
            style="border-radius: 2px;"
          />
          <button
            class="mdt-button mdt-button-primary py-1 px-2"
            onclick={() => citizenSearchModalOpen = true}
            style="border-radius: 2px;"
          >
            <i class="fas fa-search text-xs"></i>
          </button>
        </div>
      </div>

      <div>
        <label class="block text-xs text-mdt-text-subtle mb-0.5">Weapon Class</label>
        <div class="relative">
          <select class="mdt-input w-full appearance-none pr-6 text-xs py-1" bind:value={formData.weapon_type} style="border-radius: 2px;">
            <option value="">Select weapon class</option>
            {#each WEAPON_TYPES as type}
              <option value={type.value}>{type.label}</option>
            {/each}
          </select>
          <i class="fas fa-chevron-down absolute right-2 top-1/2 -translate-y-1/2 text-mdt-text-subtle text-xs pointer-events-none"></i>
        </div>
      </div>

      <div>
        <label class="block text-xs text-mdt-text-subtle mb-0.5">Weapon Model</label>
        <input
          type="text"
          class="mdt-input w-full text-xs py-1"
          placeholder="e.g., Glock 19, AR-15, etc."
          bind:value={formData.weapon_model}
          style="border-radius: 2px;"
        />
      </div>

      <div>
        <label class="block text-xs text-mdt-text-subtle mb-0.5">Serial Number</label>
        <input
          type="text"
          class="mdt-input w-full text-xs py-1 {editingWeapon ? 'opacity-50 cursor-not-allowed' : ''}"
          placeholder="Enter serial number"
          bind:value={formData.serial_number}
          disabled={!!editingWeapon}
          style="border-radius: 2px;"
        />
      </div>

      <div>
        <label class="block text-xs text-mdt-text-subtle mb-0.5">Status</label>
        <div class="relative">
          <select class="mdt-input w-full appearance-none pr-6 text-xs py-1" bind:value={formData.status} style="border-radius: 2px;">
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
            <option value="stolen">Stolen</option>
            <option value="lost">Lost</option>
          </select>
          <i class="fas fa-chevron-down absolute right-2 top-1/2 -translate-y-1/2 text-mdt-text-subtle text-xs pointer-events-none"></i>
        </div>
      </div>

      <div>
        <label class="block text-xs text-mdt-text-subtle mb-0.5">Information</label>
        <textarea
          class="mdt-input w-full h-12 resize-none text-xs"
          placeholder="Additional information about the weapon..."
          bind:value={formData.notes}
          style="border-radius: 2px;"
        ></textarea>
      </div>
    </div>
    <div class="modal-footer" style="padding: 4px 6px;">
      <button class="mdt-button mdt-button-secondary text-xs py-1 px-2" onclick={() => registrationModalOpen = false} style="border-radius: 2px;">Cancel</button>
      <button
        class="mdt-button mdt-button-primary text-xs py-1 px-2"
        class:opacity-50={!formData.weapon_type || !formData.serial_number || !formData.citizen_id}
        onclick={saveWeaponRegistration}
        disabled={!formData.weapon_type || !formData.serial_number || !formData.citizen_id}
        style="border-radius: 2px;"
      >
        {editingWeapon ? 'Update' : 'Register'}
      </button>
    </div>
  </div>
</div>
{/if}

<!-- Citizen Search Modal -->
{#if citizenSearchModalOpen}
<div class="modal-overlay" onclick={() => { citizenSearchModalOpen = false; citizenSearchQuery = ''; citizenSearchResults = []; }}>
  <div class="modal-container max-w-sm" onclick={(e) => e.stopPropagation()} style="border-radius: 2px;">
    <div class="modal-header" style="padding: 4px 6px;">
      <span class="text-xs font-medium text-mdt-text">Search Citizen</span>
      <button onclick={() => { citizenSearchModalOpen = false; citizenSearchQuery = ''; citizenSearchResults = []; }} class="text-mdt-text-subtle hover:text-mdt-text">
        <i class="fas fa-times text-xs"></i>
      </button>
    </div>
    <div class="modal-content space-y-1" style="padding: 4px 6px;">
      <div class="relative">
        <i class="fas fa-search absolute left-2 top-1/2 -translate-y-1/2 text-mdt-text-subtle text-xs"></i>
        <input
          type="text"
          class="mdt-input w-full pl-8 text-xs py-0.5"
          placeholder="Search by name or Citizen ID..."
          bind:value={citizenSearchQuery}
          onkeypress={(e) => e.key === 'Enter' && searchCitizens()}
          style="border-radius: 2px;"
        />
      </div>
      <button
        class="mdt-button mdt-button-primary w-full text-xs py-1"
        class:opacity-50={citizenSearchLoading}
        onclick={searchCitizens}
        disabled={citizenSearchLoading}
        style="border-radius: 2px;"
      >
        {citizenSearchLoading ? 'Searching...' : 'Search'}
      </button>

      {#if citizenSearchResults.length > 0}
        <div class="space-y-1 max-h-60 overflow-auto custom-scrollbar">
          {#each citizenSearchResults as citizen (citizen.citizenid)}
            <div
              class="p-1 bg-mdt-bg-elevated border border-mdt-border-subtle cursor-pointer hover:bg-mdt-bg-surface transition-colors"
              onclick={() => selectCitizen(citizen)}
              style="border-radius: 2px;"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-xs font-medium text-mdt-text">{citizen.name}</div>
                  <div class="flex items-center gap-1">
                    <span class="text-xs font-mono text-mdt-text-subtle">{citizen.citizenid}</span>
                    <span class="text-xs text-mdt-text-subtle">Phone: {citizen.phone}</span>
                  </div>
                </div>
                <i class="fas fa-plus text-mdt-text-subtle text-xs"></i>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
    <div class="modal-footer" style="padding: 4px 6px;">
      <button
        class="mdt-button mdt-button-secondary text-xs py-1 px-2"
        onclick={() => { citizenSearchModalOpen = false; citizenSearchQuery = ''; citizenSearchResults = []; }}
        style="border-radius: 2px;"
      >
        Cancel
      </button>
    </div>
  </div>
</div>
{/if}

<!-- Context Menu -->
{#if contextMenu}
<div
  class="fixed bg-mdt-bg-elevated border border-mdt-border-subtle shadow-lg py-0.5 z-50"
  style="left: {contextMenu.x}px; top: {contextMenu.y}px; border-radius: 2px;"
  onclick={(e) => e.stopPropagation()}
>
  {#if contextMenu.type === 'owner'}
    <button
      class="w-full px-3 py-1.5 text-left text-xs text-mdt-text hover:bg-mdt-bg-surface transition-colors flex items-center gap-1.5"
      onclick={() => openChangeOwnerModal(contextMenu!.weaponId)}
    >
      <i class="fas fa-exchange-alt text-primary-400"></i>
      Transfer Ownership
    </button>
  {/if}
  {#if contextMenu.type === 'info'}
    <button
      class="w-full px-3 py-1.5 text-left text-xs text-mdt-text hover:bg-mdt-bg-surface transition-colors flex items-center gap-1.5"
      onclick={() => openEditInfoModal(contextMenu!.weaponId)}
    >
      <i class="fas fa-edit text-primary-400"></i>
      Edit
    </button>
  {/if}
</div>
{/if}

<!-- Change Owner Modal -->
{#if changeOwnerModalOpen}
<div class="modal-overlay" onclick={() => { changeOwnerModalOpen = false; changeOwnerSearchQuery = ''; changeOwnerSearchResults = []; selectedNewOwner = null; }}>
  <div class="modal-container max-w-sm" onclick={(e) => e.stopPropagation()} style="border-radius: 2px;">
    <div class="modal-header" style="padding: 4px 6px;">
      <span class="text-xs font-medium text-mdt-text">Change Weapon Owner</span>
      <button onclick={() => { changeOwnerModalOpen = false; changeOwnerSearchQuery = ''; changeOwnerSearchResults = []; selectedNewOwner = null; }} class="text-mdt-text-subtle hover:text-mdt-text">
        <i class="fas fa-times text-xs"></i>
      </button>
    </div>
    <div class="modal-content space-y-1" style="padding: 4px 6px;">
      <div class="relative">
        <i class="fas fa-search absolute left-2 top-1/2 -translate-y-1/2 text-mdt-text-subtle text-xs"></i>
        <input
          type="text"
          class="mdt-input w-full pl-8 text-xs py-0.5"
          placeholder="Search for new owner..."
          bind:value={changeOwnerSearchQuery}
          oninput={() => searchCitizensForOwnerChange(changeOwnerSearchQuery)}
          style="border-radius: 2px;"
        />
      </div>

      {#if changeOwnerSearchLoading}
        <div class="text-center py-2">
          <i class="fas fa-spinner fa-spin text-mdt-text-subtle text-xs"></i>
        </div>
      {/if}

      {#if changeOwnerSearchResults.length > 0}
        <div class="space-y-1 max-h-60 overflow-auto custom-scrollbar">
          {#each changeOwnerSearchResults as citizen (citizen.citizenid)}
            <div
              class="p-1 border cursor-pointer transition-colors {selectedNewOwner?.citizenid === citizen.citizenid ? 'bg-primary-500/20 border-primary-500' : 'bg-mdt-bg-elevated border-mdt-border-subtle hover:bg-mdt-bg-surface'}"
              onclick={() => selectedNewOwner = citizen}
              style="border-radius: 2px;"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-xs font-medium text-mdt-text">{citizen.name}</div>
                  <span class="text-xs font-mono text-mdt-text-subtle">{citizen.citizenid}</span>
                </div>
                {#if selectedNewOwner?.citizenid === citizen.citizenid}
                  <i class="fas fa-check text-primary-400 text-xs"></i>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
    <div class="modal-footer" style="padding: 4px 6px;">
      <button
        class="mdt-button mdt-button-secondary text-xs py-1 px-2"
        onclick={() => { changeOwnerModalOpen = false; changeOwnerSearchQuery = ''; changeOwnerSearchResults = []; selectedNewOwner = null; }}
        style="border-radius: 2px;"
      >
        Cancel
      </button>
      {#if selectedNewOwner}
        <button
          class="mdt-button mdt-button-primary text-xs py-1 px-2"
          onclick={confirmOwnerChange}
          style="border-radius: 2px;"
        >
          Confirm Transfer
        </button>
      {/if}
    </div>
  </div>
</div>
{/if}

<!-- Edit Info Modal -->
{#if editInfoModalOpen}
<div class="modal-overlay" onclick={() => { editInfoModalOpen = false; editInfoWeaponId = null; editInfoNotes = ''; }}>
  <div class="modal-container max-w-sm" onclick={(e) => e.stopPropagation()} style="border-radius: 2px;">
    <div class="modal-header" style="padding: 4px 6px;">
      <span class="text-xs font-medium text-mdt-text">Edit Information</span>
      <button onclick={() => { editInfoModalOpen = false; editInfoWeaponId = null; editInfoNotes = ''; }} class="text-mdt-text-subtle hover:text-mdt-text">
        <i class="fas fa-times text-xs"></i>
      </button>
    </div>
    <div class="modal-content" style="padding: 4px 6px;">
      <label class="block text-xs text-mdt-text-subtle mb-0.5">Information</label>
      <textarea
        class="mdt-input w-full h-20 resize-none text-xs"
        placeholder="Enter information about the weapon..."
        bind:value={editInfoNotes}
        style="border-radius: 2px;"
      ></textarea>
    </div>
    <div class="modal-footer" style="padding: 4px 6px;">
      <button
        class="mdt-button mdt-button-secondary text-xs py-1 px-2"
        onclick={() => { editInfoModalOpen = false; editInfoWeaponId = null; editInfoNotes = ''; }}
        style="border-radius: 2px;"
      >
        Cancel
      </button>
      <button
        class="mdt-button mdt-button-primary text-xs py-1 px-2"
        onclick={saveInfoOnly}
        style="border-radius: 2px;"
      >
        Save
      </button>
    </div>
  </div>
</div>
{/if}
