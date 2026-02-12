<script lang="ts">
  interface MenuItem {
    id: string;
    label: string;
    icon: string;
  }

  interface PlayerInfo {
    name: string;
    callsign: string;
    department: string;
    rank: string;
    jobName?: string;
    gradeLevel?: number;
  }

  let {
    menuItems,
    currentSection,
    playerInfo,
    onSectionChange,
    onLogout,
    onHeaderHover
  }: {
    menuItems: MenuItem[];
    currentSection: string;
    playerInfo: PlayerInfo;
    onSectionChange: (section: string) => void;
    onLogout: () => void;
    onHeaderHover: (hovered: boolean) => void;
  } = $props();

  // ox_inventory exact colors from Shop.svelte
  const colors = {
    card: 'rgba(35, 35, 40, 0.9)',
    popover: 'rgba(25, 25, 28, 0.95)',
    border: 'rgba(60, 60, 65, 0.8)',
    primary: '#22c55e',
    primaryBg: 'rgba(34, 197, 94, 0.2)',
    foreground: 'rgba(255, 255, 255, 0.9)',
    muted: 'rgba(255, 255, 255, 0.5)',
    accent: 'rgba(45, 45, 50, 0.9)'
  };

  function getJobLogo(jobName: string): string {
    const logos: Record<string, string> = {
      lspd: 'images/lspd_logo.webp',
      bcso: 'images/lspd_logo.webp',
      sasp: 'images/lspd_logo.webp',
      dhs: 'images/dhs_logo.webp',
      doj: 'images/lspd_logo.webp'
    };
    return logos[jobName?.toLowerCase()] || 'images/lspd_logo.webp';
  }

  let jobLogo = $derived(getJobLogo(playerInfo.jobName || ''));
</script>

<div class="w-52 flex flex-col" style="background-color: {colors.card}; border-right: 1px solid {colors.border};">
  <!-- Department Logo -->
  <div
    class="flex items-center justify-center py-5"
    onmouseenter={() => onHeaderHover(true)}
    onmouseleave={() => onHeaderHover(false)}
  >
    <img src={jobLogo} alt="Department Logo" class="w-44 h-44 object-contain" />
  </div>

  <!-- Navigation Items -->
  <div class="flex-1 p-3 flex flex-col">
    <div class="flex-1 space-y-1">
      {#each menuItems as item}
        <button
          class="w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors"
          style="
            background-color: {currentSection === item.id ? colors.accent : 'transparent'};
            color: {currentSection === item.id ? colors.foreground : colors.muted};
            border-left: 2px solid transparent;
            border-radius: 2px;
          "
          onclick={() => onSectionChange(item.id)}
          onmouseenter={(e) => { if (currentSection !== item.id) { e.currentTarget.style.backgroundColor = colors.accent; e.currentTarget.style.color = colors.foreground; }}}
          onmouseleave={(e) => { if (currentSection !== item.id) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = colors.muted; }}}
        >
          <i class="{item.icon} text-sm w-4 text-center"></i>
          <span class="text-sm truncate">{item.label}</span>
        </button>
      {/each}
    </div>

    <!-- Bottom Actions -->
    <div class="pt-3 space-y-1" style="border-top: 1px solid {colors.border};">
      <button
        class="w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors"
        style="color: {colors.muted}; border-radius: 2px;"
        onmouseenter={(e) => { e.currentTarget.style.backgroundColor = colors.accent; e.currentTarget.style.color = colors.foreground; }}
        onmouseleave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = colors.muted; }}
      >
        <i class="fas fa-cog text-sm w-4 text-center"></i>
        <span class="text-sm">Settings</span>
      </button>
      <button
        class="w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors"
        style="color: {colors.muted}; border-radius: 2px;"
        onclick={onLogout}
        onmouseenter={(e) => { e.currentTarget.style.backgroundColor = colors.accent; e.currentTarget.style.color = colors.foreground; }}
        onmouseleave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = colors.muted; }}
      >
        <i class="fas fa-sign-out-alt text-sm w-4 text-center"></i>
        <span class="text-sm">Logout</span>
      </button>
    </div>
  </div>
</div>
