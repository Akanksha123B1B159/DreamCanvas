// src/app/api/auth/register/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    let body: { email?: string; password?: string; full_name?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request. Please submit the registration form again.' }, { status: 400 });
    }

    const email = body.email?.trim();
    const password = body.password;
    const fullName = body.full_name?.trim();
    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'Full name, email, and password are required.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(signUpError.message)) {
        return NextResponse.json(
          {
            error: 'DreamCanvas cannot reach Supabase. The Supabase project URL in .env is not resolving. Copy the Project URL from your active Supabase project (Settings → API), update NEXT_PUBLIC_SUPABASE_URL, then restart the app.',
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: signUpError.message }, { status: 400 });
    }
    const user = signUpData.user;
    let profileWarning: string | undefined;

    if (user) {
      const { error: insertError } = await supabase
        .from('users')
        .upsert(
          { id: user.id, email, full_name: fullName },
          { onConflict: 'id', ignoreDuplicates: true },
        );

      if (insertError) {
        console.warn('Account created; optional profile row was not saved:', insertError.message);
        profileWarning = 'Your account was created, but profile details could not be saved. You can still sign in.';
      }
    }

    return NextResponse.json({ success: true, user, profileWarning });

  } catch (err) {
    console.error('Registration error:', err);
    const errorText = err instanceof Error ? `${err.message} ${String(err.cause ?? '')}` : String(err);
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(errorText)) {
      return NextResponse.json(
        {
          error: 'DreamCanvas cannot reach Supabase. Check that NEXT_PUBLIC_SUPABASE_URL is copied exactly from your active Supabase project, and verify your internet connection.',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: 'Registration could not be completed. Please check your Supabase configuration and try again.' }, { status: 500 });
  }
}
