import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

const isValidUrl = (url: string) => {
  try {
    return url && (url.startsWith('http://') || url.startsWith('https://'));
  } catch {
    return false;
  }
};

if (!isValidUrl(supabaseUrl) || !supabaseAnonKey || supabaseUrl.includes('your_project_url_here')) {
  console.warn('Supabase URL or Anon Key is missing or invalid! Please check your .env file.');
}

// Create a client ONLY if the URL is valid to prevent top-level crashes.
// If invalid, we'll export a dummy client that will fail on actual calls but won't crash the app start.
export const supabase = (() => {
  const isValidUrl = (url: string) => url && (url.startsWith('http://') || url.startsWith('https://')) && !url.includes('your_project_url_here');
  
  if (isValidUrl(supabaseUrl) && supabaseAnonKey) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }

  console.warn('Supabase URL or Anon Key is missing or invalid! Please check your .env file.');
  
  const mock: any = {
    from: () => mock,
    select: () => mock,
    single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
    eq: () => mock,
    on: () => mock,
    subscribe: () => ({ unsubscribe: () => {} }),
    channel: () => mock,
    storage: { 
      from: () => ({ 
        upload: () => Promise.resolve({ error: new Error('Supabase not configured') }), 
        getPublicUrl: () => ({ data: { publicUrl: '' } }) 
      }) 
    },
    // Add then to make it thenable
    then: (resolve: any) => resolve({ data: null, error: new Error('Supabase not configured') })
  };
  return mock;
})();
