<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchNui, onNuiEvent } from '../utils/fetchNui';

  // ox_inventory exact color scheme from Shop.svelte
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
    input: 'rgba(35, 35, 40, 0.9)',
    secondary: 'rgba(45, 45, 50, 0.95)',
    headerBg: 'rgba(0, 0, 0, 0.4)'
  };

  interface Officer {
    id: number;
    name: string;
    callsign: string;
    department: string;
    rank: string;
  }

  interface Announcement {
    id: number;
    title: string;
    content: string;
    author: string;
    importance: 'low' | 'medium' | 'high' | 'critical';
    created_at: string;
    canDelete: boolean;
  }

  interface ActiveBolo {
    id: number;
    plate: string;
    reason: string;
    officer_name: string;
    created_at: string;
    flag_type?: string;
  }

  let {
    onlineOfficers,
    onNavigateToVehicle,
    onNavigateToFlags
  }: {
    onlineOfficers: Officer[];
    onNavigateToVehicle: (plate: string) => void;
    onNavigateToFlags: () => void;
  } = $props();

  let announcements = $state<Announcement[]>([]);
  let activeBolos = $state<ActiveBolo[]>([]);
  let canCreateAnnouncement = $state(false);
  let bolosLoading = $state(false);
  let announcementModalOpen = $state(false);
  let announcementLoading = $state(false);
  let announcementFormData = $state({
    title: '',
    content: '',
    importance: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    duration: 0
  });

  onMount(() => {
    loadAnnouncements();
    loadActiveBolos();
    const boloInterval = setInterval(loadActiveBolos, 30000);
    const unsubRefresh = onNuiEvent('refreshAnnouncements', loadAnnouncements);
    const unsubNew = onNuiEvent('newAnnouncement', loadAnnouncements);
    return () => {
      clearInterval(boloInterval);
      unsubRefresh();
      unsubNew();
    };
  });

  async function loadAnnouncements() {
    try {
      const result = await fetchNui<{ announcements: Announcement[]; canCreate: boolean }>('getAnnouncements', {});
      if (result) {
        announcements = result.announcements || [];
        canCreateAnnouncement = result.canCreate || false;
      }
    } catch (error) {
      console.error('Error loading announcements:', error);
    }
  }

  async function loadActiveBolos() {
    bolosLoading = true;
    try {
      const result = await fetchNui<ActiveBolo[]>('getActiveBolos', {});
      if (result) activeBolos = result;
    } catch (error) {
      activeBolos = [];
    } finally {
      bolosLoading = false;
    }
  }

  async function createAnnouncement() {
    if (!announcementFormData.title.trim() || !announcementFormData.content.trim()) return;
    announcementLoading = true;
    try {
      const result = await fetchNui<{ success: boolean }>('createAnnouncement', announcementFormData);
      if (result.success) {
        announcementModalOpen = false;
        announcementFormData = { title: '', content: '', importance: 'medium', duration: 0 };
        await loadAnnouncements();
      }
    } catch (error) {
      console.error('Error creating announcement:', error);
    } finally {
      announcementLoading = false;
    }
  }

  async function deleteAnnouncement(id: number) {
    try {
      const result = await fetchNui<{ success: boolean }>('deleteAnnouncement', { id });
      if (result.success) announcements = announcements.filter(a => a.id !== id);
    } catch (error) {
      console.error('Error deleting announcement:', error);
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function getImportanceColor(importance: string) {
    const colors: Record<string, string> = {
      critical: '#ef4444', high: '#f59e0b', medium: '#22c55e', low: '#6b7280'
    };
    return colors[importance] || colors.low;
  }

  function getFlagColor(flagType: string) {
    const colors: Record<string, { text: string; bg: string; border: string }> = {
      stolen: { text: '#f87171', bg: 'rgba(248,113,113,0.1)', border: '#ef4444' },
      warrant: { text: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: '#f59e0b' },
      bolo: { text: '#facc15', bg: 'rgba(250,204,21,0.1)', border: '#eab308' },
      suspicious: { text: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: '#3b82f6' }
    };
    return colors[flagType] || { text: c.muted, bg: c.accent, border: c.border };
  }

  function closeModal() {
    announcementModalOpen = false;
    announcementFormData = { title: '', content: '', importance: 'medium', duration: 0 };
  }
</script>

<div class="h-full flex flex-col gap-2 overflow-hidden">
  <!-- Top Row - Announcements & Vehicles side by side -->
  <div class="flex gap-2 overflow-hidden" style="height: 55%">
    <!-- Announcements Section -->
    <div class="flex-1 flex flex-col overflow-hidden" style="background-color: {c.card}; border: 1px solid {c.border}; border-radius: 2px;">
      <div class="flex items-center justify-center px-2.5 py-1.5 relative flex-shrink-0" style="border-bottom: 1px solid {c.border};">
        <div class="flex items-center gap-1.5">
          <div class="w-5 h-5 flex items-center justify-center" style="background-color: {c.primaryBg}; border-radius: 2px;">
            <i class="fas fa-bell text-xs" style="color: {c.primary};"></i>
          </div>
          <h3 class="text-xs font-semibold" style="color: {c.foreground};">ANNOUNCEMENTS</h3>
          {#if announcements.length > 0}
            <span class="px-1 py-0.5 text-xs font-medium" style="background-color: {c.primaryBg}; color: {c.primary}; border-radius: 2px;">{announcements.length}</span>
          {/if}
        </div>
        {#if canCreateAnnouncement}
          <button
            class="absolute right-2.5 inline-flex items-center gap-1 px-1.5 py-1 text-xs font-medium transition-colors"
            style="background-color: {c.primary}; color: white; border-radius: 2px;"
            onclick={() => announcementModalOpen = true}
          >
            <i class="fas fa-plus"></i> New
          </button>
        {/if}
      </div>
      <div class="flex-1 overflow-auto">
        {#if announcements.length > 0}
          {#each announcements as announcement (announcement.id)}
            <div class="px-2.5 py-2 group" style="border-bottom: 1px solid {c.border}; border-left: 2px solid {getImportanceColor(announcement.importance)};">
              <div class="flex items-start justify-between gap-1.5">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1 mb-0.5">
                    <h4 class="text-xs font-semibold truncate" style="color: {c.foreground};">{announcement.title}</h4>
                    <span class="px-1 py-0.5 text-xs font-medium uppercase" style="background-color: {getImportanceColor(announcement.importance)}20; color: {getImportanceColor(announcement.importance)}; border-radius: 2px;">{announcement.importance}</span>
                  </div>
                  <p class="text-xs leading-relaxed mb-1 line-clamp-2" style="color: {c.muted};">{announcement.content}</p>
                  <div class="flex items-center gap-1.5 text-xs" style="color: {c.muted};">
                    <span class="font-medium">{announcement.author}</span>
                    <span>•</span>
                    <span>{formatDate(announcement.created_at)}</span>
                  </div>
                </div>
                {#if announcement.canDelete}
                  <button
                    class="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center transition-opacity"
                    style="color: {c.muted}; border-radius: 2px;"
                    onclick={() => deleteAnnouncement(announcement.id)}
                  >
                    <i class="fas fa-trash text-xs"></i>
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        {:else}
          <div class="flex flex-col items-center justify-center h-full">
            <div class="w-8 h-8 flex items-center justify-center mb-1.5" style="background-color: {c.accent}; border-radius: 2px;">
              <i class="fas fa-bell text-sm" style="color: {c.muted};"></i>
            </div>
            <span class="text-xs font-medium" style="color: {c.muted};">No announcements</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- Vehicles / BOLOs Section -->
    <div class="flex-1 flex flex-col overflow-hidden" style="background-color: {c.card}; border: 1px solid {c.border}; border-radius: 2px;">
      <div class="flex items-center justify-center px-2.5 py-1.5 relative flex-shrink-0" style="border-bottom: 1px solid {c.border};">
        <div class="flex items-center gap-1.5">
          <div class="w-5 h-5 flex items-center justify-center" style="background-color: rgba(251,146,60,0.2); border-radius: 2px;">
            <i class="fas fa-eye text-xs" style="color: #fb923c;"></i>
          </div>
          <h3 class="text-xs font-semibold" style="color: {c.foreground};">VEHICLES</h3>
          {#if activeBolos.length > 0}
            <span class="px-1 py-0.5 text-xs font-medium" style="background-color: rgba(251,146,60,0.2); color: #fb923c; border-radius: 2px;">{activeBolos.length}</span>
          {/if}
        </div>
        <button
          class="w-5 h-5 flex items-center justify-center absolute right-2.5 transition-colors"
          style="color: {c.muted}; border-radius: 2px;"
          onclick={onNavigateToFlags}
        >
          <i class="fas fa-external-link-alt text-xs"></i>
        </button>
      </div>
      <div class="flex-1 overflow-auto">
        {#if bolosLoading}
          <div class="flex items-center justify-center h-full">
            <div class="w-6 h-6 rounded-full animate-spin" style="border: 2px solid {c.primary}; border-top-color: transparent;"></div>
          </div>
        {:else if activeBolos.length > 0}
          {#each activeBolos.slice(0, 8) as bolo (bolo.id)}
            {@const flagColor = getFlagColor(bolo.flag_type || 'bolo')}
            <div
              class="px-2.5 py-2 cursor-pointer group"
              style="border-bottom: 1px solid {c.border}; border-left: 2px solid {flagColor.border};"
              onclick={() => onNavigateToVehicle(bolo.plate)}
            >
              <div class="flex items-center gap-1 mb-0.5">
                <span class="text-xs font-mono font-semibold tracking-wider" style="color: {c.foreground};">{bolo.plate}</span>
                <span class="px-1 py-0.5 text-xs font-semibold uppercase" style="background-color: {flagColor.bg}; color: {flagColor.text}; border-radius: 2px;">{bolo.flag_type || 'bolo'}</span>
              </div>
              <p class="text-xs truncate mb-0.5" style="color: {c.muted};">{bolo.reason || 'No description'}</p>
              <div class="flex items-center gap-1 text-xs" style="color: {c.muted};">
                <span class="font-medium">{bolo.officer_name}</span>
                <span>•</span>
                <span>{new Date(bolo.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          {/each}
        {:else}
          <div class="flex flex-col items-center justify-center h-full">
            <div class="w-8 h-8 flex items-center justify-center mb-1.5" style="background-color: {c.accent}; border-radius: 2px;">
              <i class="fas fa-check-circle text-sm" style="color: {c.primary};"></i>
            </div>
            <span class="text-xs font-medium" style="color: {c.muted};">All clear</span>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Bottom Row - Officers On Duty -->
  <div class="flex-1 flex flex-col overflow-hidden" style="background-color: {c.card}; border: 1px solid {c.border}; border-radius: 2px;">
    <div class="px-2.5 py-1.5 flex items-center justify-center relative flex-shrink-0" style="border-bottom: 1px solid {c.border};">
      <div class="flex items-center gap-1.5">
        <div class="w-5 h-5 flex items-center justify-center" style="background-color: {c.primaryBg}; border-radius: 2px;">
          <i class="fas fa-users text-xs" style="color: {c.primary};"></i>
        </div>
        <h3 class="text-xs font-semibold" style="color: {c.foreground};">ACTIVE UNITS</h3>
      </div>
      <span class="absolute right-2.5 px-1 py-0.5 text-xs font-medium" style="background-color: {c.primaryBg}; color: {c.primary}; border-radius: 2px;">{onlineOfficers.length}</span>
    </div>

    <div class="flex-1 overflow-auto">
      {#if onlineOfficers.length > 0}
        <table class="w-full" style="table-layout: fixed;">
          <thead class="sticky top-0 z-10" style="background-color: {c.card};">
            <tr>
              <th class="text-left text-xs font-semibold uppercase tracking-wide" style="width: 60px; padding: 6px 8px; color: {c.muted};">Status</th>
              <th class="text-left text-xs font-semibold uppercase tracking-wide" style="width: 22%; padding: 6px 8px; color: {c.muted};">Name</th>
              <th class="text-left text-xs font-semibold uppercase tracking-wide" style="width: 22%; padding: 6px 8px; color: {c.muted};">Department</th>
              <th class="text-left text-xs font-semibold uppercase tracking-wide" style="width: 18%; padding: 6px 8px; color: {c.muted};">Rank</th>
              <th class="text-left text-xs font-semibold uppercase tracking-wide" style="padding: 6px 8px; color: {c.muted};">Callsign</th>
            </tr>
          </thead>
          <tbody>
            {#each onlineOfficers as officer (officer.id)}
              <tr style="border-bottom: 1px solid {c.border};">
                <td style="padding: 7px 8px;">
                  <div class="flex items-center justify-center">
                    <div class="w-2 h-2 rounded-full animate-pulse" style="background-color: {c.primary};"></div>
                  </div>
                </td>
                <td class="font-medium text-xs" style="padding: 7px 8px; color: {c.foreground};">
                  <div class="truncate">{officer.name}</div>
                </td>
                <td class="text-xs" style="padding: 7px 8px; color: {c.muted};">
                  <div class="truncate">{officer.department || 'LSPD'}</div>
                </td>
                <td class="text-xs" style="padding: 7px 8px; color: {c.foreground};">
                  <div class="truncate">{officer.rank}</div>
                </td>
                <td style="padding: 7px 8px;">
                  <span class="px-1 py-0.5 text-xs font-mono" style="border: 1px solid {c.border}; color: {c.muted}; border-radius: 2px;">{officer.callsign}</span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <div class="flex flex-col items-center justify-center h-full py-4">
          <div class="w-8 h-8 flex items-center justify-center mb-1.5" style="background-color: {c.accent}; border-radius: 2px;">
            <i class="fas fa-user-slash text-sm" style="color: {c.muted};"></i>
          </div>
          <span class="text-xs font-medium" style="color: {c.muted};">No officers on duty</span>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Announcement Modal -->
{#if announcementModalOpen}
<div
  class="fixed inset-0 flex items-center justify-center z-50"
  style="background-color: rgba(0,0,0,0.7); backdrop-filter: blur(2px);"
  onclick={(e: MouseEvent) => { if (e.target === e.currentTarget) closeModal(); }}
>
  <div class="shadow-xl w-full max-w-md" style="background-color: {c.popover}; border: 1px solid {c.border}; border-radius: 4px;" onclick={(e: MouseEvent) => e.stopPropagation()}>
    <div class="px-5 py-4" style="border-bottom: 1px solid {c.border};">
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 flex items-center justify-center" style="background-color: {c.primaryBg}; border-radius: 2px;">
            <i class="fas fa-bullhorn" style="color: {c.primary};"></i>
          </div>
          <div>
            <h2 class="text-lg font-semibold" style="color: {c.foreground};">Create Announcement</h2>
            <p class="text-xs" style="color: {c.muted};">Broadcast a message to all officers</p>
          </div>
        </div>
        <button onclick={closeModal} style="color: {c.muted};">
          <i class="fas fa-times text-lg"></i>
        </button>
      </div>
    </div>

    <div class="p-5 space-y-5">
      <div>
        <label class="block text-sm font-medium mb-2" style="color: {c.muted};">Title</label>
        <input
          type="text"
          class="w-full px-3 py-2"
          style="background-color: {c.input}; border: 1px solid {c.border}; color: {c.foreground}; border-radius: 2px;"
          placeholder="Enter announcement title"
          bind:value={announcementFormData.title}
        />
      </div>
      <div>
        <label class="block text-sm font-medium mb-2" style="color: {c.muted};">Content</label>
        <textarea
          class="w-full px-3 py-2 h-28 resize-none"
          style="background-color: {c.input}; border: 1px solid {c.border}; color: {c.foreground}; border-radius: 2px;"
          placeholder="Enter announcement content"
          bind:value={announcementFormData.content}
        ></textarea>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-2" style="color: {c.muted};">Priority</label>
          <select class="w-full px-3 py-2" style="background-color: {c.input}; border: 1px solid {c.border}; color: {c.foreground}; border-radius: 2px;" bind:value={announcementFormData.importance}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-2" style="color: {c.muted};">Duration (hours)</label>
          <input
            type="number"
            class="w-full px-3 py-2"
            style="background-color: {c.input}; border: 1px solid {c.border}; color: {c.foreground}; border-radius: 2px;"
            placeholder="0 = no expiry"
            min="0" max="168"
            bind:value={announcementFormData.duration}
          />
        </div>
      </div>
    </div>

    <div class="px-5 py-4 flex justify-end gap-3" style="border-top: 1px solid {c.border};">
      <button class="px-4 py-2 text-sm font-medium" style="background-color: {c.secondary}; color: {c.foreground}; border-radius: 2px;" onclick={closeModal}>Cancel</button>
      <button
        class="px-4 py-2 text-sm font-medium inline-flex items-center gap-2"
        style="background-color: {c.primary}; color: white; opacity: {announcementLoading || !announcementFormData.title.trim() || !announcementFormData.content.trim() ? 0.5 : 1}; border-radius: 2px;"
        onclick={createAnnouncement}
        disabled={announcementLoading || !announcementFormData.title.trim() || !announcementFormData.content.trim()}
      >
        {#if announcementLoading}
          <div class="w-4 h-4 rounded-full animate-spin" style="border: 2px solid rgba(255,255,255,0.3); border-top-color: white;"></div>
          Creating...
        {:else}
          <i class="fas fa-paper-plane"></i> Create
        {/if}
      </button>
    </div>
  </div>
</div>
{/if}
