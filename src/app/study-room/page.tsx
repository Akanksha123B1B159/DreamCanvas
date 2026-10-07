'use client';

import { useEffect, useRef, useState } from 'react';

type Signal = { roomId: string; senderId: string; targetId?: string; kind: 'offer' | 'answer' | 'candidate' | 'presence'; payload?: RTCSessionDescriptionInit | RTCIceCandidateInit };
type ChatMessage = { messageId: string; senderId: string; roomId: string; timestamp: string; text: string };

export default function StudyRoomPage() {
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const [connection, setConnection] = useState('DISCONNECTED');
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [remoteVideo, setRemoteVideo] = useState<MediaStream | null>(null);
  const peer = useRef<RTCPeerConnection | null>(null);
  const channel = useRef<RTCDataChannel | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const localStream = useRef<MediaStream | null>(null);
  const participantId = useRef(crypto.randomUUID());
  const remoteParticipantId = useRef<string | null>(null);
  const processedSignals = useRef(new Set<string>());
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const signal = async (kind: Signal['kind'], payload?: Signal['payload'], targetId?: string) => fetch('/api/signaling', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId, senderId: participantId.current, targetId, kind, payload }) });

  const setupPeer = (remoteId: string, initiator: boolean) => {
    remoteParticipantId.current = remoteId;
    const connectionPeer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peer.current = connectionPeer;
    setConnection('CONNECTING');
    connectionPeer.onicecandidate = (event) => event.candidate && signal('candidate', event.candidate.toJSON(), remoteParticipantId.current ?? undefined);
    connectionPeer.onconnectionstatechange = () => setConnection(connectionPeer.connectionState.toUpperCase());
    connectionPeer.ontrack = (event) => setRemoteVideo(event.streams[0]);
    if (localStream.current) localStream.current.getTracks().forEach((track) => connectionPeer.addTrack(track, localStream.current!));
    if (initiator) {
      const dataChannel = connectionPeer.createDataChannel('study-room-chat');
      channel.current = dataChannel;
      dataChannel.onopen = () => setConnection('CONNECTED');
      dataChannel.onmessage = (event) => setMessages((current) => [...current, JSON.parse(event.data)]);
      connectionPeer.createOffer().then(async (offer) => { await connectionPeer.setLocalDescription(offer); await signal('offer', offer, remoteParticipantId.current ?? undefined); });
    } else connectionPeer.ondatachannel = (event) => { channel.current = event.channel; channel.current.onopen = () => setConnection('CONNECTED'); channel.current.onmessage = (message) => setMessages((current) => [...current, JSON.parse(message.data)]); };
  };

  const join = async () => {
    if (!roomId.trim()) return;
    setJoined(true);
    try { localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }); if (localVideo.current) localVideo.current.srcObject = localStream.current; } catch { /* Media is optional; data chat still works. */ }
    await signal('presence');
  };

  useEffect(() => {
    if (!joined) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/signaling?roomId=${encodeURIComponent(roomId)}&participantId=${participantId.current}`);
      const signals = await response.json() as Signal[];
      for (const incoming of signals) {
        const signalKey = `${incoming.kind}:${incoming.senderId}:${JSON.stringify(incoming.payload ?? '')}`;
        if (processedSignals.current.has(signalKey)) continue;
        processedSignals.current.add(signalKey);
        if (incoming.kind === 'presence' && !peer.current) {
          // The lexicographically larger participant creates the offer. This prevents both peers from racing as initiators.
          setupPeer(incoming.senderId, participantId.current > incoming.senderId);
        }
        if (incoming.kind === 'offer') { if (!peer.current) setupPeer(incoming.senderId, false); remoteParticipantId.current = incoming.senderId; const activePeer = peer.current; if (activePeer) { await activePeer.setRemoteDescription(incoming.payload as RTCSessionDescriptionInit); for (const candidate of pendingCandidates.current.splice(0)) await activePeer.addIceCandidate(candidate); const answer = await activePeer.createAnswer(); await activePeer.setLocalDescription(answer); await signal('answer', answer, incoming.senderId); } }
        if (incoming.kind === 'answer') { await peer.current?.setRemoteDescription(incoming.payload as RTCSessionDescriptionInit); for (const candidate of pendingCandidates.current.splice(0)) await peer.current?.addIceCandidate(candidate); }
        if (incoming.kind === 'candidate') { const candidate = incoming.payload as RTCIceCandidateInit; if (peer.current?.remoteDescription) await peer.current.addIceCandidate(candidate); else pendingCandidates.current.push(candidate); }
      }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [joined, roomId]);

  const sendMessage = () => {
    if (!text.trim() || channel.current?.readyState !== 'open') return;
    const message = { messageId: crypto.randomUUID(), senderId: participantId.current, roomId, timestamp: new Date().toISOString(), text };
    channel.current.send(JSON.stringify(message)); setMessages((current) => [...current, message]); setText('');
  };

  return <main className="min-h-screen bg-[#0d1117] px-5 py-10 text-white"><div className="mx-auto max-w-6xl"><p className="text-sm uppercase tracking-[0.25em] text-cyan-400">Peer learning</p><h1 className="mt-3 text-4xl font-bold">Study Room</h1><p className="mt-2 text-slate-400">Signaling coordinates the connection; chat and media flow directly between peers after WebRTC connects.</p>{!joined ? <div className="mt-8 flex max-w-xl gap-3"><input value={roomId} onChange={(event) => setRoomId(event.target.value)} placeholder="Room ID" className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3" /><button onClick={join} className="rounded-lg bg-emerald-600 px-5 py-3 font-semibold">Create / Join</button></div> : <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]"><section className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><video ref={localVideo} autoPlay muted playsInline className="aspect-video w-full rounded-xl bg-slate-900 object-cover" /><video autoPlay playsInline className="aspect-video w-full rounded-xl bg-slate-900 object-cover" ref={(element) => { if (element) element.srcObject = remoteVideo; }} /></div><p className="text-sm text-slate-400">Room: <span className="font-mono text-white">{roomId}</span> | Connection: <span className="text-emerald-300">{connection}</span></p></section><section className="flex min-h-[360px] flex-col rounded-xl border border-slate-800 bg-slate-900/70 p-4"><div className="flex-1 space-y-3 overflow-auto">{messages.map((message) => <p key={message.messageId} className="rounded-lg bg-slate-800 px-3 py-2 text-sm"><span className="text-cyan-300">{message.senderId === participantId.current ? 'You' : 'Peer'}:</span> {message.text}</p>)}</div><div className="mt-4 flex gap-2"><input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendMessage()} placeholder="Message your peer" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" /><button onClick={sendMessage} className="rounded-lg bg-cyan-600 px-4 py-2">Send</button></div></section></div>}</div></main>;
}
