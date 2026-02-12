<script lang="ts">
  import { penalCodeData, type PenalCodeStatute } from '../data/penalCodes';

  type PenalCodeClass = 'Felony' | 'Misdemeanor' | 'Infraction';

  let searchQuery = $state('');
  let selectedClass = $state<string | null>(null);

  function getClassHeaderColor(penalClass: PenalCodeClass) {
    switch (penalClass) {
      case 'Felony':
        return 'bg-red-900/40';
      case 'Misdemeanor':
        return 'bg-orange-900/40';
      case 'Infraction':
        return 'bg-yellow-700/50';
      default:
        return 'bg-gray-900/40';
    }
  }

  function getClassTextColor(penalClass: PenalCodeClass) {
    switch (penalClass) {
      case 'Felony':
        return 'text-red-300';
      case 'Misdemeanor':
        return 'text-orange-300';
      case 'Infraction':
        return 'text-yellow-200';
      default:
        return 'text-gray-300';
    }
  }

  // Filter penal codes based on search and class filter
  let filteredCategories = $derived.by(() => {
    return penalCodeData
      .map((category) => {
        const filteredStatutes = Object.entries(category.statutes).filter(
          ([_, statute]) => {
            const matchesSearch =
              !searchQuery ||
              statute.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              statute.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
              statute.id.toString().includes(searchQuery);

            const matchesClass = !selectedClass || statute.class === selectedClass;

            return matchesSearch && matchesClass;
          }
        );

        return {
          ...category,
          statutes: Object.fromEntries(filteredStatutes),
          statuteCount: filteredStatutes.length
        };
      })
      .filter((category) => category.statuteCount > 0);
  });
</script>

<div class="h-full flex flex-col">
  <!-- Search and Filter Section -->
  <div class="p-1 border-b border-mdt-border-subtle">
    <div class="flex items-center gap-1">
      <div class="relative flex-1">
        <i class="fas fa-search absolute left-2 top-1/2 -translate-y-1/2 text-mdt-text-subtle text-xs"></i>
        <input
          type="text"
          class="mdt-input w-full pl-8 py-1 text-xs"
          placeholder="Search by code, title, or description..."
          bind:value={searchQuery}
          style="border-radius: 2px;"
        />
      </div>
      <div class="relative">
        <select
          class="mdt-input pr-6 py-1 text-xs appearance-none cursor-pointer"
          bind:value={selectedClass}
          style="border-radius: 2px;"
        >
          <option value={null}>All Classes</option>
          <option value="Felony">Felonies</option>
          <option value="Misdemeanor">Misdemeanors</option>
          <option value="Infraction">Infractions</option>
        </select>
        <i class="fas fa-chevron-down absolute right-2 top-1/2 -translate-y-1/2 text-mdt-text-subtle text-xs pointer-events-none"></i>
      </div>
    </div>
  </div>

  <!-- Penal Code Categories -->
  <div class="flex-1 min-h-0 overflow-auto custom-scrollbar">
    {#if filteredCategories.length > 0}
      <div class="p-1">
        {#each filteredCategories as category (category.id)}
          <div class="mb-2">
            <!-- Category Header -->
            <div class="mb-1">
              <h2 class="text-xs font-bold text-mdt-text uppercase tracking-wider">
                {category.title}
              </h2>
            </div>

            <!-- Statute Cards Grid -->
            <div class="grid grid-cols-3 gap-1">
              {#each Object.entries(category.statutes) as [key, statute] (statute.id)}
                <div class="bg-mdt-bg-elevated overflow-hidden flex flex-col border border-mdt-border-subtle" style="border-radius: 2px;">
                  <!-- Color-coded header with severity -->
                  <div class="px-1 py-1 flex items-center justify-center {getClassHeaderColor(statute.class)}">
                    <span class="text-xs font-bold uppercase tracking-wide {getClassTextColor(statute.class)}">
                      {statute.class}
                    </span>
                  </div>

                  <!-- Card content -->
                  <div class="px-1.5 py-1 flex flex-col flex-1">
                    <!-- PC Code - Centered -->
                    <div class="mb-0.5 text-center">
                      <span class="text-xs font-normal text-mdt-text">
                        P.C. {statute.id}
                      </span>
                    </div>

                    <!-- Title - Centered -->
                    <h3 class="text-sm font-bold text-mdt-text mb-1 leading-tight text-center">
                      {statute.title}
                    </h3>

                    <!-- Description -->
                    <p class="text-xs text-mdt-text-subtle leading-relaxed mb-1 flex-1">
                      {statute.description}
                    </p>

                    <!-- Separator line -->
                    <div class="w-full h-px bg-mdt-border-subtle mb-1"></div>

                    <!-- Footer with fine and jail time -->
                    <div class="flex items-center justify-between text-xs">
                      <div>
                        <span class="text-mdt-text font-semibold">Fine: </span>
                        <span class="text-mdt-text">${statute.fine.toLocaleString()}</span>
                      </div>
                      {#if statute.months > 0}
                        <div>
                          <span class="text-mdt-text font-semibold">Time: </span>
                          <span class="text-mdt-text">{statute.months}mo</span>
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="flex flex-col items-center justify-center h-64 text-mdt-text-subtle">
        <i class="fas fa-balance-scale text-2xl mb-2 opacity-40"></i>
        <span class="text-xs">No penal codes found</span>
        <span class="text-xs mt-1">Try adjusting your search or filters</span>
      </div>
    {/if}
  </div>
</div>
