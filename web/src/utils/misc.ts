// Will return whether the current environment is in a regular browser
// and not CEF
export const isEnvBrowser = (): boolean => !window.invokeNative;

export const noop = () => {};

// Postal code lookup
interface Postal {
  code: string;
  x: number;
  y: number;
}

let postalsData: Postal[] = [];
let postalsLoaded = false;

// Load postals data
export async function loadPostals(): Promise<void> {
  if (postalsLoaded) return;
  try {
    const response = await fetch('/postals.json');
    if (response.ok) {
      postalsData = await response.json();
      postalsLoaded = true;
    }
  } catch (e) {
    console.warn('Failed to load postals.json:', e);
  }
}

// Find nearest postal code for given coordinates
export function getNearestPostal(x: number, y: number): string | null {
  if (!postalsData.length) return null;

  let nearestPostal: Postal | null = null;
  let nearestDistance = Infinity;

  for (const postal of postalsData) {
    const dx = postal.x - x;
    const dy = postal.y - y;
    const distance = dx * dx + dy * dy; // Skip sqrt for performance
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestPostal = postal;
    }
  }

  return nearestPostal?.code || null;
}
