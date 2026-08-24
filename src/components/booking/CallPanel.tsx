"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { formatDateTimeShort } from "@/lib/dateFormat";
import { getPusherClient } from "@/lib/chat/pusherClient";
import { uploadCallRecordingToCloudinary } from "@/lib/upload/cloudinaryClient";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

type SignalType = "ready" | "offer" | "answer" | "ice-candidate" | "hangup";
type CallState = "idle" | "connecting" | "connected" | "ended";

async function sendSignal(bookingId: string, type: SignalType, payload?: unknown) {
  await fetch(`/api/bookings/${bookingId}/call/signal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, payload }),
  }).catch(() => {});
}

/**
 * In-app audio call: peer-to-peer WebRTC (free Google STUN, no paid TURN --
 * see the plan for the accepted connectivity tradeoff), signaled over the
 * booking's existing private Pusher channel. Whoever is CLIENT always
 * creates the offer; the ASTROLOGER echoes "ready" back on receipt so the
 * offer gets created regardless of join order. Once both tracks are live,
 * a mixed local+remote recording is captured client-side and uploaded to
 * Cloudinary for admin review -- see CallRecordingsList.
 */
export function CallPanel({
  bookingId,
  windowStart,
  windowEnd,
  currentUserId,
  clientUserId,
}: {
  bookingId: string;
  windowStart: string;
  windowEnd: string;
  currentUserId: string;
  clientUserId: string;
}) {
  const isClient = currentUserId === clientUserId;

  const [now, setNow] = useState(() => new Date());
  const [callState, setCallState] = useState<CallState>("idle");
  const [joining, setJoining] = useState(false);
  const [hangingUp, setHangingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const offerSentRef = useRef(false);
  const ackedReadyRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const isOpen = now >= new Date(windowStart) && now <= new Date(windowEnd);

  function ensurePeerConnection() {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current as MediaStream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(bookingId, "ice-candidate", event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
      setCallState("connected");
      startRecording(remoteStream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        setCallState((current) => (current === "ended" ? current : "ended"));
      }
    };

    return pc;
  }

  function startRecording(remoteStream: MediaStream) {
    if (mediaRecorderRef.current || !localStreamRef.current) return;
    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();
      audioContext.createMediaStreamSource(localStreamRef.current).connect(destination);
      audioContext.createMediaStreamSource(remoteStream).connect(destination);

      const recorder = new MediaRecorder(destination.stream, { mimeType: "audio/webm;codecs=opus" });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      recordingStartRef.current = Date.now();
    } catch (err) {
      console.error("Failed to start call recording", err);
    }
  }

  async function stopRecordingAndUpload() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.stop();
    await stopped;
    audioContextRef.current?.close().catch(() => {});

    const chunks = recordedChunksRef.current;
    recordedChunksRef.current = [];
    if (chunks.length === 0) return;

    const durationSeconds = recordingStartRef.current
      ? Math.round((Date.now() - recordingStartRef.current) / 1000)
      : undefined;

    setUploading(true);
    try {
      const blob = new Blob(chunks, { type: "audio/webm" });
      const cloudinaryUrl = await uploadCallRecordingToCloudinary(bookingId, blob);
      await fetch(`/api/bookings/${bookingId}/call/recording`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cloudinaryUrl, durationSeconds }),
      });
    } catch (err) {
      console.error("Failed to upload call recording", err);
    } finally {
      setUploading(false);
    }
  }

  function cleanup() {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    pendingCandidatesRef.current = [];
    offerSentRef.current = false;
    ackedReadyRef.current = false;
  }

  async function handleJoin() {
    setError(null);
    setJoining(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
    } catch {
      setJoining(false);
      setError("Couldn't access your microphone. Please allow microphone access and try again.");
      return;
    }

    setJoining(false);
    setCallState("connecting");

    const pusher = getPusherClient();
    const channelName = `private-booking-${bookingId}`;
    const channel = pusher.subscribe(channelName);

    channel.bind(
      "call-signal",
      async (message: { type: SignalType; payload: unknown; fromUserId: string }) => {
        if (message.fromUserId === currentUserId) return;

        if (message.type === "ready") {
          if (isClient && !offerSentRef.current) {
            offerSentRef.current = true;
            const pc = ensurePeerConnection();
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal(bookingId, "offer", offer);
          } else if (!isClient && !ackedReadyRef.current) {
            ackedReadyRef.current = true;
            sendSignal(bookingId, "ready");
          }
          return;
        }

        if (message.type === "offer") {
          const pc = ensurePeerConnection();
          await pc.setRemoteDescription(
            new RTCSessionDescription(message.payload as RTCSessionDescriptionInit),
          );
          for (const candidate of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidatesRef.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal(bookingId, "answer", answer);
          return;
        }

        if (message.type === "answer") {
          const pc = pcRef.current;
          if (!pc) return;
          await pc.setRemoteDescription(
            new RTCSessionDescription(message.payload as RTCSessionDescriptionInit),
          );
          for (const candidate of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidatesRef.current = [];
          return;
        }

        if (message.type === "ice-candidate") {
          const pc = pcRef.current;
          const candidate = message.payload as RTCIceCandidateInit;
          if (pc?.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            pendingCandidatesRef.current.push(candidate);
          }
          return;
        }

        if (message.type === "hangup") {
          await stopRecordingAndUpload();
          cleanup();
          setCallState("ended");
        }
      },
    );

    sendSignal(bookingId, "ready");
  }

  async function handleHangup() {
    setHangingUp(true);
    await sendSignal(bookingId, "hangup");
    await stopRecordingAndUpload();
    cleanup();
    setHangingUp(false);
    setCallState("ended");
  }

  useEffect(() => {
    return () => {
      const pusher = getPusherClient();
      pusher.unsubscribe(`private-booking-${bookingId}`);
      cleanup();
    };
  }, [bookingId]);

  if (now < new Date(windowStart)) {
    return (
      <div className="rounded-lg border border-border bg-background-elevated p-3 text-sm text-foreground-muted">
        Call opens at {formatDateTimeShort(windowStart)}.
      </div>
    );
  }

  if (!isOpen && callState === "idle") {
    return <p className="text-sm text-foreground-muted">This call session has ended.</p>;
  }

  if (callState === "ended") {
    return (
      <p className="text-sm text-foreground-muted">
        Call ended.{uploading ? " Saving recording…" : ""}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <audio ref={remoteAudioRef} autoPlay />
      {callState === "idle" && (
        <Button onClick={handleJoin} loading={joining} className="self-start">
          Join Call
        </Button>
      )}
      {callState === "connecting" && (
        <p className="text-sm text-foreground-muted">Connecting…</p>
      )}
      {(callState === "connecting" || callState === "connected") && (
        <div className="flex items-center gap-2">
          {callState === "connected" && (
            <span className="text-sm text-success">In call</span>
          )}
          <Button variant="danger" size="sm" loading={hangingUp} onClick={handleHangup}>
            Hang Up
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
