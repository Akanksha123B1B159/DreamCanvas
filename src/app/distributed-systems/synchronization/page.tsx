'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SynchronizationRoutePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <main className="min-h-screen bg-[#0a0d14] text-white flex items-center justify-center px-6">
      <div className="text-center space-y-3">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Feature removed</p>
        <h1 className="text-3xl font-bold text-white">The Distributed Lab has been removed.</h1>
        <p className="text-slate-400">You are being redirected to the main DreamCanvas home page.</p>
      </div>
    </main>
  );
}
