<script lang="ts">
  import { fetchNui } from '../utils/fetchNui';

  interface TicketData {
    ticketId: number;
    reportNumber?: string;
    policeName: string;
    policeRank?: string;
    policeBadge?: string;
    citizenId: string;
    citizenName: string;
    citizenSex: number;
    citizenDob: string;
    fine: number;
    reason: string;
    payUntil: string;
    signature: string;
    securityKey?: string;
    signatureTimestamp?: string;
    paid: boolean;
    contested: boolean;
    viewOnly: boolean;
  }

  let {
    ticketData,
    onClose,
    onPay,
    onContest
  }: {
    ticketData: TicketData;
    onClose: () => void;
    onPay?: (ticketId: number) => void;
    onContest?: (ticketId: number) => void;
  } = $props();

  let paying = $state(false);
  let contesting = $state(false);

  function formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }

  function getSexLabel(sex: number): string {
    if (sex === 0) return 'Male';
    if (sex === 1) return 'Female';
    return 'Unknown';
  }

  async function handlePay() {
    if (paying || ticketData.paid) return;
    paying = true;
    try {
      if (onPay) {
        onPay(ticketData.ticketId);
      } else {
        const result = await fetchNui<{ success: boolean; message?: string }>('payTicket', { ticketId: ticketData.ticketId });
        if (result?.success) {
          onClose();
        }
      }
    } catch (error) {
      console.error('Error paying ticket:', error);
    } finally {
      paying = false;
    }
  }

  async function handleContest() {
    if (contesting || ticketData.contested || ticketData.paid) return;
    contesting = true;
    try {
      if (onContest) {
        onContest(ticketData.ticketId);
      } else {
        const result = await fetchNui<{ success: boolean; message?: string }>('contestTicket', { ticketId: ticketData.ticketId });
        if (result?.success) {
          onClose();
        }
      }
    } catch (error) {
      console.error('Error contesting ticket:', error);
    } finally {
      contesting = false;
    }
  }
</script>

