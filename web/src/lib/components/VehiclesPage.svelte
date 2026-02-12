<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchNui } from '../utils/fetchNui';

  interface Vehicle {
    id: number;
    plate: string;
    model: string;
    owner: string;
    citizenid: string;
    state: number;
    locationStatus?: string;
    canViewLocation?: boolean;
    flags?: VehicleFlag[];
  }

  interface VehicleFlag {
    id: number;
    flag_type: string;
    description: string;
    reported_by: string;
    created_at: string;
    is_active?: boolean;
  }

  let {
    onViewProfile,
    navigationData
  }: {
    onViewProfile: (citizenid: string) => void;
    navigationData: any;
  } = $props();

  let searchQuery = $state('');
  let vehicles = $state<Vehicle[]>([]);
  let loading = $state(false);
  let expandedVehicleId = $state<number | null>(null);
  let expandedVehicle = $state<Vehicle | null>(null);
  let boloModalOpen = $state(false);
  let boloForm = $state({ flagType: 'bolo', description: '' });
  let debounceTimer: ReturnType<typeof setTimeout>;

  // Handle navigation from dashboard
  $effect(() => {
    const query = navigationData?.searchQuery || navigationData?.vehiclePlate;
    if (query) {
      searchQuery = query;
      searchVehicles(query, true);
    }
  });

  // Debounced search
  $effect(() => {
    if (debounceTimer) clearTimeout(debounceTimer);

    if (!searchQuery.trim()) {
      vehicles = [];
      return;
    }

    debounceTimer = setTimeout(() => {
      searchVehicles(searchQuery.trim(), false);
    }, 150);
  });

  async function searchVehicles(query: string, autoExpand: boolean) {
    if (!query.trim()) return;

    loading = true;
    expandedVehicleId = null;
    expandedVehicle = null;

    try {
      const results = await fetchNui<Vehicle[]>('searchVehicles', { query });
      vehicles = results || [];

      if (autoExpand && results && results.length > 0) {
        const exactMatch = results.find(v => v.plate.toUpperCase() === query.toUpperCase());
        const vehicleToExpand = exactMatch || (results.length === 1 ? results[0] : null);
        if (vehicleToExpand) {
          await toggleExpand(vehicleToExpand.id);
        }
      }
    } catch (error) {
      console.error('Error searching vehicles:', error);
      vehicles = [];
    } finally {
      loading = false;
    }
  }

  async function toggleExpand(vehicleId: number) {
    if (expandedVehicleId === vehicleId) {
      expandedVehicleId = null;
      expandedVehicle = null;
      return;
    }

    expandedVehicleId = vehicleId;
    try {
      const vehicle = await fetchNui<Vehicle>('getVehicle', { vehicleId });
      expandedVehicle = vehicle;
    } catch (error) {
      console.error('Error loading vehicle:', error);
    }
  }

  async function addFlag() {
    if (!expandedVehicle || !boloForm.description.trim()) return;

    try {
      const result = await fetchNui<{ success: boolean }>('addVehicleFlag', {
        vehicleId: expandedVehicle.id,
        plate: expandedVehicle.plate,
        flagType: boloForm.flagType,
        description: boloForm.description
      });

      if (result.success) {
        boloModalOpen = false;
        boloForm = { flagType: 'bolo', description: '' };
        await toggleExpand(expandedVehicle.id);
      }
    } catch (error) {
      console.error('Error adding flag:', error);
    }
  }

  async function removeFlag(flagId: number) {
    if (!expandedVehicle) return;

    try {
      const result = await fetchNui<{ success: boolean }>('removeVehicleFlag', {
        vehicleId: expandedVehicle.id,
        flagId
      });

      if (result.success) {
        await toggleExpand(expandedVehicle.id);
      }
    } catch (error) {
      console.error('Error removing flag:', error);
    }
  }

  function getStatusInfo(vehicle: Vehicle) {
    if (!vehicle.flags || vehicle.flags.length === 0) {
      return { text: 'CLEAR', color: 'text-mdt-text-subtle' };
    }

    const stolen = vehicle.flags.find(f => f.flag_type === 'stolen');
    if (stolen) return { text: 'STOLEN', color: 'text-red-400' };

    const warrant = vehicle.flags.find(f => f.flag_type === 'warrant');
    if (warrant) return { text: 'WARRANT', color: 'text-orange-400' };

    const bolo = vehicle.flags.find(f => f.flag_type === 'bolo');
    if (bolo) return { text: 'BOLO', color: 'text-yellow-400' };

    return { text: 'FLAG', color: 'text-blue-400' };
  }

  function getFlagColor(flagType: string) {
    const colors: Record<string, string> = {
      stolen: 'text-red-400',
      warrant: 'text-orange-400',
      bolo: 'text-yellow-400',
      suspicious: 'text-blue-400'
    };
    return colors[flagType] || 'text-mdt-text-muted';
  }
