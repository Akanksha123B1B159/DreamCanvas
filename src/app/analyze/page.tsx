'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/_libs/supabaseClient';
import Loader from '@/app/components/Loader';
import RoleSelector from '@/app/components/RoleSelector';
import '@/app/components/inputfield.css';
import { browserLamportClock } from '@/services/synchronization/lamportLogicalClock';
import {
  persistRoadmapWorkflowEvents,
  reportRoadmapWorkflowEvent,
} from '@/services/synchronization/roadmapWorkflowEvents';

export default function AnalyzePage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [skills, setSkills] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [queued, setQueued] = useState(false);
  const [queueStatus, setQueueStatus] = useState('');

  // ✅ Auth check with onAuthStateChange
  useEffect(() => {
    const checkSession = async () => {
      // Get the current session from Supabase
      const { data } = await supabase.auth.getSession();
      // If session exists, user is authenticated
      // If not, redirect to login page
      if (data.session) {
        setCheckingAuth(false);
      } else {
        router.replace('/login');
      }
    };
// Call the checkSession function to verify authentication status
    checkSession();
// Subscribe to auth state changes
    // This will handle cases where the user logs in or out while on this page
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setCheckingAuth(false);
      } else {
        router.replace('/login');
      }
    });
// Cleanup the listener when the component unmounts
    // This prevents memory leaks and ensures we don't have multiple listeners active
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [router]);
  // ✅ Handle form submission

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skills || !role) return alert("Please fill in all fields");

    setLoading(true);
    const correlationId = crypto.randomUUID();
    const requestTimestamp = browserLamportClock.sendMessage();
    let responseReceived = false;
    try {
      const res = await fetch('/api/generate-roadmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId,
          'x-lamport-timestamp': String(requestTimestamp),
          'x-lamport-process': 'dreamcanvas-browser',
          'x-lamport-event': 'LEARNING_PLAN_REQUESTED',
        },
        body: JSON.stringify({ skills, role }),
      });
      responseReceived = true;
      const responseTimestamp = Number(res.headers.get('x-lamport-timestamp'));
      if (Number.isSafeInteger(responseTimestamp) && responseTimestamp >= 0) {
        browserLamportClock.receiveMessage(responseTimestamp);
      }
      const data = await res.json();
      persistRoadmapWorkflowEvents(data.events);
      if (!res.ok || data.error) throw new Error(data.error || 'Roadmap generation failed.');
      if (!data.roadmap) throw new Error('Invalid response.');

      localStorage.setItem('roadmap', JSON.stringify(data.roadmap));
      localStorage.setItem('missingSkills', JSON.stringify(data.missingSkills));
      localStorage.setItem('targetRole', role);
      localStorage.setItem('roadmapCorrelationId', correlationId);
      localStorage.setItem('roadmapLamportTimestamp', String(data.logicalTimestamp ?? requestTimestamp));
      localStorage.removeItem('hasSavedRoadmap'); // ✅ Force re-saving in roadmap page

      router.push('/roadmap');
    } catch (err: unknown) {
      console.error('Roadmap error:', err);
      if (!responseReceived) {
        try {
          await reportRoadmapWorkflowEvent(
            correlationId,
            'LEARNING_PLAN_FAILED',
            err instanceof Error ? err.message : 'Roadmap request could not reach the API.',
          );
        } catch (eventError) {
          console.error('Failed to record roadmap request failure:', eventError);
        }
      }
      alert(err instanceof Error ? err.message : 'Error generating roadmap');
    } finally {
      setLoading(false);
    }
  };

  const handleQueuedSubmit = async () => {
    if (!skills || !role) return alert('Please fill in all fields');
    setQueued(true);
    setQueueStatus('Roadmap request received');
    const correlationId = crypto.randomUUID();
    const requestTimestamp = browserLamportClock.sendMessage();
    let responseReceived = false;
    try {
      const response = await fetch('/api/roadmap-jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId,
          'x-lamport-timestamp': String(requestTimestamp),
          'x-lamport-process': 'dreamcanvas-browser',
          'x-lamport-event': 'LEARNING_PLAN_REQUESTED',
        },
        body: JSON.stringify({ skills, role }),
      });
      responseReceived = true;
      const responseTimestamp = Number(response.headers.get('x-lamport-timestamp'));
      if (Number.isSafeInteger(responseTimestamp) && responseTimestamp >= 0) {
        browserLamportClock.receiveMessage(responseTimestamp);
      }
      const job = await response.json();
      persistRoadmapWorkflowEvents(job.events);
      if (!response.ok) throw new Error(job.error || 'Could not create queued job');
      const started = Date.now();
      let status = job;
      while (status.status !== 'COMPLETED' && status.status !== 'FAILED' && Date.now() - started < 120000) {
        setQueueStatus(status.status === 'RUNNING' ? 'Generating roadmap' : 'Waiting for worker');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const statusResponse = await fetch(`/api/roadmap-jobs?jobId=${job.jobId}`);
        const statusTimestamp = Number(statusResponse.headers.get('x-lamport-timestamp'));
        if (Number.isSafeInteger(statusTimestamp) && statusTimestamp >= 0) {
          browserLamportClock.receiveMessage(statusTimestamp);
        }
        if (!statusResponse.ok) throw new Error('Could not retrieve queued roadmap status.');
        status = await statusResponse.json();
      }
      if (status.status !== 'COMPLETED') throw new Error(status.error || 'Queued roadmap did not complete');
      const result = status.result;
      localStorage.setItem('roadmap', JSON.stringify(result.roadmap));
      localStorage.setItem('missingSkills', JSON.stringify(result.missingSkills));
      localStorage.setItem('targetRole', role);
      localStorage.setItem('roadmapCorrelationId', job.correlationId || correlationId);
      localStorage.setItem('roadmapLamportTimestamp', String(status.logicalTimestamp ?? job.logicalTimestamp ?? requestTimestamp));
      localStorage.removeItem('hasSavedRoadmap');
      setQueueStatus('Roadmap completed');
      router.push('/roadmap');
    } catch (error) {
      if (!responseReceived) {
        try {
          await reportRoadmapWorkflowEvent(
            correlationId,
            'LEARNING_PLAN_FAILED',
            error instanceof Error ? error.message : 'Queued roadmap request could not reach the API.',
          );
        } catch (eventError) {
          console.error('Failed to record queued roadmap failure:', eventError);
        }
      }
      alert(error instanceof Error ? error.message : 'Queued roadmap failed');
    } finally {
      setQueued(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 mt-10 bg-[#0d1117] text-white rounded-2xl shadow-lg border border-gray-800 animate-fade-in">
      <h1 className="text-3xl font-bold text-center mb-4 animate-fade-in-up">AI Skill Gap Analyzer</h1>
      <p className="text-center mb-6 text-gray-400 animate-fade-in-up delay-100">Find missing skills and get your roadmap</p>

      <div className="text-right mb-4">
        <button
          className="text-sm text-emerald-400 hover:underline"
          onClick={async () => {
            await supabase.auth.signOut();
            router.push('/login');
          }}
        >
          Logout
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center mt-10 animate-pulse">
          <Loader />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in-up">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Your Current Skills</label>
            <textarea
              rows={4}
              placeholder="e.g., HTML, CSS, JavaScript, React"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="w-full p-4 rounded-xl bg-[#161b22] border border-gray-700 placeholder-gray-500 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
            />
          </div>

          <RoleSelector value={role} onChange={setRole} />

          {role && <p className="text-sm text-gray-400">Selected Role: <strong className="text-emerald-400">{role}</strong></p>}

          <button
            type="button"
            onClick={() => {
              setSkills('Linux, Docker, Git, basic networking, and introductory cloud knowledge');
              setRole('DevOps Engineer');
            }}
            className="text-sm text-cyan-300 hover:text-cyan-200 hover:underline"
          >
            Load DevOps Engineer Lamport-clock demo
          </button>

          <button
            type="submit"
            disabled={loading}
            className={`transition-all duration-500 hover:shadow-[0_15px_50px_-15px_#13b6da] p-[12px] rounded-[24px] flex items-center gap-4 bg-gradient-to-r from-[#2891c5] to-[#13b6da] transform hover:scale-105 active:scale-95 ${
              loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            <svg className="h-10 w-10 bg-[#0a0a0a] shadow-xl rounded-full p-2" viewBox="0 0 24 24" fill="none">
              <path fillRule="evenodd" clipRule="evenodd"
                d="M15.003 14H3.5v-4h11.502l-4.165-4.538 2.705-2.947 7.353 8.012c.747.813.747 2.133 0 2.947l-7.353 8.011-2.705-2.947L15.003 14z"
                fill="#F0F0F0" />
            </svg>
            <span className="text-[1.2rem] font-semibold text-white pr-3 tracking-wide">
              {loading ? 'Generating...' : 'Generate Roadmap'}
            </span>
          </button>
          <button type="button" onClick={handleQueuedSubmit} disabled={queued || loading} className="rounded-xl border border-cyan-500/40 px-4 py-3 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50">
            {queued ? `${queueStatus}...` : 'Generate through Redis worker'}
          </button>
        </form>
      )}
    </div>
  );
}
