'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const safeSupabaseUrl = supabaseUrl ?? '';
const safeSupabaseAnonKey = supabaseAnonKey ?? '';

export const isSupabaseConfigured = Boolean(safeSupabaseUrl && safeSupabaseAnonKey);

const noOpSupabase = {
	auth: {
		signInWithPassword: async () => ({
			data: { user: null, session: null },
			error: new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the project .env file, then restart the app.'),
		}),
		getUser: async () => ({
			data: { user: null },
			error: new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the project .env file, then restart the app.'),
		}),
		getSession: async () => ({
			data: { session: null },
			error: new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the project .env file, then restart the app.'),
		}),
		onAuthStateChange: () => ({
			data: { subscription: { unsubscribe: () => undefined } },
			error: null,
		}),
		signOut: async () => ({ error: null }),
	},
	from: () => ({
		select: () => ({
			eq: () => ({
				limit: () => ({
					maybeSingle: async () => ({ data: null, error: null }),
				}),
			}),
		}),
	}),
} as unknown as SupabaseClient;

let authLockTail = Promise.resolve();

const authLock = async <Result>(
	_name: string,
	_timeout: number,
	operation: () => Promise<Result>,
) => {
	const previous = authLockTail;
	let release!: () => void;
	authLockTail = new Promise<void>((resolve) => {
		release = resolve;
	});
	await previous;
	try {
		return await operation();
	} finally {
		release();
	}
};

export const supabase: SupabaseClient = isSupabaseConfigured
	? createClient(safeSupabaseUrl, safeSupabaseAnonKey, {
			auth: {
				persistSession: true,
				autoRefreshToken: true,
				detectSessionInUrl: true,
				lock: authLock,
			},
		})
	: noOpSupabase;
