import type { SiteConfig } from '../types';

export type ConfigSaveStatus = 'dirty' | 'saving' | 'saved' | 'error';

export function upsertConfigEntry<T extends { id: string }>(items: T[], entry: T): T[] {
  return items.some(item => item.id === entry.id)
    ? items.map(item => item.id === entry.id ? entry : item)
    : [...items, entry];
}

// Keep full configuration writes in input order. A later snapshot contains the
// earlier edits, so only the latest attempt controls the displayed save status.
export function createAdminConfigSaver(client: any, { onDraft, onStatus, onSaved, onBusy }: {
  onDraft: (config: SiteConfig) => void;
  onStatus: (status: ConfigSaveStatus) => void;
  onSaved?: (config: SiteConfig) => void;
  onBusy?: (busy: boolean) => void;
}) {
  let queue: Promise<unknown> = Promise.resolve();
  let version = 0;
  let latest: SiteConfig | undefined;
  let pending = 0;
  const stage = (config: SiteConfig) => {
    latest = config;
    version++;
    onDraft(config);
    onStatus('dirty');
  };
  const save = (config: SiteConfig): Promise<boolean> => {
    latest = config;
    const attempt = ++version;
    onDraft(config);
    onStatus('saving');
    pending++;
    onBusy?.(true);
    const result = queue.then(async () => {
      try {
        const { error } = await client.rpc('save_chicky_config', { p_config: config });
        if (error) throw error;
        if (attempt === version) { onDraft(config); onSaved?.(config); onStatus('saved'); }
        return true;
      } catch {
        if (attempt === version) onStatus('error');
        return false;
      } finally {
        pending--;
        onBusy?.(pending > 0);
      }
    });
    queue = result;
    return result;
  };
  return { stage, save, isSaving: () => pending > 0, retry: () => latest ? save(latest) : Promise.resolve(false) };
}
