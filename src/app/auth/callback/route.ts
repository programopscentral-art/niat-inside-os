import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/dashboard';
  const errorDesc = searchParams.get('error_description');

  if (errorDesc) {
    return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(errorDesc)}`);
  }

  if (code) {
    let res = NextResponse.redirect(`${origin}${next}`);
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
          }
        }
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // Domain-lock trigger rejects non-nxtwave.co.in users here.
      return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(error.message)}`);
    }
    return res;
  }

  return NextResponse.redirect(`${origin}/sign-in`);
}
