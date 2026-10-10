/**
 * Browser-only Supabase Auth client.
 * Env vars VITE_* are PUBLIC and included in the JavaScript bundle.
 * NEVER place a service_role key or sb_secret_ token in these vars.
 */
import {createClient} from '@supabase/supabase-js';

export function createPlazoSupabaseClient({url,key}={}){
  const projectUrl=url ?? import.meta.env.VITE_SUPABASE_URL ?? 'https://dvqalzgyivqgnenjutub.supabase.co';
  const publicKey=key ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_5gbCvxsJQNpqwxMFFmIqsQ_OnjQmyB_';
  if(!/^https:\/\/[\w-]+\.supabase\.co$/.test(projectUrl||'')){
    throw new Error('Configura VITE_SUPABASE_URL para el proyecto de Plazo.');
  }
  if(!/^(sb_publishable_[a-zA-Z0-9_-]+|eyJ[A-Za-z0-9._-]+)$/.test(publicKey||'')){
    throw new Error('Falta una clave publicable de Supabase.');
  }
  if(publicKey.startsWith('sb_secret_'))throw new Error('No se permiten claves privadas en el navegador.');
  return createClient(projectUrl,publicKey,{
    auth:{
      autoRefreshToken:true,
      persistSession:true,
      detectSessionInUrl:true,
      flowType:'pkce',
      storageKey:'plazo-v2-supabase-auth'
    }
  });
}
