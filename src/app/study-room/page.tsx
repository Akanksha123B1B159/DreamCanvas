'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Video, VideoOff, Mic, MicOff, Send, Share2, Users, CheckCircle2, Shield } from 'lucide-react';

type Signal = {
  roomId: string;
  senderId: string;
  targetId?: string;
  kind: 'offer' | 'answer' | 'candidate' | 'presence' | 'disconnect';
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit;
};

type ChatMessage = {
  messageId: string;
  senderId: string;
  roomId: string;
  timestamp: string;
  text: string;
  isProgress?: boolean;
};

export default function StudyRoomPage() {
  const [roomId, setRoomId] = useState('study-room-101');
  const [joined, setJoined] = useState(false);
  const [connection, setConnection] = useState('DISCONNECTED');
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [remoteVideo, setRemoteVideo] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const peer = useRef<RTCPeerConnection | null>(null);
  const channel = useRef<RTCDataChannel | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const localStream = useRef<MediaStream | null>(null);
  const participantId = useRef(crypto.randomUUID());
  const remoteParticipantId = useRef<string | null>(null);
  const processedSignals = useRef(new Set<string>());
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const signal = async (kind: Signal['kind'], payload?: Signal['payload'], targetId?: string) => {
    return fetch('/api/signaling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        senderId: participantId.current,
        targetId,
        kind,
        payload,
      }),
    });
  };

  const createFallbackCanvasStream = (): MediaStream => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      if (!ctx) return;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('DreamCanvas WebRTC P2P Stream', 40, 160);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px monospace';
      ctx.fillText(`Peer ID: ${participantId.current.slice(0, 8)}...`, 40, 200);
      ctx.fillText(`Timestamp: ${new Date().toLocaleTimeString()}`, 40, 230);
      requestAnimationFrame(draw);
    };
    draw();

    return canvas.captureStream(30);
  };

  const setupPeer = (remoteId: string, initiator: boolean) => {
    remoteParticipantId.current = remoteId;
    const connectionPeer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    peer.current = connectionPeer;
    setConnection('CONNECTING');

    connectionPeer.onicecandidate = (event) => {
      if (event.candidate) {
        signal('candidate', event.candidate.toJSON(), remoteParticipantId.current ?? undefined);
      }
    };

    connectionPeer.onconnectionstatechange = () => {
      setConnection(connectionPeer.connectionState.toUpperCase());
    };

    connectionPeer.ontrack = (event) => {
      setRemoteVideo(event.streams[0]);
    };

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        connectionPeer.addTrack(track, localStream.current!);
      });
    }

    if (initiator) {
      const dataChannel = connectionPeer.createDataChannel('study-room-chat');
      channel.current = dataChannel;
      dataChannel.onopen = () => setConnection('CONNECTED');
      dataChannel.onmessage = (event) => {
        setMessages((current) => [...current, JSON.parse(event.data)]);
      };
      connectionPeer.createOffer().then(async (offer) => {
        await connectionPeer.setLocalDescription(offer);
        await signal('offer', offer, remoteParticipantId.current ?? undefined);
      });
    } else {
      connectionPeer.ondatachannel = (event) => {
        channel.current = event.channel;
        channel.current.onopen = () => setConnection('CONNECTED');
        channel.current.onmessage = (event) => {
          setMessages((current) => [...current, JSON.parse(event.data)]);
        };
      };
    }
  };

  const join = async () => {
    if (!roomId.trim()) return;
    setJoined(true);

    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch {
      // Fallback to animated canvas stream so connection still proceeds
      localStream.current = createFallbackCanvasStream();
    }

    if (localVideo.current && localStream.current) {
      localVideo.current.srcObject = localStream.current;
    }

    await signal('presence');
  };

  useEffect(() => {
    if (!joined) return;

    const timer = window.setInterval(async () => {
      const response = await fetch(
        `/api/signaling?roomId=${encodeURIComponent(roomId)}&participantId=${participantId.current}`
      );
      const signals = (await response.json()) as Signal[];

      for (const incoming of signals) {
        const signalKey = `${incoming.kind}:${incoming.senderId}:${JSON.stringify(incoming.payload ?? '')}`;
        if (processedSignals.current.has(signalKey)) continue;
        processedSignals.current.add(signalKey);

        if (incoming.kind === 'presence' && !peer.current) {
          // Deterministic initiator tie-breaking: higher UUID initiates offer
          setupPeer(incoming.senderId, participantId.current > incoming.senderId);
        }

        if (incoming.kind === 'offer') {
          if (!peer.current) setupPeer(incoming.senderId, false);
          remoteParticipantId.current = incoming.senderId;
          const activePeer = peer.current;
          if (activePeer) {
            await activePeer.setRemoteDescription(incoming.payload as RTCSessionDescriptionInit);
            for (const candidate of pendingCandidates.current.splice(0)) {
              await activePeer.addIceCandidate(candidate);
            }
            const answer = await activePeer.createAnswer();
            await activePeer.setLocalDescription(answer);
            await signal('answer', answer, incoming.senderId);
          }
        }

        if (incoming.kind === 'answer') {
          await peer.current?.setRemoteDescription(incoming.payload as RTCSessionDescriptionInit);
          for (const candidate of pendingCandidates.current.splice(0)) {
            await peer.current?.addIceCandidate(candidate);
          }
        }

        if (incoming.kind === 'candidate') {
          const candidate = incoming.payload as RTCIceCandidateInit;
          if (peer.current?.remoteDescription) {
            await peer.current.addIceCandidate(candidate);
          } else {
            pendingCandidates.current.push(candidate);
          }
        }

        if (incoming.kind === 'disconnect') {
          setConnection('PEER DISCONNECTED');
          setRemoteVideo(null);
        }
      }
    }, 1200);

    return () => window.clearInterval(timer);
  }, [joined, roomId]);

  const sendMessage = () => {
    if (!text.trim() || channel.current?.readyState !== 'open') return;
    const message: ChatMessage = {
      messageId: crypto.randomUUID(),
      senderId: participantId.current,
      roomId,
      timestamp: new Date().toISOString(),
      text,
    };
    channel.current.send(JSON.stringify(message));
    setMessages((current) => [...current, message]);
    setText('');
  };

  const shareRoadmapProgress = () => {
    if (channel.current?.readyState !== 'open') return;
    const message: ChatMessage = {
      messageId: crypto.randomUUID(),
      senderId: participantId.current,
      roomId,
      timestamp: new Date().toISOString(),
      text: '🚀 Shared Progress: Currently on Day 4 of 30-Day Roadmap (Next.js & RPC APIs) · Streak: 4 Days!',
      isProgress: true,
    };
    channel.current.send(JSON.stringify(message));
    setMessages((current) => [...current, message]);
  };

  return (
    <main className="min-h-screen bg-[#0a0d14] px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent flex items-center gap-3">
              <Users className="w-7 h-7 text-cyan-400" />
              DreamCanvas Collaborative Study Room
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Direct WebRTC Peer-to-Peer (audio, video &amp; RTCDataChannel) with backend signaling
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-500">Status:</span>
            <span
              className={`px-3 py-1 rounded-full font-bold border ${
                connection === 'CONNECTED'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              {connection}
            </span>
          </div>
        </div>

        {!joined ? (
          <div className="max-w-xl mx-auto p-8 rounded-2xl bg-slate-950/80 border border-slate-800 text-center space-y-5">
            <div className="p-3 bg-cyan-500/10 text-cyan-400 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border border-cyan-500/20">
              <Users className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold text-white">Create or Join a Study Room</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Open this page in two separate browser windows or share the Room ID with a peer to test real-time P2P WebRTC media and text messaging.
            </p>

            <div className="flex gap-2">
              <input
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter Room ID"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={join}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-500/20"
              >
                Join Study Room
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            {/* Video Streams */}
            <section className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 aspect-video shadow-xl">
                  <video ref={localVideo} autoPlay muted playsInline className="w-full h-full object-cover" />
                  <span className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 backdrop-blur rounded text-[11px] font-mono text-cyan-300">
                    You (Local Peer)
                  </span>
                </div>

                <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 aspect-video shadow-xl flex items-center justify-center">
                  {remoteVideo ? (
                    <video
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                      ref={(element) => {
                        if (element) element.srcObject = remoteVideo;
                      }}
                    />
                  ) : (
                    <div className="text-center p-6 text-slate-500 space-y-2">
                      <Users className="w-8 h-8 mx-auto text-slate-600 animate-pulse" />
                      <p className="text-xs">Waiting for peer to connect with Room ID: <code className="text-cyan-400">{roomId}</code></p>
                    </div>
                  )}
                  <span className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 backdrop-blur rounded text-[11px] font-mono text-emerald-300">
                    Peer (Remote)
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center justify-between p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Room:</span>
                  <span className="font-mono text-white font-semibold">{roomId}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={shareRoadmapProgress}
                    disabled={connection !== 'CONNECTED'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition disabled:opacity-40"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Share Roadmap Progress
                  </button>
                </div>
              </div>
            </section>

            {/* P2P Chat via RTCDataChannel */}
            <section className="flex flex-col h-[460px] rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="font-semibold text-xs text-slate-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Direct P2P DataChannel Chat
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">Bypasses Server</span>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-16">
                    No messages yet. Send a message to your peer over the direct DataChannel.
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.messageId}
                      className={`p-3 rounded-xl text-xs space-y-1 ${
                        m.isProgress
                          ? 'bg-indigo-950/50 border border-indigo-500/30 text-indigo-200'
                          : m.senderId === participantId.current
                          ? 'bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 ml-8'
                          : 'bg-slate-900 border border-slate-800 text-slate-200 mr-8'
                      }`}
                    >
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>{m.senderId === participantId.current ? 'You' : 'Peer'}</span>
                        <span>{new Date(m.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p>{m.text}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  disabled={connection !== 'CONNECTED'}
                  placeholder={
                    connection === 'CONNECTED' ? 'Type message to peer...' : 'Waiting for WebRTC connection...'
                  }
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={!text.trim() || connection !== 'CONNECTED'}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
