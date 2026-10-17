'use client';

import React, { useState } from 'react';
import { Cloud, CheckCircle2, Info, Layers, Network, Server } from 'lucide-react';

interface CaseStudy {
  id: string;
  name: string;
  type: 'Implemented in DreamCanvas' | 'Conceptual Case Study';
  problemSolved: string;
  distributedConcept: string;
  mainComponents: string[];
  whyRequired: string;
  advantages: string[];
  limitations: string[];
}

export default function CloudCaseStudies() {
  const [activeTab, setActiveTab] = useState('k8s');

  const studies: Record<string, CaseStudy> = {
    k8s: {
      id: 'k8s',
      name: 'Kubernetes Container Orchestration',
      type: 'Implemented in DreamCanvas',
      problemSolved:
        'Managing lifecycle, scaling, and fault self-healing of distributed microservices across multiple physical or virtual hosts.',
      distributedConcept: 'Declarative State Reconciliation & Cluster Scheduling (Raft Etcd, Kubelet, Controllers).',
      mainComponents: [
        'Control Plane (API Server, Controller Manager, Scheduler, Etcd)',
        'Worker Nodes (Kubelet, Kube-Proxy, Container Runtime)',
        'Pods, Deployments, Services, ConfigMaps, Secrets',
      ],
      whyRequired:
        'Prevents single-point-of-failure; enables auto-scaling when student traffic surges during placement seasons; isolates dependencies.',
      advantages: [
        'Automated rollouts and rollbacks',
        'Self-healing (auto-restarts failed ML/Redis containers)',
        'Horizontal Pod Autoscaling (HPA)',
      ],
      limitations: [
        'Steep operational learning curve',
        'Resource overhead for small edge clusters',
        'Storage management complexity for stateful databases',
      ],
    },
    aws: {
      id: 'aws',
      name: 'Amazon Web Services (AWS Global Infrastructure)',
      type: 'Conceptual Case Study',
      problemSolved:
        'Global elastic computing, distributed storage, and multi-region disaster recovery for enterprise applications.',
      distributedConcept: 'Geographically Distributed Data Centers, Regions & Availability Zones connected via private fiber.',
      mainComponents: [
        'Compute (EC2, ECS, Lambda FaaS)',
        'Storage (S3 Distributed Object Store, EBS Block Store)',
        'Networking (VPC, Route 53 Anycast DNS, CloudFront CDN)',
      ],
      whyRequired:
        'Ensures low latency for users worldwide and resilience against natural disasters knocking out regional facilities.',
      advantages: [
        'Infinite elasticity and pay-as-you-go pricing',
        'Global low-latency edge presence',
        'Comprehensive managed distributed database ecosystem',
      ],
      limitations: [
        'Vendor lock-in with proprietary APIs',
        'Egress bandwidth costs at petabyte scale',
        'Complex IAM security permission models',
      ],
    },
    cloudflare: {
      id: 'cloudflare',
      name: 'Cloudflare Global Anycast & Edge Workers',
      type: 'Conceptual Case Study',
      problemSolved:
        'DDoS protection, TLS termination, and running edge serverless compute within 50ms of 95% of the world’s population.',
      distributedConcept: 'Anycast BGP Routing & Distributed V8 WebAssembly Worker Isolates.',
      mainComponents: [
        'Anycast DNS Network (Single IP routed to closest data center)',
        'Cloudflare Workers (Lightweight V8 isolate edge runtime)',
        'Workers KV & Durable Objects (Distributed consensus storage)',
      ],
      whyRequired:
        'Shields backend origin servers from malicious volume spikes while serving static assets and caching API responses at the network edge.',
      advantages: [
        'Near-zero cold start times (<5ms)',
        'Automatic Anycast load balancing',
        'Built-in massive DDoS absorption capacity',
      ],
      limitations: [
        'Limited execution memory per isolate',
        'Restricted to lightweight JavaScript/WASM runtimes',
        'Eventual consistency in edge KV stores',
      ],
    },
    megaport: {
      id: 'megaport',
      name: 'Megaport (Network-as-a-Service & Multi-Cloud Interconnect)',
      type: 'Conceptual Case Study',
      problemSolved:
        'Private, low-latency, software-defined interconnection between disparate public cloud providers and enterprise data centers.',
      distributedConcept: 'Software-Defined Networking (SDN) & Virtual Cross-Connect Fabric bypassing the public internet.',
      mainComponents: [
        'Megaport Cloud Router (MCR - Virtual BGP router)',
        'Virtual Cross Connects (VXC)',
        'Megaport Software Defined Network Fabric',
      ],
      whyRequired:
        'Enterprise distributed architectures split workloads across clouds (e.g. AWS ML + Azure Active Directory); Megaport bridges them privately.',
      advantages: [
        'Predictable latency without public internet jitter',
        'Enhanced data security (traffic never touches public WAN)',
        'Rapid on-demand provisioning in minutes',
      ],
      limitations: [
        'Requires physical data center presence or direct cloud provider endpoints',
        'High recurring enterprise connectivity costs',
      ],
    },
    hadoop: {
      id: 'hadoop',
      name: 'Apache Hadoop & HDFS Cluster',
      type: 'Conceptual Case Study',
      problemSolved:
        'Reliable, scalable batch computation across thousands of commodity hardware servers storing petabytes of unstructured data.',
      distributedConcept: 'Moving computation to data rather than data to computation; MapReduce parallelism.',
      mainComponents: [
        'Hadoop Distributed File System (HDFS - NameNode & DataNodes)',
        'YARN (Yet Another Resource Negotiator - ResourceManager)',
        'MapReduce Execution Framework',
      ],
      whyRequired:
        'Single machines cannot process massive datasets like global web crawl indices or multi-terabyte job posting archives.',
      advantages: [
        'Cost-effective on commodity hardware',
        'High fault tolerance with automatic block replication (3x)',
        'Massive parallel batch throughput',
      ],
      limitations: [
        'High latency batch processing; unsuitable for real-time interactive queries',
        'Disk I/O bottleneck between Map and Reduce phases (superseded by Apache Spark)',
      ],
    },
  };

  const current = studies[activeTab];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cloud className="w-5 h-5 text-cyan-400" />
            Distributed Systems Syllabus: Emerging Cloud Case Studies
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Exhaustive syllabus case studies comparing real-world distributed architectures with DreamCanvas implementations
          </p>
        </div>
      </div>

      {/* Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {Object.values(studies).map((study) => (
          <button
            key={study.id}
            onClick={() => setActiveTab(study.id)}
            className={`p-3 rounded-xl border text-xs font-semibold transition text-left ${
              activeTab === study.id
                ? 'bg-cyan-600/20 border-cyan-500 text-white'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            {study.name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Case Study Detail View */}
      <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-xl font-bold text-white">{current.name}</h3>
            <p className="text-xs text-slate-400 mt-1 font-mono">{current.distributedConcept}</p>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${
              current.type === 'Implemented in DreamCanvas'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {current.type}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed">
          <div className="space-y-4">
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
              <span className="font-semibold text-cyan-300 block mb-1">What Problem It Solves:</span>
              <p className="text-slate-300">{current.problemSolved}</p>
            </div>

            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
              <span className="font-semibold text-purple-300 block mb-1">Why Distributed Systems Are Required:</span>
              <p className="text-slate-300">{current.whyRequired}</p>
            </div>

            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
              <span className="font-semibold text-emerald-300 block mb-1">Key Architectural Components:</span>
              <ul className="list-disc list-inside text-slate-300 space-y-1">
                {current.mainComponents.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
              <span className="font-semibold text-emerald-400 block mb-1">Key Advantages:</span>
              <ul className="list-disc list-inside text-slate-300 space-y-1">
                {current.advantages.map((adv, i) => (
                  <li key={i}>{adv}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
              <span className="font-semibold text-rose-400 block mb-1">Limitations &amp; Trade-offs:</span>
              <ul className="list-disc list-inside text-slate-300 space-y-1">
                {current.limitations.map((lim, i) => (
                  <li key={i}>{lim}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