<div class="h-full flex flex-col bg-mdt-bg-base">
  <!-- Header -->
  <div class="p-3 border-b border-mdt-border-subtle flex items-center justify-between bg-mdt-bg-surface">
    <div class="flex items-center gap-2">
      <i class="fas fa-file-invoice-dollar text-primary-400"></i>
      <h3 class="text-sm font-semibold text-mdt-text">Traffic Citation</h3>
      {#if ticketData.reportNumber}
        <span class="text-xs text-mdt-text-muted">#{ticketData.reportNumber}</span>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      {#if ticketData.paid}
        <span class="px-2 py-0.5 text-xs font-medium bg-green-900/40 text-green-400 border border-green-700/50" style="border-radius: 2px;">
          <i class="fas fa-check mr-1"></i>PAID
        </span>
      {:else if ticketData.contested}
        <span class="px-2 py-0.5 text-xs font-medium bg-yellow-900/40 text-yellow-400 border border-yellow-700/50" style="border-radius: 2px;">
          <i class="fas fa-gavel mr-1"></i>CONTESTED
        </span>
      {:else}
        <span class="px-2 py-0.5 text-xs font-medium bg-red-900/40 text-red-400 border border-red-700/50" style="border-radius: 2px;">
          <i class="fas fa-exclamation-triangle mr-1"></i>UNPAID
        </span>
      {/if}
    </div>
  </div>

  <!-- Scrollable Content -->
  <div class="flex-1 overflow-auto custom-scrollbar p-3 space-y-3">
    <!-- Officer Section -->
    <div class="border border-mdt-border-subtle" style="border-radius: 2px;">
      <div class="px-2 py-1.5 bg-mdt-bg-elevated border-b border-mdt-border-subtle">
        <span class="text-xs font-semibold text-mdt-text uppercase tracking-wide">
          <i class="fas fa-shield-alt mr-1 text-primary-400"></i>Issuing Officer
        </span>
      </div>
      <div class="p-3 grid grid-cols-3 gap-3">
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Name</label>
          <div class="px-2 py-1.5 bg-mdt-bg-elevated text-xs text-mdt-text" style="border-radius: 2px;">
            {ticketData.policeName || 'Unknown'}
          </div>
        </div>
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Rank</label>
          <div class="px-2 py-1.5 bg-mdt-bg-elevated text-xs text-mdt-text" style="border-radius: 2px;">
            {ticketData.policeRank || 'N/A'}
          </div>
        </div>
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Badge/Callsign</label>
          <div class="px-2 py-1.5 bg-mdt-bg-elevated text-xs text-mdt-text" style="border-radius: 2px;">
            {ticketData.policeBadge || 'N/A'}
          </div>
        </div>
      </div>
    </div>

    <!-- Citizen Section -->
    <div class="border border-mdt-border-subtle" style="border-radius: 2px;">
      <div class="px-2 py-1.5 bg-mdt-bg-elevated border-b border-mdt-border-subtle">
        <span class="text-xs font-semibold text-mdt-text uppercase tracking-wide">
          <i class="fas fa-user mr-1 text-blue-400"></i>Citizen Information
        </span>
      </div>
      <div class="p-3 grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Citizen ID</label>
          <div class="px-2 py-1.5 bg-mdt-bg-elevated text-xs text-mdt-text font-mono" style="border-radius: 2px;">
            {ticketData.citizenId || 'Unknown'}
          </div>
        </div>
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Full Name</label>
          <div class="px-2 py-1.5 bg-mdt-bg-elevated text-xs text-mdt-text" style="border-radius: 2px;">
            {ticketData.citizenName || 'Unknown'}
          </div>
        </div>
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Sex</label>
          <div class="px-2 py-1.5 bg-mdt-bg-elevated text-xs text-mdt-text" style="border-radius: 2px;">
            {getSexLabel(ticketData.citizenSex)}
          </div>
        </div>
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Date of Birth</label>
          <div class="px-2 py-1.5 bg-mdt-bg-elevated text-xs text-mdt-text" style="border-radius: 2px;">
            {ticketData.citizenDob || 'Unknown'}
          </div>
        </div>
      </div>
    </div>

    <!-- Citation Section -->
    <div class="border border-mdt-border-subtle" style="border-radius: 2px;">
      <div class="px-2 py-1.5 bg-mdt-bg-elevated border-b border-mdt-border-subtle">
        <span class="text-xs font-semibold text-mdt-text uppercase tracking-wide">
          <i class="fas fa-car-crash mr-1 text-red-400"></i>Citation Details
        </span>
      </div>
      <div class="p-3 space-y-3">
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Fine Amount</label>
          <div class="px-2 py-1.5 bg-red-900/20 border border-red-700/40 text-sm font-semibold text-red-400" style="border-radius: 2px;">
            <i class="fas fa-dollar-sign mr-1"></i>${ticketData.fine?.toLocaleString() || '0'}
          </div>
        </div>
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Reason / Violation</label>
          <div class="px-2 py-2 bg-mdt-bg-elevated text-xs text-mdt-text whitespace-pre-wrap" style="border-radius: 2px; min-height: 60px;">
            {ticketData.reason || 'No reason provided'}
          </div>
        </div>
        <div>
          <label class="block text-xs text-mdt-text-muted mb-1">Payment Due By</label>
          <div class="px-2 py-1.5 bg-yellow-900/30 border border-yellow-700/50 text-yellow-300 text-xs" style="border-radius: 2px;">
            <i class="fas fa-clock mr-1"></i>
            {formatDate(ticketData.payUntil)}
          </div>
        </div>
      </div>
    </div>

    <!-- Signature Section -->
    <div class="border border-mdt-border-subtle" style="border-radius: 2px;">
      <div class="px-2 py-1.5 bg-mdt-bg-elevated border-b border-mdt-border-subtle">
        <span class="text-xs font-semibold text-mdt-text uppercase tracking-wide">
          <i class="fas fa-signature mr-1 text-primary-400"></i>Officer Signature
        </span>
      </div>
      <div class="p-3">
        <div class="border-b-2 border-mdt-border-subtle pb-2">
          <div class="flex items-end justify-between">
            <div class="flex-1">
              <span class="text-lg italic text-primary-400" style="font-family: 'Brush Script MT', 'Segoe Script', cursive;">
                {ticketData.signature || 'Unsigned'}
              </span>
            </div>
            <div class="text-xs text-primary-400 ml-2">
              <i class="fas fa-check-circle mr-1"></i>Verified
            </div>
          </div>
        </div>
        <div class="mt-1 flex items-center justify-between text-xs text-mdt-text-muted">
          <span>{ticketData.policeName}</span>
          <span>{ticketData.policeRank || ''}</span>
        </div>
        {#if ticketData.signatureTimestamp || ticketData.securityKey}
          <div class="mt-2 pt-2 border-t border-mdt-border-subtle">
            <div class="flex items-center justify-between text-xs">
              {#if ticketData.signatureTimestamp}
                <div class="text-mdt-text-subtle">
                  <i class="fas fa-clock mr-1"></i>
                  <span>{ticketData.signatureTimestamp}</span>
                </div>
              {/if}
              {#if ticketData.securityKey}
                <div class="text-mdt-text-subtle font-mono">
                  <i class="fas fa-key mr-1"></i>
                  <span>{ticketData.securityKey}</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Footer with actions -->
  <div class="p-3 border-t border-mdt-border-subtle flex items-center justify-between bg-mdt-bg-surface">
    <div class="text-xs text-mdt-text-muted">
      Ticket #{ticketData.ticketId}
    </div>
    <div class="flex items-center gap-2">
      {#if !ticketData.paid && !ticketData.viewOnly}
        {#if !ticketData.contested}
          <button
            class="mdt-button text-xs py-1.5 px-3 flex items-center gap-1 bg-yellow-700 hover:bg-yellow-600 text-white transition-colors"
            class:opacity-50={contesting}
            onclick={handleContest}
            disabled={contesting}
            style="border-radius: 2px;"
          >
            {#if contesting}
              <div class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Contesting...
            {:else}
              <i class="fas fa-gavel"></i>
              Contest
            {/if}
          </button>
        {/if}
        <button
          class="mdt-button mdt-button-primary text-xs py-1.5 px-3 flex items-center gap-1"
          class:opacity-50={paying}
          onclick={handlePay}
          disabled={paying}
          style="border-radius: 2px;"
        >
          {#if paying}
            <div class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            Paying...
          {:else}
            <i class="fas fa-credit-card"></i>
            Pay ${ticketData.fine?.toLocaleString() || '0'}
          {/if}
        </button>
      {/if}
      <button
        class="mdt-button mdt-button-secondary text-xs py-1.5 px-3"
        onclick={onClose}
        style="border-radius: 2px;"
      >
        Close
      </button>
    </div>
  </div>
</div>
