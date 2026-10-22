import type { Product, SiteConfig } from '../types';

// Structural defaults only: never insert sample products, photos or contact data.
export const EMPTY_CONFIG: SiteConfig = {
  hero: { banners: [] },
  header: { logoRed: '', logoWhite: '', phone: '' },
  footer: {
    aboutEn: '', aboutAr: '', facebook: '', instagram: '', tiktok: '',
    locationUrl: '', addressEn: '', addressAr: '', copyrightEn: '', copyrightAr: '',
  },
  layout: [], tags: [], areas: [], theme: { primaryColor: '#E4002B' },
};

export function normalizeStorefront(menu: Product[], settings: Partial<SiteConfig>) {
  const layout = Array.isArray(settings.layout) ? [...settings.layout] : [];
  // An item must remain visible even if its category was not added to the builder.
  for (const item of menu) {
    if (item.category && !layout.some(category => category.id === item.category)) {
      layout.push({ id: item.category, nameEn: item.category, nameAr: item.category });
    }
  }
  const config: SiteConfig = {
    ...EMPTY_CONFIG, ...settings,
    hero: { banners: Array.isArray(settings.hero?.banners) ? settings.hero.banners : [] },
    header: { ...EMPTY_CONFIG.header, ...settings.header },
    footer: { ...EMPTY_CONFIG.footer, ...settings.footer },
    theme: { ...EMPTY_CONFIG.theme, ...settings.theme },
    layout,
    tags: Array.isArray(settings.tags) ? settings.tags : [],
    areas: Array.isArray(settings.areas) ? settings.areas : [],
  };
  return { menu, config };
}

export async function loadStorefront(client: any, timeoutMs = 15000) {
  let timeout: ReturnType<typeof setTimeout>;
  try {
    const [menuResult, settingsResult] = await Promise.race([
      Promise.all([
        client.from('menu_items').select('*').order('created_at', { ascending: true }),
        client.from('site_settings').select('config_data').eq('id', 'active_config').maybeSingle(),
      ]),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Storefront request timed out')), timeoutMs);
      }),
    ]);
    if (menuResult.error) throw menuResult.error;
    if (settingsResult.error) throw settingsResult.error;
    if (!Array.isArray(menuResult.data)) throw new Error('Menu response is unavailable');
    const settings = settingsResult.data?.config_data;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      throw new Error('Site settings are unavailable');
    }
    // An empty database menu is valid and must clear products from earlier fetches.
    return normalizeStorefront(menuResult.data, settings);
  } finally {
    clearTimeout(timeout!);
  }
}
