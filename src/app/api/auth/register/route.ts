// src/app/api/auth/register/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  isValidRegistrationEmail,
  isValidRegistrationName,
  isValidRegistrationPassword,
} from '@/app/_libs/registrationPolicy';
import { consumeRegistrationAttempt } from '@/app/_libs/registrationRateLimit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    let rateLimit: Awaited<ReturnType<typeof consumeRegistrationAttempt>>;
    try {
      rateLimit = await consumeRegistrationAttempt(req);
    } catch {
      console.error('Registration rate limiter is unavailable.');
      return NextResponse.json(
        { error: 'Registration is temporarily unavailable. Please try again later.' },
        { status: 503 },
      );
    }
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Registration is temporarily unavailable. Please try again later.' },
        { status: 503 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request. Please submit the registration form again.' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid registration details. Please check the form and try again.' }, { status: 400 });
    }

    const values = body as Record<string, unknown>;
    const emailInput = values.email;
    const password = values.password;
    const fullNameInput = values.full_name;
    if (typeof emailInput !== 'string' || typeof password !== 'string' || typeof fullNameInput !== 'string') {
      return NextResponse.json({ error: 'Full name, email, and password are required.' }, { status: 400 });
    }

    const email = emailInput.trim().toLowerCase();
    const fullName = fullNameInput.trim();
    if (!isValidRegistrationEmail(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (!isValidRegistrationName(fullName)) {
      return NextResponse.json({ error: 'Please enter a name between 1 and 100 characters.' }, { status: 400 });
    }
    if (!isValidRegistrationPassword(password)) {
      return NextResponse.json({ error: 'Password must be at least 12 characters long.' }, { status: 400 });
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
      const duplicateAccount =
        signUpError.code === 'user_already_exists' ||
        signUpError.code === 'email_exists' ||
        /user already registered|email already registered/i.test(signUpError.message);
      if (duplicateAccount) {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json(
        { error: 'We could not complete registration with those details. Please try again or log in.' },
        { status: 400 },
      );
    }
    const user = signUpData.user;

    if (user && user.identities?.length !== 0) {
      const { error: insertError } = await supabase
        .from('users')
        .upsert(
          { id: user.id, email, full_name: fullName },
          { onConflict: 'id', ignoreDuplicates: true },
        );

      if (insertError) {
        console.warn('Account created; optional profile details could not be saved.');
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    console.error('Registration request could not be completed.');
    return NextResponse.json(
      { error: 'Registration could not be completed. Please try again later.' },
      { status: 500 },
    );
  }
}
