import { ResourceContext } from './resource';

export * from './types';

export function Greetings() {
  console.log(`[eb-mdt] Started ${ResourceContext} script`);
}

export function DebugLog(message: string, level: 'info' | 'warn' | 'error' | 'trace' | 'event' | 'nui' = 'info') {
  const colors: Record<string, string> = {
    info: '^2',
    warn: '^3',
    error: '^1',
    trace: '^5',
    event: '^6',
    nui: '^4',
  };
  const color = colors[level] || '^7';
  console.log(`${color}[MDT] ${message}^0`);
}

// DNA Hash function (matches r14-evidence)
export function DnaHash(s: string): string {
  let h = '';
  for (let i = 0; i < s.length; i++) {
    h += s.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return h;
}
