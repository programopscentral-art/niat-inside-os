'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/browser';
import { Loader2, ShieldCheck, Zap, Users2, Ticket } from 'lucide-react';

export default function SignInPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowser();
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next') || '/dashboard';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { hd: 'nxtwave.co.in', prompt: 'select_account', access_type: 'offline' }
      }
    });
    if (error) { setError(error.message); setLoading(false); }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — brand hero */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 -z-10"
          style={{ background: 'radial-gradient(600px 400px at 20% 20%, hsl(var(--primary)/0.25), transparent 60%), radial-gradient(500px 500px at 80% 80%, hsl(var(--accent)/0.22), transparent 60%)' }} />
        <div className="text-2xl font-extrabold gradient-text">NIAT Inside OS</div>
        <div className="max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight">
            Every team. Every task. <span className="gradient-text">One source of truth.</span>
          </h1>
          <p className="mt-4 text-fg-muted">
            Assign work, raise tickets, tag people across teams, track progress and deadlines —
            with database-level isolation so each team sees only its own work.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {[
              { icon: ShieldCheck, t: 'Team isolation', d: 'Enforced by the database' },
              { icon: Ticket, t: 'Smart tickets', d: 'Auto-tagged per team' },
              { icon: Users2, t: 'Role permissions', d: 'Granted by managers' },
              { icon: Zap, t: 'Realtime', d: 'Live boards & alerts' }
            ].map((f) => (
              <div key={f.t} className="card p-4">
                <f.icon className="h-5 w-5 text-primary" />
                <div className="mt-2 text-sm font-semibold">{f.t}</div>
                <div className="text-xs text-fg-muted">{f.d}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs text-fg-muted">Secured for @nxtwave.co.in accounts only.</div>
      </div>

      {/* Right — sign in */}
      <div className="flex items-center justify-center p-6">
        <div className="card shadow-soft w-full max-w-sm p-8">
          <div className="lg:hidden text-xl font-extrabold gradient-text mb-6">NIAT Inside OS</div>
          <h2 className="text-xl font-bold">Welcome back</h2>
          <p className="mt-1 text-sm text-fg-muted">Sign in with your NxtWave account to continue.</p>

          <button onClick={signIn} disabled={loading}
            className="btn btn-outline w-full mt-6 py-2.5 font-medium">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </button>

          {error && <p className="mt-3 text-sm text-danger">{error}</p>}

          <p className="mt-6 text-xs text-fg-muted leading-relaxed">
            Only <b>@nxtwave.co.in</b> accounts can access this workspace. Access outside the
            domain is blocked automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"/>
    </svg>
  );
}
