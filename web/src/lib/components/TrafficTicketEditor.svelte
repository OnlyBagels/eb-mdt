<script lang="ts">
  import { fetchNui } from '../utils/fetchNui';

  interface PlayerInfo {
    name: string;
    callsign: string;
    department: string;
    rank: string;
    jobName?: string;
    gradeLevel?: number;
    citizenid?: string;
  }

  let {
    playerInfo,
    onCancel,
    onSuccess
  }: {
    playerInfo?: PlayerInfo;
    onCancel: () => void;
    onSuccess?: () => void;
  } = $props();

  // Form state
  let officerName = $state(playerInfo?.name || '');
  let officerRank = $state(playerInfo?.rank?.replace(/\s*\(\d+\)/, '') || '');
  let officerBadge = $state(playerInfo?.callsign || '');
  let citizenId = $state('');
  let citizenName = $state('');
  let citizenSex = $state<0 | 1 | -1>(-1);
  let citizenDOB = $state('');
  let fineAmount = $state(0);
  let reason = $state('');
  let signature = $state('');
  let saving = $state(false);
  let isSigned = $state(false);
  let signatureTimestamp = $state('');
  let securityKey = $state('');
  let citizenLookupLoading = $state(false);

  // Generate a security key (hash-like string)
  function generateSecurityKey(): string {
    const chars = 'ABCDEF0123456789';
    let key = '';
    for (let i = 0; i < 16; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
      if (i === 3 || i === 7 || i === 11) key += '-';
    }
    return key;
  }

  // Generate digital signature with security key and timestamp
  function signDocument() {
    const now = new Date();
    signatureTimestamp = now.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    securityKey = generateSecurityKey();
    signature = `${officerName} - ${officerBadge}`;
    isSigned = true;
  }

  // Clear signature
  function clearSignature() {
    signature = '';
    signatureTimestamp = '';
    securityKey = '';
    isSigned = false;
  }

  // Lookup citizen by ID and auto-populate fields
  async function lookupCitizen() {
    if (!citizenId.trim() || citizenId.trim().length < 3) return;

    citizenLookupLoading = true;
    try {
      const result = await fetchNui<{
        success: boolean;
        citizen?: {
          name: string;
          dob: string;
          sex: number;
        };
      }>('lookupCitizenForTicket', { citizenid: citizenId.toUpperCase().trim() });

      if (result?.success && result.citizen) {
        citizenName = result.citizen.name;
        citizenDOB = result.citizen.dob;
        citizenSex = result.citizen.sex as 0 | 1;
      }
    } catch (error) {
      console.error('Error looking up citizen:', error);
    } finally {
      citizenLookupLoading = false;
    }
  }

  // Debounce citizen lookup
  let lookupTimeout: ReturnType<typeof setTimeout> | null = null;
  function handleCitizenIdInput(e: Event) {
    const value = (e.target as HTMLInputElement).value.toUpperCase();
    citizenId = value;

    // Clear previous timeout
    if (lookupTimeout) clearTimeout(lookupTimeout);

    // Debounce: wait 500ms after typing stops to lookup
    if (value.trim().length >= 5) {
      lookupTimeout = setTimeout(() => {
        lookupCitizen();
      }, 500);
    }
  }

  // Calculate pay-by date (3 days from now by default)
  let payUntilDate = $derived(() => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return date;
  });

  function formatDate(date: Date) {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatDateISO(date: Date) {
    return date.toISOString();
  }

  async function submitTicket() {
    // Validation
    if (!citizenId.trim()) {
      return;
    }
    if (!citizenName.trim()) {
      return;
    }
    if (citizenSex === -1) {
      return;
    }
    if (!citizenDOB.trim()) {
      return;
    }
    if (fineAmount <= 0) {
      return;
    }
    if (!reason.trim()) {
      return;
    }
    if (!signature.trim()) {
      return;
    }

    saving = true;
    try {
      const ticketData = {
        citizenid: citizenId.toUpperCase().trim(),
        citizenName: citizenName.trim(),
        citizenSex: citizenSex,
        citizenDob: citizenDOB.trim(),
        fine: fineAmount,
        reason: reason.trim(),
        signature: signature.trim(),
      };

      const result = await fetchNui<{ success: boolean; reportId?: number; reportNumber?: string; message?: string }>('issueTrafficTicket', ticketData);

      if (result?.success) {
        onSuccess?.();
        onCancel();
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
    } finally {
      saving = false;
    }
  }

  // Validation state
  let isValid = $derived(
    citizenId.trim() !== '' &&
    citizenName.trim() !== '' &&
    citizenSex !== -1 &&
    citizenDOB.trim() !== '' &&
    fineAmount > 0 &&
    reason.trim() !== '' &&
    signature.trim() !== ''
  );
</script>

<div class="h-full flex flex-col">
  <!-- Header -->
  <div class="p-2 border-b border-mdt-border-subtle flex items-center justify-between bg-mdt-bg-surface">
    <div class="flex items-center gap-2">
      <i class="fas fa-car-crash text-primary-400"></i>
      <h3 class="text-sm font-semibold text-mdt-text">Traffic Citation</h3>
    </div>
    <div class="text-xs text-mdt-text-muted">
      {formatDate(new Date())}
    </div>
  </div>

  <!-- Scrollable Content -->
  <div class="flex-1 overflow-auto custom-scrollbar p-2 space-y-3">
    <!-- Officer Section -->
    <div class="border border-mdt-border-subtle" style="border-radius: 2px;">
      <div class="px-2 py-1 bg-mdt-bg-elevated border-b border-mdt-border-subtle">
        <span class="text-xs font-semibold text-mdt-text uppercase tracking-wide">Issuing Officer</span>
      </div>
      <div class="p-2 grid grid-cols-3 gap-2">
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Name</label>
          <input
            type="text"
            class="mdt-input w-full text-xs py-1"
            bind:value={officerName}
            disabled
            style="border-radius: 2px;"
          />
        </div>
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Rank</label>
          <input
            type="text"
            class="mdt-input w-full text-xs py-1"
            bind:value={officerRank}
            disabled
            style="border-radius: 2px;"
          />
        </div>
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Badge/Callsign</label>
          <input
            type="text"
            class="mdt-input w-full text-xs py-1"
            bind:value={officerBadge}
            disabled
            style="border-radius: 2px;"
          />
        </div>
      </div>
    </div>

    <!-- Citizen Section -->
    <div class="border border-mdt-border-subtle" style="border-radius: 2px;">
      <div class="px-2 py-1 bg-mdt-bg-elevated border-b border-mdt-border-subtle">
        <span class="text-xs font-semibold text-mdt-text uppercase tracking-wide">Citizen Information</span>
      </div>
      <div class="p-2 grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Citizen ID</label>
          <div class="relative">
            <input
              type="text"
              class="mdt-input w-full text-xs py-1 uppercase pr-8"
              placeholder="ABC12345"
              bind:value={citizenId}
              oninput={handleCitizenIdInput}
              style="border-radius: 2px;"
            />
            {#if citizenLookupLoading}
              <div class="absolute right-2 top-1/2 -translate-y-1/2">
                <div class="w-3 h-3 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin"></div>
              </div>
            {/if}
          </div>
        </div>
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Full Name</label>
          <input
            type="text"
            class="mdt-input w-full text-xs py-1"
            placeholder="John Doe"
            bind:value={citizenName}
            style="border-radius: 2px;"
          />
        </div>
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Sex</label>
          <div class="flex gap-1">
            <button
              type="button"
              class="flex-1 py-1 text-xs transition-colors {citizenSex === 0 ? 'bg-primary-600 text-white' : 'bg-mdt-bg-elevated text-mdt-text-muted hover:bg-mdt-bg-hover'}"
              onclick={() => citizenSex = 0}
              style="border-radius: 2px;"
            >
              Male
            </button>
            <button
              type="button"
              class="flex-1 py-1 text-xs transition-colors {citizenSex === 1 ? 'bg-primary-600 text-white' : 'bg-mdt-bg-elevated text-mdt-text-muted hover:bg-mdt-bg-hover'}"
              onclick={() => citizenSex = 1}
              style="border-radius: 2px;"
            >
              Female
            </button>
          </div>
        </div>
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Date of Birth</label>
          <input
            type="text"
            class="mdt-input w-full text-xs py-1"
            placeholder="01/15/1990"
            bind:value={citizenDOB}
            style="border-radius: 2px;"
          />
        </div>
      </div>
    </div>

    <!-- Citation Section -->
    <div class="border border-mdt-border-subtle" style="border-radius: 2px;">
      <div class="px-2 py-1 bg-mdt-bg-elevated border-b border-mdt-border-subtle">
        <span class="text-xs font-semibold text-mdt-text uppercase tracking-wide">Citation Details</span>
      </div>
      <div class="p-2 space-y-2">
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Fine Amount ($)</label>
          <div class="relative">
            <span class="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-mdt-text-muted">$</span>
            <input
              type="number"
              class="mdt-input w-full text-xs py-1 pl-5"
              placeholder="0"
              bind:value={fineAmount}
              min="0"
              style="border-radius: 2px;"
            />
          </div>
        </div>
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Reason / Violation</label>
          <textarea
            class="mdt-input w-full text-xs py-1 resize-none"
            placeholder="Describe the traffic violation..."
            rows="4"
            bind:value={reason}
            style="border-radius: 2px;"
          ></textarea>
        </div>
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Payment Due By</label>
          <div class="px-2 py-1.5 bg-yellow-900/30 border border-yellow-700/50 text-yellow-300 text-xs" style="border-radius: 2px;">
            <i class="fas fa-clock mr-1"></i>
            {formatDate(payUntilDate())}
          </div>
        </div>
      </div>
    </div>

    <!-- Signature Section -->
    <div class="border border-mdt-border-subtle" style="border-radius: 2px;">
      <div class="px-2 py-1 bg-mdt-bg-elevated border-b border-mdt-border-subtle flex items-center justify-between">
        <span class="text-xs font-semibold text-mdt-text uppercase tracking-wide">Officer Signature</span>
        {#if isSigned}
          <button
            type="button"
            class="text-xs text-red-400 hover:text-red-300 transition-colors"
            onclick={clearSignature}
          >
            <i class="fas fa-times mr-1"></i>Clear
          </button>
        {/if}
      </div>
      <div class="p-3">
        {#if isSigned}
          <!-- Signed state - shows signature like a real document -->
          <div class="border-b-2 border-mdt-border-subtle pb-2">
            <div class="flex items-end justify-between">
              <div class="flex-1">
                <span class="text-lg italic text-primary-400" style="font-family: 'Brush Script MT', 'Segoe Script', cursive;">
                  {signature}
                </span>
              </div>
              <div class="text-xs text-primary-400 ml-2">
                <i class="fas fa-check-circle mr-1"></i>Signed
              </div>
            </div>
          </div>
          <div class="mt-1 flex items-center justify-between text-xs text-mdt-text-muted">
            <span>{officerName}</span>
            <span>{officerRank}</span>
          </div>
          <div class="text-xs text-mdt-text-subtle mt-0.5">
            Signed by: {officerName} ({officerBadge})
          </div>
          <!-- Security Key & Timestamp -->
          <div class="mt-2 pt-2 border-t border-mdt-border-subtle">
            <div class="flex items-center justify-between text-xs">
              <div class="text-mdt-text-subtle">
                <i class="fas fa-clock mr-1"></i>
                <span>{signatureTimestamp}</span>
              </div>
              <div class="text-mdt-text-subtle font-mono">
                <i class="fas fa-key mr-1"></i>
                <span>{securityKey}</span>
              </div>
            </div>
          </div>
        {:else}
          <!-- Unsigned state - shows sign button -->
          <div class="border-b-2 border-dashed border-mdt-border-subtle pb-3 mb-2">
            <div class="flex items-center justify-center py-2">
              <span class="text-xs text-mdt-text-subtle italic">X</span>
              <span class="flex-1 mx-2"></span>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <div class="text-xs text-mdt-text-muted">
              <span>{officerName}</span>
              <span class="mx-1">-</span>
              <span>{officerRank}</span>
            </div>
            <button
              type="button"
              class="mdt-button mdt-button-primary text-xs py-1.5 px-4 flex items-center gap-1.5"
              onclick={signDocument}
              style="border-radius: 2px;"
            >
              <i class="fas fa-signature"></i>
              Sign
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="p-2 border-t border-mdt-border-subtle flex items-center justify-end gap-2 bg-mdt-bg-surface">
    <button
      class="mdt-button mdt-button-secondary text-xs py-1.5 px-3"
      onclick={onCancel}
      style="border-radius: 2px;"
    >
      Cancel
    </button>
    <button
      class="mdt-button mdt-button-primary text-xs py-1.5 px-3 flex items-center gap-1"
      class:opacity-50={saving || !isValid}
      onclick={submitTicket}
      disabled={saving || !isValid}
      style="border-radius: 2px;"
    >
      {#if saving}
        <div class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        Creating...
      {:else}
        <i class="fas fa-file-signature"></i>
        Issue Ticket
      {/if}
    </button>
  </div>
</div>
