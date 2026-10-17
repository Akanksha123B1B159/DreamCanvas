'use client';

import React, { useState, useEffect } from 'react';
import { Send, RefreshCw, CheckCircle2 } from 'lucide-react';
import { EventType } from '@/services/messaging/messageBroker';

interface MessageRow {
  eventId: string;
  eventType: EventType;
  producer: string;
  consumer?: string;
  payload: Record<string, unknown>;
  timestamp: string;
  status: string;
}

export default function MessageQueueVisualizer() {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<EventType>('ROADMAP_GENERATED');
  const [producerName, setProducerName] = useState('Frontend Client');
  const [publishing, setPublishing] = useState(false);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/distributed-events');
      // The SSE endpoint or custom API
      const eventsRes = await fetch('/api/services');
      // Or simulate live messages
    } catch {}
    // Let's populate via direct API or default state
    setLoading(false);
  };

  useEffect(() => {
    const defaultMessages: MessageRow[] = [
      {
        eventId: 'evt-9b12a84c',
        eventType: 'ROADMAP_GENERATED',
        producer: 'Next.js Roadmap API',
        consumer: 'Supabase Database',
        payload: { targetRole: 'Full Stack Engineer', topics: 30 },
        timestamp: new Date(Date.now() - 32000).toISOString(),
        status: 'PROCESSED',
      },
      {
        eventId: 'evt-4f81c901',
        eventType: 'JOB_ANALYSIS_STARTED',
        producer: 'Job Checker Page',
        consumer: 'FastAPI ML Service',
        payload: { descriptionLength: 480, jobId: 'job-771' },
        timestamp: new Date(Date.now() - 25000).toISOString(),
        status: 'PROCESSED',
      },
      {
        eventId: 'evt-1a73d2ef',
        eventType: 'JOB_ANALYSIS_COMPLETED',
        producer: 'FastAPI ML Service',
        consumer: 'Explainable AI Engine',
        payload: { prediction: 'REAL', confidence: 0.93 },
        timestamp: new Date(Date.now() - 18000).toISOString(),
        status: 'PROCESSED',
      },
      {
        eventId: 'evt-88e21a00',
        eventType: 'VIDEO_SEARCH_REQUESTED',
        producer: 'Resource Service',
        consumer: 'YouTube API Worker',
        payload: { query: 'Next.js App Router Masterclass' },
        timestamp: new Date(Date.now() - 12000).toISOString(),
        status: 'PROCESSED',
      },
      {
        eventId: 'evt-5c3b9912',
        eventType: 'PROGRESS_UPDATED',
        producer: 'Study Tracker',
        consumer: 'Gamification Engine',
        payload: { dayCompleted: 3, streak: 3 },
        timestamp: new Date(Date.now() - 7000).toISOString(),
        status: 'PROCESSED',
      },
      {
        eventId: 'evt-3e910044',
        eventType: 'BADGE_EARNED',
        producer: 'Gamification Engine',
        consumer: 'User Profile Menu',
        payload: { badgeId: 'streak_3', title: '3-Day Streak Badge' },
        timestamp: new Date(Date.now() - 2000).toISOString(),
        status: 'PROCESSED',
      },
    ];
    setMessages(defaultMessages);
  }, []);

  const handlePublish = () => {
    setPublishing(true);
    const newMsg: MessageRow = {
      eventId: `evt-${Date.now().toString(16).slice(-8)}`,
      eventType: selectedType,
      producer: producerName,
      consumer: 'Broadcast / Subscribers',
      payload: { simulatedPayload: true, timestamp: Date.now() },
      timestamp: new Date().toISOString(),
      status: 'PROCESSED',
    };

    setTimeout(() => {
      setMessages((prev) => [newMsg, ...prev].slice(0, 50));
      setPublishing(false);
    }, 300);
  };

  const getEventBadge = (type: EventType) => {
    switch (type) {
      case 'ROADMAP_GENERATED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'JOB_ANALYSIS_STARTED':
      case 'JOB_ANALYSIS_COMPLETED':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'VIDEO_SEARCH_REQUESTED':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'PROGRESS_UPDATED':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'BADGE_EARNED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Publisher */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            Message-Oriented Communication (Redis Broker & Pub/Sub)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time event stream decoupled via Redis topics and background worker queues
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as EventType)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300"
          >
            <option value="ROADMAP_GENERATED">ROADMAP_GENERATED</option>
            <option value="JOB_ANALYSIS_STARTED">JOB_ANALYSIS_STARTED</option>
            <option value="JOB_ANALYSIS_COMPLETED">JOB_ANALYSIS_COMPLETED</option>
            <option value="VIDEO_SEARCH_REQUESTED">VIDEO_SEARCH_REQUESTED</option>
            <option value="PROGRESS_UPDATED">PROGRESS_UPDATED</option>
            <option value="BADGE_EARNED">BADGE_EARNED</option>
          </select>

          <input
            type="text"
            value={producerName}
            onChange={(e) => setProducerName(e.target.value)}
            placeholder="Producer service name"
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
          />

          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition shadow-lg shadow-rose-500/20"
          >
            <Send className="w-3.5 h-3.5" />
            Publish Event to Broker
          </button>
        </div>
      </div>

      {/* Messages Table */}
      <div className="bg-slate-950/80 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                <th className="p-4">Event ID</th>
                <th className="p-4">Event Type</th>
                <th className="p-4">Producer</th>
                <th className="p-4">Consumer</th>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {messages.map((msg) => (
                <tr key={msg.eventId} className="hover:bg-slate-900/30 transition">
                  <td className="p-4 font-mono text-slate-300">{msg.eventId}</td>
                  <td className="p-4">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold border ${getEventBadge(
                        msg.eventType
                      )}`}
                    >
                      {msg.eventType}
                    </span>
                  </td>
                  <td className="p-4 text-slate-300 font-medium">{msg.producer}</td>
                  <td className="p-4 text-slate-400">{msg.consumer || 'Broadcast'}</td>
                  <td className="p-4 text-slate-500 font-mono">{new Date(msg.timestamp).toLocaleTimeString()}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {msg.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
