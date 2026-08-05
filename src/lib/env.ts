// Centralized env access. NEXT_PUBLIC_* are inlined into the client bundle;
// everything else is server-only and must never be imported into a client
// component.
export const PUBLIC_ENV = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
};

export function serverEnv() {
  return {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    EMAIL_FROM: process.env.EMAIL_FROM || 'NIAT Inside OS <onboarding@resend.dev>',
    ALLOWED_DOMAIN: process.env.ALLOWED_DOMAIN || 'nxtwave.co.in',
    ADMIN_EMAILS: (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  };
}
