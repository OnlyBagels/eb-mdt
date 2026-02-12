<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchNui } from '../utils/fetchNui';

  interface VehicleFlag {
    id: string | number;
    vehicle_id?: number;
    plate: string;
    flag_type: string;
    description: string;
    reported_by: string;
    created_at: string;
    is_active: boolean;
    source?: 'mdt' | 'aipullover';
    priority?: string;
  }

  let {
    onNavigateToVehicle
  }: {
    onNavigateToVehicle?: (plate: string) => void;
  } = $props();

  type FilterType = 'both' | 'ai' | 'leo';

  let flags = $state<VehicleFlag[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let filterType = $state<FilterType>('both');
  let aiIntegrationEnabled = $state(true);
  let selectedFlagType = $state<string | null>(null);

  onMount(() => {
    loadFlags();
    loadAIIntegrationSetting();
  });

  async function loadFlags() {
    loading = true;
    try {
      const result = await fetchNui<VehicleFlag[]>('getAllVehicleFlags', {});
      if (Array.isArray(result)) {
        flags = result;
      } else {
        console.warn('Invalid flags data received:', result);
        flags = [];
      }
    } catch (error) {
      console.error('Error loading flags:', error);
      flags = [];
    } finally {
      loading = false;
    }
  }

  async function loadAIIntegrationSetting() {
    try {
      const enabled = await fetchNui<boolean>('getAIIntegrationEnabled', {});
      aiIntegrationEnabled = enabled;
      if (!enabled) {
        filterType = 'leo';
      }
    } catch (error) {
      console.error('Error loading AI integration setting:', error);
      aiIntegrationEnabled = false;
      filterType = 'leo';
    }
  }

  function getFlagTypeStyle(flagType: string) {
    const styles: Record<string, { text: string; bg: string }> = {
      stolen: { text: 'text-red-400', bg: 'bg-red-400/10' },
      warrant: { text: 'text-orange-400', bg: 'bg-orange-400/10' },
      bolo: { text: 'text-yellow-400', bg: 'bg-yellow-400/10' },
      suspicious: { text: 'text-blue-400', bg: 'bg-blue-400/10' }
    };
    return styles[flagType] || { text: 'text-mdt-text-muted', bg: 'bg-mdt-bg-surface' };
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function handleViewVehicle(plate: string) {
    if (onNavigateToVehicle) {
      onNavigateToVehicle(plate);
    }
  }

  function handleFlagTypeClick(flagType: string) {
    if (selectedFlagType === flagType) {
      selectedFlagType = null;
    } else {
      selectedFlagType = flagType;
    }
  }

  // Computed filtered flags
  let filteredFlags = $derived.by(() => {
    return flags.filter((flag) => {
      // Filter by source type
      if (filterType === 'ai' && flag.source !== 'aipullover') return false;
      if (filterType === 'leo' && flag.source !== 'mdt') return false;

      // Filter by selected flag type from stats cards
      if (selectedFlagType && flag.flag_type !== selectedFlagType) return false;

      // Filter by search query
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        flag.plate.toLowerCase().includes(query) ||
        flag.flag_type.toLowerCase().includes(query) ||
        flag.description.toLowerCase().includes(query) ||
        flag.reported_by.toLowerCase().includes(query)
      );
    });
  });

  // Computed flag counts
  let flagCounts = $derived({
    stolen: flags.filter(f => f.flag_type === 'stolen').length,
    warrant: flags.filter(f => f.flag_type === 'warrant').length,
    bolo: flags.filter(f => f.flag_type === 'bolo').length,
    suspicious: flags.filter(f => f.flag_type === 'suspicious').length
  });
</script>

<div class="h-full flex flex-col">
  <!-- Search and Filter Toggle -->
  <div class="p-1 border-b border-mdt-border-subtle space-y-1">
    <!-- Search -->
    <div class="relative">
      <i class="fas fa-search absolute left-2 top-1/2 -translate-y-1/2 text-mdt-text-subtle text-xs"></i>
      <input
        type="text"
        placeholder="Search by plate, type, description, or officer..."
        class="mdt-input w-full pl-8 py-1 text-xs"
        bind:value={searchQuery}
        style="border-radius: 2px;"
      />
    </div>

    <!-- Toggle Buttons - Only show if AI integration is enabled -->
    {#if aiIntegrationEnabled}
      <div class="flex justify-center gap-1.5">
        <button
          onclick={() => filterType = 'leo'}
          class="px-2 py-1 text-xs font-medium transition-colors {filterType === 'leo' ? 'bg-primary-500 text-white' : 'bg-mdt-bg-surface text-mdt-text-subtle hover:bg-mdt-bg-elevated border border-mdt-border-subtle'}"
          style="border-radius: 2px;"
        >
          LEO
        </button>
        <button
          onclick={() => filterType = 'both'}
          class="px-2 py-1 text-xs font-medium transition-colors {filterType === 'both' ? 'bg-primary-500 text-white' : 'bg-mdt-bg-surface text-mdt-text-subtle hover:bg-mdt-bg-elevated border border-mdt-border-subtle'}"
          style="border-radius: 2px;"
        >
          Both
        </button>
        <button
          onclick={() => filterType = 'ai'}
          class="px-2 py-1 text-xs font-medium transition-colors {filterType === 'ai' ? 'bg-primary-500 text-white' : 'bg-mdt-bg-surface text-mdt-text-subtle hover:bg-mdt-bg-elevated border border-mdt-border-subtle'}"
          style="border-radius: 2px;"
        >
          AI
        </button>
      </div>
    {/if}
  </div>

  <!-- Stats Cards -->
  <div class="px-1 py-1 border-b border-mdt-border-subtle">
    <div class="grid grid-cols-4 gap-1">
      <button
        onclick={() => handleFlagTypeClick('stolen')}
        class="bg-mdt-bg-surface border border-mdt-border-subtle px-1 py-1 transition-all cursor-pointer {selectedFlagType === 'stolen' ? '!border-red-400 bg-red-400/10 shadow-[0_0_0_1px_rgba(248,113,113,0.3)]' : 'hover:bg-red-400/5 hover:shadow-[0_0_0_1px_rgba(248,113,113,0.3)]'}"
        style="border-radius: 2px;"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <div class="w-1.5 h-1.5 rounded-full bg-red-400"></div>
            <span class="text-xs font-medium text-mdt-text-subtle">Stolen</span>
          </div>
          <span class="text-xs font-bold text-red-400">{flagCounts.stolen}</span>
        </div>
      </button>
      <button
        onclick={() => handleFlagTypeClick('warrant')}
        class="bg-mdt-bg-surface border border-mdt-border-subtle px-1 py-1 transition-all cursor-pointer {selectedFlagType === 'warrant' ? '!border-orange-400 bg-orange-400/10 shadow-[0_0_0_1px_rgba(251,146,60,0.3)]' : 'hover:bg-orange-400/5 hover:shadow-[0_0_0_1px_rgba(251,146,60,0.3)]'}"
        style="border-radius: 2px;"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <div class="w-1.5 h-1.5 rounded-full bg-orange-400"></div>
            <span class="text-xs font-medium text-mdt-text-subtle">Warrant</span>
          </div>
          <span class="text-xs font-bold text-orange-400">{flagCounts.warrant}</span>
        </div>
      </button>
      <button
        onclick={() => handleFlagTypeClick('bolo')}
        class="bg-mdt-bg-surface border border-mdt-border-subtle px-1 py-1 transition-all cursor-pointer {selectedFlagType === 'bolo' ? '!border-yellow-400 bg-yellow-400/10 shadow-[0_0_0_1px_rgba(250,204,21,0.3)]' : 'hover:bg-yellow-400/5 hover:shadow-[0_0_0_1px_rgba(250,204,21,0.3)]'}"
        style="border-radius: 2px;"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <div class="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
            <span class="text-xs font-medium text-mdt-text-subtle">BOLO</span>
          </div>
          <span class="text-xs font-bold text-yellow-400">{flagCounts.bolo}</span>
        </div>
      </button>
      <button
        onclick={() => handleFlagTypeClick('suspicious')}
        class="bg-mdt-bg-surface border border-mdt-border-subtle px-1 py-1 transition-all cursor-pointer {selectedFlagType === 'suspicious' ? '!border-blue-400 bg-blue-400/10 shadow-[0_0_0_1px_rgba(96,165,250,0.3)]' : 'hover:bg-blue-400/5 hover:shadow-[0_0_0_1px_rgba(96,165,250,0.3)]'}"
        style="border-radius: 2px;"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <div class="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
            <span class="text-xs font-medium text-mdt-text-subtle">Suspicious</span>
          </div>
          <span class="text-xs font-bold text-blue-400">{flagCounts.suspicious}</span>
        </div>
      </button>
    </div>
  </div>

  <!-- Results -->
  <div class="flex-1 overflow-auto custom-scrollbar">
    {#if loading}
      <div class="flex items-center justify-center h-64">
        <div class="loading-spinner"></div>
      </div>
    {:else if filteredFlags.length === 0}
      <div class="flex flex-col items-center justify-center h-64 text-mdt-text-subtle">
        <i class="fas fa-flag text-2xl mb-2 opacity-40"></i>
        <span class="text-xs">
          {searchQuery.trim() ? 'No flags found' : 'No active vehicle flags'}
        </span>
      </div>
    {:else}
      <div>
        {#each filteredFlags as flag (flag.id)}
          {@const flagStyle = getFlagTypeStyle(flag.flag_type)}
          <div class="border-b border-mdt-border-subtle hover:bg-mdt-bg-elevated/50 transition-colors">
            <div class="flex items-center px-1 py-1 gap-1">
              <!-- Flag Type -->
              <div class="w-28 shrink-0 flex items-center gap-1">
                <span class="text-xs font-semibold uppercase px-1.5 py-0.5 inline-block {flagStyle.text} {flagStyle.bg}" style="border-radius: 2px;">
                  {flag.flag_type}
                </span>
                {#if filterType === 'both'}
                  {#if flag.source === 'aipullover'}
                    <span
                      class="text-[10px] text-blue-400 bg-blue-400/10 px-1 py-0.5 uppercase font-semibold"
                      title="Auto-generated by AI Pullover system"
                      style="border-radius: 2px;"
                    >
                      AI
                    </span>
                  {/if}
                  {#if flag.source === 'mdt'}
                    <span
                      class="text-[10px] text-green-400 bg-green-400/10 px-1 py-0.5 uppercase font-semibold"
                      title="Manually created by LEO"
                      style="border-radius: 2px;"
                    >
                      LEO
                    </span>
                  {/if}
                {/if}
              </div>

              <!-- Plate - Clickable -->
              <div class="w-24 shrink-0">
                <button
                  onclick={() => handleViewVehicle(flag.plate)}
                  class="font-mono text-xs font-semibold text-mdt-text hover:text-primary-300 bg-mdt-bg-surface border border-mdt-border-subtle hover:border-primary-500/50 px-1.5 py-0.5 inline-block transition-colors"
                  style="border-radius: 2px;"
                >
                  {flag.plate}
                </button>
              </div>

              <!-- Description -->
              <div class="flex-1 min-w-0">
                <p class="text-xs text-mdt-text truncate">{flag.description}</p>
              </div>

              <!-- Officer -->
              <div class="w-32 shrink-0">
                <p class="text-xs text-mdt-text-subtle truncate">{flag.reported_by}</p>
              </div>

              <!-- Date -->
              <div class="w-28 shrink-0">
                <p class="text-xs text-mdt-text-subtle">{formatDate(flag.created_at)}</p>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
