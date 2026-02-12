<script lang="ts">
  import { onMount } from 'svelte';
  import { onNuiEvent, fetchNui, isEnvBrowser } from '../utils/fetchNui';
  import { loadPostals, getNearestPostal } from '../../utils/misc';

  interface DispatchUnit {
    citizenid: string;
    callsign: string;
    name: string;
    department?: string;
  }

  interface DispatchCall {
    callId: string;
    code: string;
    message: string;
    codeName: string;
    priority: number;
    street: string;
    information?: string;
    alertTime: number;
    coords: { x: number; y: number; z: number };
    units?: DispatchUnit[];
    timestamp?: number;
    expiresAt?: number;
    icon?: string;
  }

  // Helper to count units by department
  function getUnitCountByDept(units: DispatchUnit[]): string {
    if (!units || units.length === 0) return '';

    const deptCounts: Record<string, number> = {};
    for (const unit of units) {
      const dept = unit.department || 'Unknown';
      deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    }

    return Object.entries(deptCounts)
      .map(([dept, count]) => `${dept}: ${count}`)
      .join(', ');
  }

  // State
  let activeCalls = $state<DispatchCall[]>([]);
  let currentIndex = $state(0);
  let hidden = $state(false);
  let isDragging = $state(false);
  let respondKeybind = $state('G');
  let playerCitizenId = $state('');

  // Position state - load from localStorage or use defaults
  const STORAGE_KEY = 'mdt_dispatch_alert_position';
  let position = $state({ x: 20, y: 20 });
  let dragOffset = { x: 0, y: 0 };

  // Time tracking for "time ago" display
  let currentTime = $state(Date.now());

  onMount(() => {
    // Load postals data for postal lookup
    loadPostals();

    // Load position from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          position = parsed;
        }
      } catch {
        // Use default position
      }
    }

    // Update time every second for "time ago" display
    const timeInterval = setInterval(() => {
      currentTime = Date.now();
    }, 1000);

    // NUI event listeners
    const unsubNewCall = onNuiEvent<{ call: DispatchCall; timer: number }>('dispatch:newCall', (data) => {
      addCall(data.call, data.timer);
    });

    const unsubExpired = onNuiEvent<string[]>('dispatch:callsExpired', (callIds) => {
      activeCalls = activeCalls.filter(c => !callIds.includes(c.callId));
      if (currentIndex >= activeCalls.length) {
        currentIndex = Math.max(0, activeCalls.length - 1);
      }
    });

    const unsubHidden = onNuiEvent<boolean>('dispatch:setHidden', (isHidden) => {
      hidden = isHidden;
    });

    const unsubNavigatePrev = onNuiEvent('dispatch:navigatePrevious', () => {
      if (activeCalls.length > 1) {
        currentIndex = (currentIndex - 1 + activeCalls.length) % activeCalls.length;
      }
    });

    const unsubNavigateNext = onNuiEvent('dispatch:navigateNext', () => {
      if (activeCalls.length > 1) {
        currentIndex = (currentIndex + 1) % activeCalls.length;
      }
    });

    const unsubGetCurrent = onNuiEvent('dispatch:getCurrentCall', () => {
      // Toggle attach/detach for current call
      toggleAttachment();
    });

    const unsubUnitAttached = onNuiEvent<{ callId: string; unit: { citizenid: string; callsign: string; name: string } }>('dispatch:unitAttached', (data) => {
      activeCalls = activeCalls.map(call => {
        if (call.callId === data.callId) {
          return {
            ...call,
            units: [...(call.units || []), data.unit]
          };
        }
        return call;
      });
    });

    const unsubUnitDetached = onNuiEvent<{ callId: string; citizenid: string }>('dispatch:unitDetached', (data) => {
      activeCalls = activeCalls.map(call => {
        if (call.callId === data.callId) {
          return {
            ...call,
            units: (call.units || []).filter(u => u.citizenid !== data.citizenid)
          };
        }
        return call;
      });
    });

    const unsubSetupUI = onNuiEvent<{ keybind?: string; citizenid?: string }>('dispatch:setupUI', (data) => {
      if (data.keybind) {
        respondKeybind = data.keybind;
      }
      if (data.citizenid) {
        playerCitizenId = data.citizenid;
      }
    });

    // Mouse event handlers for dragging
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Keep within viewport bounds
      const maxX = window.innerWidth - 380;
      const maxY = window.innerHeight - 200;

      position = {
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      };
    };

    const handleMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        // Save position to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      clearInterval(timeInterval);
      unsubNewCall();
      unsubExpired();
      unsubHidden();
      unsubNavigatePrev();
      unsubNavigateNext();
      unsubGetCurrent();
      unsubUnitAttached();
      unsubUnitDetached();
      unsubSetupUI();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  });

  function addCall(call: DispatchCall, timer: number) {
    // Check if call already exists
    const exists = activeCalls.find(c => c.callId === call.callId);
    if (exists) return;

    // Add timestamp and expiry for tracking
    const now = Date.now();
    call.timestamp = now;
    call.expiresAt = now + timer;
    activeCalls = [call, ...activeCalls];
    currentIndex = 0; // Focus on new call

    // Auto-expire after timer
    setTimeout(() => {
      activeCalls = activeCalls.filter(c => c.callId !== call.callId);
      if (currentIndex >= activeCalls.length) {
        currentIndex = Math.max(0, activeCalls.length - 1);
      }
    }, timer);
  }

  function handleMouseDown(e: MouseEvent) {
    // Only start drag if clicking on the header area
    const target = e.target as HTMLElement;
    if (target.closest('.dispatch-header')) {
      isDragging = true;
      dragOffset = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
      e.preventDefault();
    }
  }

  function toggleAttachment() {
    const call = activeCalls[currentIndex];
    if (call) {
      const isAttached = call.units?.some(u => u.citizenid === playerCitizenId) || false;
      if (isAttached) {
        fetchNui('dispatch:detachFromCall', { callId: call.callId });
      } else {
        fetchNui('dispatch:respondToCall', {
          callId: call.callId,
          coords: call.coords
        });
      }
    }
  }

  function navigatePrev() {
    if (activeCalls.length > 1) {
      currentIndex = (currentIndex - 1 + activeCalls.length) % activeCalls.length;
    }
  }

  function navigateNext() {
    if (activeCalls.length > 1) {
      currentIndex = (currentIndex + 1) % activeCalls.length;
    }
  }

  function getTimeElapsed(timestamp?: number): string {
    if (!timestamp) return '';
    const elapsed = Math.max(0, currentTime - timestamp);
    const seconds = Math.floor(elapsed / 1000);

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // Get current call
  let currentCall = $derived(activeCalls[currentIndex]);

  // Check if player is attached to current call
  let isAttachedToCurrentCall = $derived(
    currentCall?.units?.some(u => u.citizenid === playerCitizenId) || false
  );

  // Get postal for current call
  let currentPostal = $derived(
    currentCall?.coords ? getNearestPostal(currentCall.coords.x, currentCall.coords.y) : null
  );
</script>

{#if !hidden && activeCalls.length > 0}
<div
  class="dispatch-alert-container"
  style="left: {position.x}px; top: {position.y}px;"
  onmousedown={handleMouseDown}
  role="region"
  aria-label="Dispatch Alerts"
>
  {#if currentCall}
  <div class="dispatch-card" class:dragging={isDragging}>
    <!-- Header - Draggable area -->
    <div class="dispatch-header">
      <div class="header-left">
        <span class="call-counter">{currentIndex + 1} / {activeCalls.length}</span>
      </div>
      <div class="header-center">
        <span class="call-code-header">{currentCall.code || '10-00'}</span>
      </div>
      <div class="header-right">
        <span class="call-time">{getTimeElapsed(currentCall.timestamp)}</span>
      </div>
    </div>

    <!-- Main Content -->
    <div class="dispatch-content">
      <!-- Title (codeName) -->
      <div class="call-title">{currentCall.codeName}</div>

      <!-- Description (message) -->
      <div class="call-description">{currentCall.message}</div>

      <!-- Description/Details -->
      <div class="call-details">
        <div class="detail-line">{currentCall.street}{#if currentPostal} ({currentPostal}){/if}</div>
        {#if currentCall.information}
          <div class="detail-line info">{currentCall.information}</div>
        {/if}
        {#if currentCall.units && currentCall.units.length > 0}
          <div class="detail-line units">
            Units: {getUnitCountByDept(currentCall.units)}
          </div>
        {/if}
      </div>
    </div>

    <!-- Controls -->
    <div class="dispatch-controls">
      <button class="nav-text nav-left" onclick={navigatePrev}>← Previous</button>
      <button
        class="respond-btn"
        class:detach={isAttachedToCurrentCall}
        onclick={toggleAttachment}
      >
        [{respondKeybind}] {isAttachedToCurrentCall ? 'Detach' : 'Attach'}
      </button>
      <button class="nav-text nav-right" onclick={navigateNext}>Next →</button>
    </div>
  </div>
  {/if}
</div>
{/if}

<style>
  .dispatch-alert-container {
    position: fixed;
    z-index: 9999;
    pointer-events: auto;
    user-select: none;
  }

  .dispatch-card {
    width: 18vw;
    min-width: 300px;
    max-width: 22vw;
    /* Semi-transparent MDT grey - no blur to avoid darkening */
    background: rgba(35, 35, 40, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    overflow: hidden;
    animation: slideIn 0.3s ease-out;
  }

  .dispatch-card.dragging {
    opacity: 0.9;
    cursor: grabbing;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .dispatch-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6vh 0.8vh;
    background: transparent;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    cursor: grab;
  }

  .dispatch-header:active {
    cursor: grabbing;
  }

  .header-left, .header-right {
    display: flex;
    align-items: center;
    gap: 0.4vh;
    flex: 1;
  }

  .header-left {
    justify-content: flex-start;
  }

  .header-right {
    justify-content: flex-end;
  }

  .header-center {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 2;
  }

  .call-code-header {
    font-size: 1.8vh;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
  }

  .call-counter, .call-time {
    font-size: 1.1vh;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
  }

  .dispatch-content {
    padding: 0.8vh;
    background: transparent;
  }

  .call-title {
    text-align: center;
    font-size: 1.3vh;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 0.3vh;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .call-description {
    text-align: center;
    font-size: 1.2vh;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 0.6vh;
  }

  .call-details {
    text-align: center;
  }

  .detail-line {
    font-size: 1.2vh;
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.4;
    margin-bottom: 0.3vh;
  }

  .detail-line.info {
    color: rgba(255, 255, 255, 0.5);
    font-style: italic;
  }

  .detail-line.units {
    color: #22c55e;
    font-weight: 500;
    margin-top: 0.4vh;
    padding-top: 0.4vh;
    border-top: 1px solid rgba(60, 60, 65, 0.8);
  }

  .dispatch-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4vh 0.8vh 0.8vh;
    background: transparent;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .nav-text {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 1.1vh;
    font-weight: 500;
    cursor: pointer;
    padding: 0.4vh 0.6vh;
    transition: color 0.15s ease;
    min-width: 6vh;
  }

  .nav-text.nav-left {
    text-align: left;
  }

  .nav-text.nav-right {
    text-align: right;
  }

  .nav-text:hover {
    color: rgba(255, 255, 255, 0.9);
  }

  .respond-btn {
    padding: 0.4vh 1.2vh;
    border-radius: 2px;
    font-weight: 600;
    font-size: 1.1vh;
    /* MDT primary green button style */
    background: #22c55e;
    border: none;
    color: white;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .respond-btn:hover {
    background: #16a34a;
  }

  .respond-btn.detach {
    background: #ef4444;
  }

  .respond-btn.detach:hover {
    background: #dc2626;
  }
</style>