</script>

<div class="h-full flex flex-col">
  <!-- Search -->
  <div class="p-1 border-b border-mdt-border-subtle">
    <div class="relative">
      <i class="fas fa-search absolute left-2 top-1/2 -translate-y-1/2 text-mdt-text-subtle text-xs"></i>
      <input
        type="text"
        class="mdt-input w-full pl-8 pr-5 py-1 text-xs"
        placeholder="Search plate, model, or owner..."
        bind:value={searchQuery}
        style="border-radius: 2px;"
      />
      {#if searchQuery}
        <button
          class="absolute right-1.5 top-1/2 -translate-y-1/2 text-mdt-text-subtle hover:text-mdt-text"
          onclick={() => searchQuery = ''}
        >
          <i class="fas fa-times text-xs"></i>
        </button>
      {/if}
    </div>
  </div>

  <!-- Results -->
  <div class="flex-1 overflow-auto custom-scrollbar">
    {#if loading}
      <div class="flex items-center justify-center h-64">
        <div class="loading-spinner"></div>
      </div>
    {:else if !searchQuery.trim()}
      <div class="flex flex-col items-center justify-center h-64 text-mdt-text-subtle">
        <i class="fas fa-car text-2xl mb-2 opacity-40"></i>
        <span class="text-xs">Search for a vehicle</span>
      </div>
    {:else if vehicles.length === 0}
      <div class="flex flex-col items-center justify-center h-64 text-mdt-text-subtle">
        <i class="fas fa-search text-2xl mb-2 opacity-40"></i>
        <span class="text-xs">No results found</span>
      </div>
    {:else}
      <div>
        {#each vehicles as vehicle (vehicle.id)}
          {@const isExpanded = expandedVehicleId === vehicle.id}
          {@const status = getStatusInfo(vehicle)}
          <div class="border-b border-mdt-border-subtle last:border-b-0">
            <!-- Row -->
            <div
              class="flex items-center px-1 py-1 cursor-pointer transition-colors {isExpanded ? 'bg-mdt-bg-elevated' : 'hover:bg-mdt-bg-elevated/50'}"
              onclick={() => toggleExpand(vehicle.id)}
            >
              <div class="w-20 shrink-0">
                <span class="font-mono text-xs font-semibold text-mdt-text bg-mdt-bg-surface border border-mdt-border-subtle px-1 py-0.5" style="border-radius: 2px;">
                  {vehicle.plate}
                </span>
              </div>
              <span class="text-xs text-mdt-text-muted w-28 shrink-0 truncate">{vehicle.model}</span>
              <div class="flex-1 text-left truncate min-w-0">
                <button
                  class="text-xs text-primary-400 hover:text-primary-300"
                  onclick={(e) => { e.stopPropagation(); onViewProfile(vehicle.citizenid); }}
                >
                  {vehicle.owner}
                </button>
              </div>
              <span class="text-xs font-medium w-16 text-right {status.color}">{status.text}</span>
              <i class="fas fa-chevron-down text-xs text-mdt-text-subtle ml-1 transition-transform {isExpanded ? 'rotate-180' : ''}"></i>
            </div>

            <!-- Expanded -->
            {#if isExpanded && expandedVehicle}
              <div class="bg-mdt-bg px-1 py-1">
                <div class="flex gap-2">
                  <!-- Info -->
                  <div class="flex-1 space-y-1">
                    <div class="grid grid-cols-2 gap-x-2 gap-y-0.5">
                      <div class="flex justify-between">
                        <span class="text-xs text-mdt-text-subtle">Plate</span>
                        <span class="text-xs font-mono text-mdt-text">{expandedVehicle.plate}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-xs text-mdt-text-subtle">Model</span>
                        <span class="text-xs text-mdt-text">{expandedVehicle.model}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-xs text-mdt-text-subtle">Owner</span>
                        <button
                          class="text-xs text-primary-400 hover:text-primary-300"
                          onclick={() => onViewProfile(expandedVehicle!.citizenid)}
                        >
                          {expandedVehicle.owner}
                        </button>
                      </div>
                      {#if expandedVehicle.locationStatus}
                        <div class="flex justify-between">
                          <span class="text-xs text-mdt-text-subtle">Status</span>
                          <span class="text-xs text-mdt-text">{expandedVehicle.locationStatus}</span>
                        </div>
                      {/if}
                    </div>
                  </div>

                  <div class="w-px bg-mdt-border-subtle"></div>

                  <!-- Flags -->
                  <div class="w-56">
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-xs text-mdt-text-subtle uppercase tracking-wider">
                        Flags {expandedVehicle.flags && expandedVehicle.flags.length > 0 ? `(${expandedVehicle.flags.length})` : ''}
                      </span>
                      <button
                        class="text-xs text-primary-400 hover:text-primary-300"
                        onclick={() => boloModalOpen = true}
                      >
                        + Add
                      </button>
                    </div>

                    {#if expandedVehicle.flags && expandedVehicle.flags.length > 0}
                      <div class="space-y-0.5 max-h-24 overflow-auto custom-scrollbar">
                        {#each expandedVehicle.flags as flag (flag.id)}
                          <div class="group flex items-start gap-1 py-0.5">
                            <span class="text-xs font-medium uppercase w-14 shrink-0 {getFlagColor(flag.flag_type)}">
                              {flag.flag_type}
                            </span>
                            <span class="text-xs text-mdt-text-muted flex-1 line-clamp-2">{flag.description}</span>
                            <button
                              class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                              onclick={() => removeFlag(flag.id)}
                            >
                              <i class="fas fa-times text-xs"></i>
                            </button>
                          </div>
                        {/each}
                      </div>
                    {:else}
                      <div class="text-xs text-mdt-text-subtle py-1 text-center">No active flags</div>
                    {/if}
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

<!-- Add Flag Modal -->
{#if boloModalOpen}
<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) boloModalOpen = false; }}>
  <div class="modal-container max-w-xs" onclick={(e) => e.stopPropagation()} style="border-radius: 2px;">
    <div class="modal-header" style="padding: 4px 6px;">
      <span class="text-xs font-medium text-mdt-text">Add Flag</span>
      <button onclick={() => boloModalOpen = false} class="text-mdt-text-subtle hover:text-mdt-text">
        <i class="fas fa-times text-xs"></i>
      </button>
    </div>
    <div class="modal-content space-y-1" style="padding: 4px 6px;">
      <div>
        <label class="block text-xs text-mdt-text-subtle mb-0.5">Type</label>
        <select class="mdt-input w-full text-xs py-0.5" bind:value={boloForm.flagType} style="border-radius: 2px;">
          <option value="bolo">BOLO</option>
          <option value="stolen">Stolen</option>
          <option value="warrant">Warrant</option>
          <option value="suspicious">Suspicious</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-mdt-text-subtle mb-0.5">Description</label>
        <textarea
          class="mdt-input w-full h-16 resize-none text-xs"
          placeholder="Enter description..."
          bind:value={boloForm.description}
          style="border-radius: 2px;"
        ></textarea>
      </div>
    </div>
    <div class="modal-footer" style="padding: 4px 6px;">
      <button class="mdt-button mdt-button-secondary text-xs py-0.5 px-1.5" onclick={() => boloModalOpen = false} style="border-radius: 2px;">Cancel</button>
      <button
        class="mdt-button mdt-button-primary text-xs py-0.5 px-1.5"
        class:opacity-50={!boloForm.description.trim()}
        onclick={addFlag}
        disabled={!boloForm.description.trim()}
        style="border-radius: 2px;"
      >
        Save
      </button>
    </div>
  </div>
</div>
{/if}
