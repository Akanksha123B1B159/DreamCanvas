'use client';

import React from 'react';
import { Cloud, Zap, ArrowRight, Code } from 'lucide-react';

interface ServerlessFunc {
  name: string;
  route: string;
  trigger: string;
  runtime: string;
  input: string;
  output: string;
  coldStartTimeMs: number;
  status: 'ACTIVE' | 'HOT';
  description: string;
}

export default function ServerlessCatalog() {
  const functions: ServerlessFunc[] = [
    {
      name: 'AI Career Chatbot Handler',
      route: '/api/chat',
      trigger: 'HTTP POST (Client Query)',
      runtime: 'Node.js 20 Serverless Lambda',
      input: '{ message: string, history: Message[] }',
      output: '{ reply: string, role: "assistant" }',
      coldStartTimeMs: 85,
      status: 'HOT',
      description: 'Stateless function executing Groq LLM completion prompts with career context injection.',
    },
    {
      name: 'Roadmap Generation Synthesizer',
      route: '/api/generate-roadmap',
      trigger: 'HTTP POST (Skills Form Submit)',
      runtime: 'Node.js 20 Serverless Lambda',
      input: '{ skills: string, role: string }',
      output: '{ roadmap: DayPlan[], missingSkills: string[] }',
      coldStartTimeMs: 120,
      status: 'HOT',
      description: 'Generates structured 30-day curriculum with daily actionable subtasks.',
    },
    {
      name: 'Explainable AI Job Analyzer',
      route: '/api/explain-job',
      trigger: 'HTTP POST (Job Detection Follow-up)',
      runtime: 'Node.js 20 Serverless Lambda',
      input: '{ description: string, prediction: number }',
      output: '{ explanation: string, safetyAdvice: string }',
      coldStartTimeMs: 95,
      status: 'HOT',
      description: 'Converts raw BERT+SVM numerical output into human-readable job safety explanations.',
    },
    {
      name: 'YouTube Resource Discovery',
      route: '/api/search-youtoube',
      trigger: 'HTTP POST (Subtask Click)',
      runtime: 'Edge Function (V8 isolate)',
      input: '{ query: string }',
      output: '{ videos: VideoItem[] }',
      coldStartTimeMs: 15,
      status: 'HOT',
      description: 'Fetches high-quality educational videos matching specific syllabus subtasks.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cloud className="w-5 h-5 text-purple-400" />
            Serverless Architecture & Function-as-a-Service (FaaS)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            DreamCanvas Next.js API routes deployed as event-driven, auto-scaling, ephemeral serverless micro-lambdas
          </p>
        </div>
      </div>

      {/* Function Catalog Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {functions.map((fn) => (
          <div key={fn.route} className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" /> {fn.name}
                </h4>
                <p className="text-[11px] font-mono text-cyan-400 mt-0.5">{fn.route}</p>
              </div>

              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {fn.status}
              </span>
            </div>

            <p className="text-xs text-slate-400">{fn.description}</p>

            <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Trigger:</span>
                <span className="text-slate-300">{fn.trigger}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Runtime:</span>
                <span className="text-purple-300">{fn.runtime}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Cold Start:</span>
                <span className="text-emerald-400">~{fn.coldStartTimeMs} ms</span>
              </div>
            </div>

            <div className="pt-2 text-[11px] font-mono text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
              <div className="text-slate-500 text-[10px]">Contract Schema:</div>
              <div className="text-cyan-300">In: {fn.input}</div>
              <div className="text-emerald-300">Out: {fn.output}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
