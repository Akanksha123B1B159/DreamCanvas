'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/app/_libs/supabaseClient';
import DownloadPDFButton from '@/app/components/DownloadPDFButton';
import { motion } from 'framer-motion';
import { FaRegCalendarCheck } from 'react-icons/fa';
import { browserLamportClock } from '@/services/synchronization/lamportLogicalClock';
import { reportRoadmapWorkflowEvent } from '@/services/synchronization/roadmapWorkflowEvents';

interface DayPlan {
  day: number;
  topic: string;
  subtasks: string[];
}

export default function RoadmapPage() {
  const [roadmap, setRoadmap] = useState<DayPlan[]>([]);
  const [missingSkills, setMissingSkills] = useState<string[]>([]);
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasSaved, setHasSaved] = useState(false);
  const [correlationId, setCorrelationId] = useState('');

  const router = useRouter();

  // Function to save the target role to the users table
  const saveTargetRoleToUsers = useCallback(async (userId: string, role: string) => {
    const { error } = await supabase
      .from('users')
      .update({ target: role })
      .eq('id', userId);

    if (error) {
      console.error('❌ Failed to update user target:', error.message);
    } else {
      console.log('✅ User target role updated successfully');
    }
  }, []);

  // Function to save the roadmap to Supabase
  const saveRoadmapToSupabase = useCallback(
    async (roadmapToSave: DayPlan[], targetRole: string) => {
      const correlationId = localStorage.getItem('roadmapCorrelationId') || crypto.randomUUID();
      localStorage.setItem('roadmapCorrelationId', correlationId);
      const previousTimestamp = Number(localStorage.getItem('roadmapLamportTimestamp'));
      if (Number.isSafeInteger(previousTimestamp) && previousTimestamp >= 0) {
        browserLamportClock.receiveMessage(previousTimestamp);
      }

      const reportFailure = async (message: string) => {
        try {
          await reportRoadmapWorkflowEvent(correlationId, 'LEARNING_PLAN_FAILED', message);
        } catch (eventError) {
          console.error('❌ Failed to record roadmap save failure:', eventError);
        }
      };

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        const message = userError?.message || 'User not logged in';
        console.error('❌ Failed to get user:', message);
        await reportFailure(message);
        return false;
      }

      console.log("✅ User ID:", user.id);

      await saveTargetRoleToUsers(user.id, targetRole);

      const formatted = roadmapToSave.map(item => ({
        user_id: user.id,
        day: item.day,
        topic: item.topic,
        subtasks: item.subtasks,
      }));

      const { error } = await supabase
        .from("roadmap")
        .upsert(formatted, {
          onConflict: 'user_id,day',
        });

      if (error) {
        console.error("❌ Upsert error:", error.message);
        await reportFailure(error.message);
        return false;
      } else {
        console.log("🎉 Roadmap saved (upserted) successfully");
        try {
          await reportRoadmapWorkflowEvent(correlationId, 'LEARNING_PLAN_SAVED');
        } catch (eventError) {
          console.error('❌ Roadmap saved, but its distributed event could not be recorded:', eventError);
        }
        localStorage.setItem('hasSavedRoadmap', 'true');
        return true;
      }
    },
    [saveTargetRoleToUsers]
  );

  // useEffect hook to check authentication and load roadmap data
  useEffect(() => {
    const checkAuthAndLoad = async () => {
      const storedCorrelationId = localStorage.getItem('roadmapCorrelationId') || '';
      setCorrelationId(storedCorrelationId);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Step 1: Fetch user's target role
      let userRole = '';
      const { data: userData, error: userDataError } = await supabase
        .from('users')
        .select('target')
        .eq('id', user.id)
        .single();

      if (!userDataError && userData?.target) {
        userRole = userData.target;
        setRole(userRole);
      }

      // Step 2: Try to fetch roadmap from Supabase
      const { data: existingRoadmap, error: roadmapError } = await supabase
        .from('roadmap')
        .select('day, topic, subtasks')
        .eq('user_id', user.id)
        .order('day');

      if (roadmapError) {
        console.error('❌ Failed to fetch roadmap:', roadmapError.message);
      }

      const stored = localStorage.getItem('roadmap');
      const parsed = stored ? JSON.parse(stored) : null;
      const hasPendingGeneratedPlan = Boolean(localStorage.getItem('roadmapCorrelationId'))
        && localStorage.getItem('hasSavedRoadmap') !== 'true';

      if (existingRoadmap && existingRoadmap.length > 0 && !hasPendingGeneratedPlan) {
        // Roadmap found → use it
        setRoadmap(existingRoadmap as DayPlan[]);
        console.log('📥 Loaded existing roadmap from Supabase');
      } else if (parsed) {
        // Roadmap not found → fallback to localStorage
        const localTarget = localStorage.getItem('targetRole');
        const target = userRole || localTarget || '';
        setRoadmap(parsed);
        const saved = await saveRoadmapToSupabase(parsed, target);
        setHasSaved(saved);
        if (saved) console.log('📤 Saved roadmap from localStorage to Supabase');
      } else if (existingRoadmap && existingRoadmap.length > 0) {
        setRoadmap(existingRoadmap as DayPlan[]);
      }

      // Step 3: Load skills
      const skills = localStorage.getItem('missingSkills');
      if (skills) setMissingSkills(JSON.parse(skills));

      // fallback role if user had none in DB
      if (!userRole) {
        const fallbackRole = localStorage.getItem('targetRole');
        if (fallbackRole) setRole(fallbackRole);
      }

      setLoading(false);
    };

    checkAuthAndLoad();
  }, [router, saveRoadmapToSupabase]); // ✅ don't include hasSaved

  if (loading) return <div className="text-white p-6">Loading your roadmap...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 text-white animate-fade-in">
      <h1 className="text-3xl font-bold mb-4 text-emerald-400 animate-fade-in-up">
        Your Roadmap to Become a {role}
      </h1>

      {correlationId && (
        <div className="mb-5 flex flex-col gap-2 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Request / correlation ID</p>
            <code className="mt-1 block break-all text-xs text-slate-300">{correlationId}</code>
          </div>
          <Link href={`/distributed-monitor?requestId=${encodeURIComponent(correlationId)}`} className="shrink-0 text-sm font-semibold text-cyan-300 hover:text-cyan-200 hover:underline">
            View Lamport timeline →
          </Link>
        </div>
      )}

      {/* display the missing skills */}
      <p className="mb-6 text-lg text-gray-300 animate-fade-in-up delay-100">
        <strong className="text-white">Skills to Learn:</strong>{' '}
        {missingSkills.length > 0 ? missingSkills.join(', ') : 'None'}
      </p>

      <DownloadPDFButton targetId="roadmap-to-print" />

      {/* ✅ moved the saved roadmap message to render section */}
      {hasSaved && (
        <div className="text-emerald-400 text-sm mt-2">
          ✅ Your roadmap has been saved!
        </div>
      )}

      {/* loop through the roadmap and display each day's topics and subtopics */}
      <div
        id="roadmap-to-print"
        className="relative border-l-4 border-emerald-500/40 pl-6 mt-10 space-y-10"
      >
        {roadmap.map((item, index) => (
          <motion.div
            key={item.day}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative bg-[#161b22] rounded-xl p-6 shadow-xl hover:shadow-emerald-500/20 transition-transform hover:-translate-y-1"
          >
            <div className="absolute -left-[30px] top-6 flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg">
              <FaRegCalendarCheck />
            </div>

            <h2 className="text-xl font-bold text-emerald-400 mb-2">
              Day {item.day}: <span className="text-white">{item.topic}</span>
            </h2>

            <ul className="list-disc pl-5 space-y-2 text-gray-300 text-sm">
              {item.subtasks.map((task, idx) => (
                <li key={idx} className="hover:text-white transition">
                  {task}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
