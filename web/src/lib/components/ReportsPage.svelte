<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchNui } from '../utils/fetchNui';
  import TrafficTicketEditor from './TrafficTicketEditor.svelte';
  import TrafficTicketViewer from './TrafficTicketViewer.svelte';

  interface Charge {
    code: string;
    title: string;
    class: 'Felony' | 'Misdemeanor' | 'Infraction';
    fine: number;
    months: number;
    citizenid: string;
  }

  interface Report {
    id: number;
    report_number: string;
    title: string;
    type: string;
    status: string;
    priority: string;
    created_by: string;
    created_at: string;
    updated_at: string;
  }

  interface Officer {
    name: string;
    callsign: string;
    citizenid?: string;
    department?: string;
  }

  interface InvolvedPerson {
    citizenid: string;
    name: string;
    role: 'witness' | 'suspect';
    birthdate?: string;
    phone?: string;
  }

  interface CitizenSearchResult {
    citizenid: string;
    name: string;
    phone: string;
  }

  let {
    playerInfo,
    onlineOfficers = [],
    navigationData = null
  }: {
    playerInfo?: {
      name: string;
      callsign: string;
      department: string;
      rank: string;
      jobName?: string;
      gradeLevel?: number;
      citizenid?: string;
    };
    onlineOfficers?: Array<{
      id: number;
      name: string;
      callsign: string;
      department: string;
      citizenid?: string;
    }>;
    navigationData?: { reportId?: number } | null;
  } = $props();

  const REPORT_TYPES = [
    { value: 'traffic', label: 'Traffic Violation', icon: 'fa-car-crash' },
    { value: 'incident', label: 'Incident Report', icon: 'fa-file-alt' },
    { value: 'investigation', label: 'Investigation', icon: 'fa-search' }
  ];

  // State
  let reports = $state<Report[]>([]);
  let selectedReportId = $state<number | null>(null);
  let editorMode = $state<'view' | 'edit' | 'create'>('view');
  let loading = $state(false);
  let saving = $state(false);
  let deleting = $state(false);

  // Filters
  let filters = $state({ search: '', type: 'all' });

  // Form data
  let formData = $state({
    title: '',
    type: 'traffic',
    status: 'open',
    priority: 'normal',
    content: '',
    location: '',
    officers: [] as Officer[],
    civilians: [] as InvolvedPerson[],
    criminals: [] as InvolvedPerson[],
    charges: [] as Charge[],
    tags: [] as string[]
  });

  // Tags state
  let newTag = $state('');

  // UI State
  let showCreateDropdown = $state(false);
  let showTrafficTicketEditor = $state(false);
  let showTrafficTicketViewer = $state(false);
  let ticketViewerData = $state<any>(null);
  let personSearchModalOpen = $state(false);
  let personSearchMode = $state<'officer' | 'civilian' | 'criminal'>('officer');
  let personSearchQuery = $state('');
  let personSearchResults = $state<CitizenSearchResult[]>([]);
  let personSearchLoading = $state(false);

  // Permissions
  let canDelete = $state(false);

  // Check delete permission based on rank
  $effect(() => {
    if (!playerInfo) return;
    const requiredRanks: Record<string, number> = {
      lspd: 5,
      bcso: 7,
      sasp: 3,
      dhs: 1
    };
    const jobName = playerInfo.jobName?.toLowerCase() || '';
    const gradeLevel = playerInfo.gradeLevel || 0;
    canDelete = requiredRanks[jobName] !== undefined && gradeLevel >= requiredRanks[jobName];
  });

  // Load reports when filters change
  $effect(() => {
    loadReports();
  });

  // Handle navigation from other pages
  $effect(() => {
    if (navigationData?.reportId) {
      viewReport(navigationData.reportId);
    }
  });

  async function loadReports() {
    loading = true;
    try {
      const result = await fetchNui<Report[]>('getReports', { filters });
      reports = result || [];
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      loading = false;
    }
  }

  async function viewReport(reportId: number) {
    loading = true;
    try {
      const result = await fetchNui<any>('getReport', { reportId });
      if (result) {
        // Check if this is a traffic ticket
        if (result.report.is_ticket) {
          // Parse ticket_data JSON (stored as a JSON string in the report row)
          const td = typeof result.report.ticket_data === 'string'
            ? JSON.parse(result.report.ticket_data)
            : result.report.ticket_data || {};

          // Show in TrafficTicketViewer instead
          ticketViewerData = {
            ticketId: result.report.id,
            reportNumber: result.report.report_number,
            policeName: result.report.created_by,
            policeRank: td.officerRank,
            policeBadge: td.officerBadge,
            citizenId: td.citizenId,
            citizenName: td.citizenName,
            citizenSex: td.citizenSex,
            citizenDob: td.citizenDob,
            fine: td.fine,
            reason: td.reason,
            payUntil: td.payUntil,
            signature: td.signature,
            securityKey: td.securityKey,
            signatureTimestamp: td.signatureTimestamp,
            paid: td.paid,
            contested: td.contested,
            viewOnly: true
          };
          showTrafficTicketViewer = true;
          selectedReportId = reportId;
          loading = false;
          return;
        }

        selectedReportId = reportId;
        editorMode = 'view';
        formData = {
          title: result.report.title,
          type: result.report.type,
          status: result.report.status || 'open',
          priority: result.report.priority || 'normal',
          content: result.report.content || '',
          location: result.report.location || '',
          officers: result.officers?.map((o: any) => ({
            name: o.officer_name,
            callsign: o.officer_callsign,
            citizenid: o.officer_citizenid || '',
            department: ''
          })) || [],
          civilians: result.involved?.filter((i: any) => i.role === 'witness').map((i: any) => ({
            citizenid: i.citizenid,
            name: i.name || 'Unknown',
            role: 'witness' as const
          })) || [],
          criminals: result.involved?.filter((i: any) => i.role === 'suspect').map((i: any) => ({
            citizenid: i.citizenid,
            name: i.name || 'Unknown',
            role: 'suspect' as const
          })) || [],
          charges: result.charges?.map((c: any) => ({
            code: c.charge_code,
            title: c.charge_title,
            class: c.charge_class,
            fine: c.fine,
            months: c.months,
            citizenid: c.citizenid
          })) || [],
          tags: result.report.tags ? (typeof result.report.tags === 'string' ? JSON.parse(result.report.tags) : result.report.tags) : []
        };
      }
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      loading = false;
    }
  }

  function closeTrafficTicketViewer() {
    showTrafficTicketViewer = false;
    ticketViewerData = null;
    selectedReportId = null;
  }

  function createNewReport(reportType: string) {
    // If traffic violation, show the traffic ticket editor instead
    if (reportType === 'traffic') {
      showTrafficTicketEditor = true;
      selectedReportId = null;
      editorMode = 'view';
      showCreateDropdown = false;
      return;
    }

    formData = {
      title: '',
      type: reportType,
      status: 'open',
      priority: 'normal',
      content: '',
      location: '',
      officers: playerInfo
        ? [{
            name: playerInfo.name,
            callsign: playerInfo.callsign,
            citizenid: playerInfo.citizenid || '',
            department: playerInfo.department || ''
          }]
        : [],
      civilians: [],
      criminals: [],
      charges: [],
      tags: []
    };
    selectedReportId = null;
    editorMode = 'create';
    showCreateDropdown = false;
  }

  function closeTrafficTicketEditor() {
    showTrafficTicketEditor = false;
  }

  function onTrafficTicketSuccess() {
    showTrafficTicketEditor = false;
    // Optionally refresh reports list
    loadReports();
  }

  function editReport() {
    editorMode = 'edit';
  }

  async function saveReport() {
    if (!formData.title.trim()) return;
    saving = true;
    try {
      const officers = formData.officers.map((o) => ({
        name: o.name,
        callsign: o.callsign,
        citizenid: o.citizenid || ''
      }));

      const involved = [
        ...formData.civilians.map((c) => ({
          citizenid: c.citizenid,
          role: 'witness',
          notes: ''
        })),
        ...formData.criminals.map((c) => ({
          citizenid: c.citizenid,
          role: 'suspect',
          notes: ''
        }))
      ];

      const charges = formData.charges.map((c) => ({
        citizenid: c.citizenid,
        code: c.code,
        title: c.title,
        class: c.class,
        fine: c.fine,
        months: c.months,
        guiltyPlea: false
      }));

      const reportData = {
        title: formData.title,
        type: formData.type,
        status: formData.status,
        priority: formData.priority,
        content: formData.content,
        location: formData.location,
        officers,
        involved,
        charges,
        tags: formData.tags,
        reportId: selectedReportId || undefined
      };

      const result = await fetchNui<{ success: boolean; reportId?: number; message?: string }>(
        editorMode === 'create' ? 'createReport' : 'updateReport',
        reportData
      );

      if (result && result.success) {
        if (editorMode === 'create' && result.reportId) {
          viewReport(result.reportId);
        } else {
          editorMode = 'view';
          loadReports();
          if (selectedReportId) {
            viewReport(selectedReportId);
          }
        }
      }
    } catch (error) {
      console.error('Error saving report:', error);
    } finally {
      saving = false;
    }
  }

  async function deleteReport(reportId: number) {
    if (!canDelete || deleting) return;
    deleting = true;
    try {
      const result = await fetchNui<{ success: boolean } | boolean>('deleteReport', { reportId });
      const success = typeof result === 'boolean' ? result : result?.success;
      if (success) {
        selectedReportId = null;
        editorMode = 'view';
        loadReports();
      }
    } catch (error) {
      console.error('Error deleting report:', error);
    } finally {
      deleting = false;
    }
  }

  function cancelEdit() {
    if (selectedReportId) {
      viewReport(selectedReportId);
    } else {
      selectedReportId = null;
      editorMode = 'view';
    }
  }

  function openPersonSearch(mode: 'officer' | 'civilian' | 'criminal') {
    personSearchMode = mode;
    personSearchQuery = '';
    personSearchResults = [];
    personSearchModalOpen = true;
  }

  async function searchPersons() {
    if (!personSearchQuery.trim()) return;
    personSearchLoading = true;
    try {
      const results = await fetchNui<CitizenSearchResult[]>('searchCitizensForReport', {
        query: personSearchQuery
      });
      personSearchResults = results || [];
    } catch (error) {
      console.error('Error searching persons:', error);
    } finally {
      personSearchLoading = false;
    }
  }

  function selectPerson(person: CitizenSearchResult) {
    if (personSearchMode === 'officer') {
      const newOfficer: Officer = {
        name: person.name,
        callsign: '',
        citizenid: person.citizenid,
        department: ''
      };
      if (!formData.officers.some(o => o.citizenid === newOfficer.citizenid)) {
        formData.officers = [...formData.officers, newOfficer];
      }
    } else if (personSearchMode === 'civilian') {
      const newCivilian: InvolvedPerson = {
        citizenid: person.citizenid,
        name: person.name,
        role: 'witness'
      };
      if (!formData.civilians.some(c => c.citizenid === newCivilian.citizenid)) {
        formData.civilians = [...formData.civilians, newCivilian];
      }
    } else if (personSearchMode === 'criminal') {
      const newCriminal: InvolvedPerson = {
        citizenid: person.citizenid,
        name: person.name,
        role: 'suspect'
      };
      if (!formData.criminals.some(c => c.citizenid === newCriminal.citizenid)) {
        formData.criminals = [...formData.criminals, newCriminal];
      }
    }
    personSearchModalOpen = false;
  }

  function removeOfficer(citizenid: string) {
    formData.officers = formData.officers.filter(o => o.citizenid !== citizenid);
  }

  function removeCivilian(citizenid: string) {
    formData.civilians = formData.civilians.filter(c => c.citizenid !== citizenid);
  }

  function removeCriminal(citizenid: string) {
    formData.criminals = formData.criminals.filter(c => c.citizenid !== citizenid);
    formData.charges = formData.charges.filter(ch => ch.citizenid !== citizenid);
  }

  function addTag() {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      formData.tags = [...formData.tags, newTag.trim()];
      newTag = '';
    }
  }

  function removeTag(tag: string) {
    formData.tags = formData.tags.filter(t => t !== tag);
  }

  function formatDateShort(dateString: string) {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }

  function getTypeLabel(type: string) {
    const typeObj = REPORT_TYPES.find((t) => t.value === type);
    return typeObj?.label || type;
  }

  let isEditing = $derived(editorMode === 'edit' || editorMode === 'create');
</script>

<div class="h-full grid grid-cols-[320px_1fr_320px] gap-1">
  <!-- LEFT COLUMN - Reports List -->
  <div class="mdt-card flex flex-col overflow-hidden" style="border-radius: 2px;">
    <!-- Header with Title and Create Button -->
    <div class="p-1 border-b border-mdt-border-subtle flex items-center justify-between">
      <h3 class="text-xs font-semibold text-mdt-text">Incidents</h3>
      <div class="relative">
        <button
          class="w-6 h-6 bg-primary-600 hover:bg-primary-700 text-white transition-colors flex items-center justify-center"
          onclick={() => showCreateDropdown = !showCreateDropdown}
          style="border-radius: 2px;"
        >
          <i class="fas fa-plus text-xs"></i>
        </button>
        {#if showCreateDropdown}
          <div
            class="fixed inset-0 z-10"
            onclick={() => showCreateDropdown = false}
          ></div>
          <div class="absolute right-0 top-full mt-1 w-48 bg-mdt-bg border border-mdt-border-subtle shadow-lg py-0.5 z-20" style="border-radius: 2px;">
            {#each REPORT_TYPES as type}
              <button
                class="w-full px-3 py-2 text-left text-xs text-mdt-text hover:bg-mdt-bg-hover transition-colors flex items-center gap-2"
                onclick={() => createNewReport(type.value)}
              >
                <i class="fas {type.icon} text-primary-400"></i>
                {type.label}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Search -->
    <div class="p-1 border-b border-mdt-border-subtle">
      <div class="relative">
        <i class="fas fa-search absolute left-2 top-1/2 transform -translate-y-1/2 text-xs text-mdt-text-subtle"></i>
        <input
          type="text"
          class="mdt-input pl-8 w-full text-xs py-0.5"
          placeholder="Search incidents..."
          bind:value={filters.search}
          style="border-radius: 2px;"
        />
      </div>
    </div>

    <!-- Reports List -->
    <div class="flex-1 overflow-auto custom-scrollbar">
      {#if loading}
        <div class="flex items-center justify-center h-32">
          <div class="loading-spinner"></div>
        </div>
      {:else if reports.length > 0}
        <div class="divide-y divide-mdt-border-subtle">
          {#each reports as report (report.id)}
            <div
              class="px-1 py-1 hover:bg-mdt-bg-hover transition-colors cursor-pointer {selectedReportId === report.id ? 'bg-mdt-bg-hover border-l-2 border-primary-500' : ''}"
              onclick={() => viewReport(report.id)}
            >
              <div class="flex items-start justify-between gap-1.5 mb-0.5">
                <span class="text-xs font-medium text-mdt-text truncate flex-1">
                  {report.title} - {formatDateShort(report.created_at)}
                </span>
                <span class="text-xs text-primary-400 whitespace-nowrap">
                  {getTypeLabel(report.type)}
                </span>
              </div>
              <div class="flex items-center justify-between gap-1.5">
                <span class="text-xs font-mono text-mdt-text-muted">
                  ID:{report.id}
                </span>
                <span class="text-xs text-mdt-text-subtle">
                  {report.created_by}
                </span>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="flex flex-col items-center justify-center h-full py-6">
          <i class="fas fa-file-alt text-xl text-mdt-text-subtle mb-2"></i>
          <span class="text-xs text-mdt-text-muted">No incidents found</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- CENTER COLUMN - Incident Editor / Traffic Ticket Editor / Traffic Ticket Viewer -->
  <div class="mdt-card flex flex-col overflow-hidden" style="border-radius: 2px;">
    {#if showTrafficTicketEditor}
      <TrafficTicketEditor
        {playerInfo}
        onCancel={closeTrafficTicketEditor}
        onSuccess={onTrafficTicketSuccess}
      />
    {:else if showTrafficTicketViewer && ticketViewerData}
      <TrafficTicketViewer
        ticketData={ticketViewerData}
        onClose={closeTrafficTicketViewer}
      />
    {:else if selectedReportId || editorMode === 'create'}
      <!-- Header with Title and Actions -->
      <div class="p-1 border-b border-mdt-border-subtle flex items-center justify-between">
        <div class="flex items-center gap-1">
          <h3 class="text-xs font-semibold text-mdt-text">
            {editorMode === 'create' ? 'New Incident' : `Incident #${selectedReportId}`}
          </h3>
          <span class="text-xs text-primary-400">
            {getTypeLabel(formData.type)}
          </span>
        </div>
        <div class="flex items-center gap-1">
          {#if isEditing}
            <button
              class="px-2 py-1 text-xs text-mdt-text-muted hover:text-mdt-text transition-colors"
              onclick={cancelEdit}
            >
              Cancel
            </button>
            <button
              class="mdt-button mdt-button-primary text-xs flex items-center gap-1 py-1 px-2"
              class:opacity-50={saving || !formData.title.trim()}
              onclick={saveReport}
              disabled={saving || !formData.title.trim()}
              style="border-radius: 2px;"
            >
              {#if saving}
                <div class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Saving...
              {:else}
                <i class="fas fa-save text-xs"></i>
                Save
              {/if}
            </button>
          {:else}
            <button
              class="mdt-button mdt-button-primary text-xs flex items-center gap-1 py-1 px-2"
              onclick={editReport}
              style="border-radius: 2px;"
            >
              <i class="fas fa-edit text-xs"></i>
              Edit
            </button>
            {#if canDelete && selectedReportId}
              <button
                class="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs transition-colors flex items-center gap-1"
                class:opacity-50={deleting}
                onclick={() => deleteReport(selectedReportId!)}
                disabled={deleting}
                style="border-radius: 2px;"
              >
                <i class="fas fa-trash text-xs"></i>
                Delete
              </button>
            {/if}
          {/if}
        </div>
      </div>

      <!-- Title Input -->
      <div class="p-1 border-b border-mdt-border-subtle">
        <input
          type="text"
          class="mdt-input w-full text-xs font-medium py-0.5"
          placeholder="Incident Title..."
          bind:value={formData.title}
          disabled={!isEditing}
          style="border-radius: 2px;"
        />
      </div>

      <!-- Content Editor -->
      <div class="flex-1 flex flex-col overflow-hidden p-1">
        <div class="flex-1 flex flex-col overflow-hidden border border-mdt-border-subtle bg-mdt-bg" style="border-radius: 2px;">
          <div class="flex-1 overflow-auto p-1">
            <textarea
              class="w-full h-full bg-transparent text-xs text-mdt-text resize-none focus:outline-none"
              placeholder="Write your incident report here..."
              bind:value={formData.content}
              disabled={!isEditing}
            ></textarea>
          </div>
        </div>
      </div>
    {:else}
      <div class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <i class="fas fa-file-alt text-2xl text-mdt-text-subtle mb-2"></i>
          <h3 class="text-xs font-medium text-mdt-text mb-1">No Incident Selected</h3>
          <p class="text-xs text-mdt-text-muted">
            Select an incident or create a new one
          </p>
        </div>
      </div>
    {/if}
  </div>

  <!-- RIGHT COLUMN - Associated People & Tags -->
  <div class="mdt-card flex flex-col overflow-hidden" style="border-radius: 2px;">
    {#if selectedReportId || editorMode === 'create'}
      <div class="flex-1 flex flex-col overflow-auto custom-scrollbar">
        <!-- Officers Involved -->
        <div class="p-1 border-b border-mdt-border-subtle">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-semibold text-mdt-text uppercase tracking-wide">Officers Involved</span>
            {#if isEditing}
              <button
                class="w-5 h-5 bg-primary-600 hover:bg-primary-700 text-white transition-colors flex items-center justify-center"
                onclick={() => openPersonSearch('officer')}
                style="border-radius: 2px;"
              >
                <i class="fas fa-plus text-xs"></i>
              </button>
            {/if}
          </div>
          <div class="flex flex-wrap gap-1">
            {#each formData.officers as officer}
              <div class="px-1.5 py-0.5 bg-primary-900/40 text-xs text-primary-300 flex items-center gap-1" style="border-radius: 2px;">
                <span>{officer.name}</span>
                {#if isEditing}
                  <button
                    class="hover:text-red-400 transition-colors"
                    onclick={() => removeOfficer(officer.citizenid || '')}
                  >
                    <i class="fas fa-times text-xs"></i>
                  </button>
                {/if}
              </div>
            {/each}
            {#if formData.officers.length === 0}
              <span class="text-xs text-mdt-text-subtle italic">No officers added</span>
            {/if}
          </div>
        </div>

        <!-- Civilians Involved -->
        <div class="p-1 border-b border-mdt-border-subtle">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-semibold text-mdt-text uppercase tracking-wide">Civilians Involved</span>
            {#if isEditing}
              <button
                class="w-5 h-5 bg-primary-600 hover:bg-primary-700 text-white transition-colors flex items-center justify-center"
                onclick={() => openPersonSearch('civilian')}
                style="border-radius: 2px;"
              >
                <i class="fas fa-plus text-xs"></i>
              </button>
            {/if}
          </div>
          <div class="flex flex-wrap gap-1">
            {#each formData.civilians as civilian}
              <div class="px-1.5 py-0.5 bg-blue-900/40 text-xs text-blue-300 flex items-center gap-1" style="border-radius: 2px;">
                <span>{civilian.name}</span>
                {#if isEditing}
                  <button
                    class="hover:text-red-400 transition-colors"
                    onclick={() => removeCivilian(civilian.citizenid)}
                  >
                    <i class="fas fa-times text-xs"></i>
                  </button>
                {/if}
              </div>
            {/each}
            {#if formData.civilians.length === 0}
              <span class="text-xs text-mdt-text-subtle italic">No civilians added</span>
            {/if}
          </div>
        </div>

        <!-- Criminals Involved -->
        <div class="p-1 border-b border-mdt-border-subtle">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-semibold text-mdt-text uppercase tracking-wide">Criminals Involved</span>
            {#if isEditing}
              <button
                class="w-5 h-5 bg-primary-600 hover:bg-primary-700 text-white transition-colors flex items-center justify-center"
                onclick={() => openPersonSearch('criminal')}
                style="border-radius: 2px;"
              >
                <i class="fas fa-plus text-xs"></i>
              </button>
            {/if}
          </div>
          <div class="space-y-1">
            {#each formData.criminals as criminal}
              <div class="p-1.5 bg-red-900/20 border border-red-900/40" style="border-radius: 2px;">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-medium text-red-300">{criminal.name}</span>
                  {#if isEditing}
                    <button
                      class="text-red-400 hover:text-red-300 transition-colors"
                      onclick={() => removeCriminal(criminal.citizenid)}
                    >
                      <i class="fas fa-times text-xs"></i>
                    </button>
                  {/if}
                </div>
              </div>
            {/each}
            {#if formData.criminals.length === 0}
              <span class="text-xs text-mdt-text-subtle italic">No criminals added</span>
            {/if}
          </div>
        </div>

        <!-- Tags -->
        <div class="p-1">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-semibold text-mdt-text uppercase tracking-wide">Tags</span>
          </div>
          {#if isEditing}
            <div class="flex items-center gap-1 mb-1">
              <input
                type="text"
                class="mdt-input flex-1 text-xs py-0.5"
                placeholder="Add tag..."
                bind:value={newTag}
                onkeypress={(e) => e.key === 'Enter' && addTag()}
                style="border-radius: 2px;"
              />
              <button
                class="w-5 h-5 bg-primary-600 hover:bg-primary-700 text-white transition-colors flex items-center justify-center"
                onclick={addTag}
                style="border-radius: 2px;"
              >
                <i class="fas fa-plus text-xs"></i>
              </button>
            </div>
          {/if}
          <div class="flex flex-wrap gap-1">
            {#each formData.tags as tag}
              <div class="px-1.5 py-0.5 bg-yellow-900/40 text-xs text-yellow-300 flex items-center gap-1" style="border-radius: 2px;">
                <span>{tag}</span>
                {#if isEditing}
                  <button
                    class="hover:text-red-400 transition-colors"
                    onclick={() => removeTag(tag)}
                  >
                    <i class="fas fa-times text-xs"></i>
                  </button>
                {/if}
              </div>
            {/each}
            {#if formData.tags.length === 0}
              <span class="text-xs text-mdt-text-subtle italic">No tags added</span>
            {/if}
          </div>
        </div>
      </div>
    {:else}
      <div class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <i class="fas fa-users text-2xl text-mdt-text-subtle mb-2"></i>
          <h3 class="text-xs font-medium text-mdt-text mb-1">No Incident Selected</h3>
          <p class="text-xs text-mdt-text-muted">
            Select an incident to view details
          </p>
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Person Search Modal -->
{#if personSearchModalOpen}
<div class="modal-overlay" onclick={() => personSearchModalOpen = false}>
  <div class="modal-container max-w-sm" onclick={(e) => e.stopPropagation()} style="border-radius: 2px;">
    <div class="modal-header" style="padding: 4px 6px;">
      <span class="text-xs font-medium text-mdt-text">
        {personSearchMode === 'officer' ? 'Add Officer' : personSearchMode === 'civilian' ? 'Add Civilian' : 'Add Criminal'}
      </span>
      <button onclick={() => personSearchModalOpen = false} class="text-mdt-text-subtle hover:text-mdt-text">
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
          bind:value={personSearchQuery}
          onkeypress={(e) => e.key === 'Enter' && searchPersons()}
          style="border-radius: 2px;"
        />
      </div>
      <button
        class="mdt-button mdt-button-primary w-full text-xs py-1"
        class:opacity-50={personSearchLoading}
        onclick={searchPersons}
        disabled={personSearchLoading}
        style="border-radius: 2px;"
      >
        {personSearchLoading ? 'Searching...' : 'Search'}
      </button>

      {#if personSearchResults.length > 0}
        <div class="space-y-1 max-h-60 overflow-auto custom-scrollbar">
          {#each personSearchResults as person (person.citizenid)}
            <div
              class="p-1 bg-mdt-bg-elevated border border-mdt-border-subtle cursor-pointer hover:bg-mdt-bg-surface transition-colors"
              onclick={() => selectPerson(person)}
              style="border-radius: 2px;"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-xs font-medium text-mdt-text">{person.name}</div>
                  <span class="text-xs font-mono text-mdt-text-subtle">{person.citizenid}</span>
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
        onclick={() => personSearchModalOpen = false}
        style="border-radius: 2px;"
      >
        Cancel
      </button>
    </div>
  </div>
</div>
{/if}
