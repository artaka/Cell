import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { tokenStorage } from '../../api/client';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Minimize2, Maximize2, Users, RefreshCw, AlertCircle } from 'lucide-react';

interface RemoteParticipant {
  peer_id: string;
  user_id?: string;
  username?: string;
  stream_id?: string;
  stream?: MediaStream;
}

interface CallModalProps {
  chatId: string;
  chatTitle: string;
  roomId?: string;
  callType: 'video' | 'audio';
  onClose: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  chatId,
  chatTitle,
  roomId: initialRoomId,
  callType,
  onClose,
}) => {
  const [roomId, setRoomId] = useState<string | null>(initialRoomId || null);
  const [status, setStatus] = useState<string>('Инициализация...');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCamOff, setIsCamOff] = useState<boolean>(callType === 'audio');
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [participants, setParticipants] = useState<Map<string, RemoteParticipant>>(new Map());
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState<number>(0);

  const participantsRef = useRef<Map<string, RemoteParticipant>>(participants);
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const myPeerIdRef = useRef<string | null>(null);
  const candidateQueue = useRef<any[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (_) {}
      pcRef.current = null;
    }
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'leave' }));
        } catch (_) {}
      }
      try {
        wsRef.current.close();
      } catch (_) {}
      wsRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    remoteStreamsRef.current.clear();
    setParticipants(new Map());
    participantsRef.current = new Map();
    myPeerIdRef.current = null;
    candidateQueue.current = [];
  }, []);

  const handleHangup = () => {
    cleanup();
    onClose();
  };

  // Re-request camera without tearing down the existing call if already connected
  const handleRetryMedia = async () => {
    if (pcRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setStatus('Повторный запрос камеры...');
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
          audio: false,
        });
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (newVideoTrack) {
          if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach((t) => {
              localStreamRef.current?.removeTrack(t);
              t.stop();
            });
            localStreamRef.current.addTrack(newVideoTrack);
          } else {
            localStreamRef.current = newStream;
          }

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
            localVideoRef.current.play().catch(() => {});
          }

          const transceivers = pcRef.current.getTransceivers();
          const videoTransceiver = transceivers.find(
            (t) => t.receiver.track?.kind === 'video' || t.sender.track?.kind === 'video'
          );

          if (videoTransceiver) {
            videoTransceiver.direction = 'sendrecv';
            await videoTransceiver.sender.replaceTrack(newVideoTrack);
          } else {
            pcRef.current.addTrack(newVideoTrack, localStreamRef.current!);
          }

          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          wsRef.current.send(JSON.stringify({ type: 'offer', sdp: offer.sdp }));

          setIsCamOff(false);
          setPermissionError(null);
          setStatus('В эфире');
          return;
        }
      } catch (retryErr: any) {
        console.warn('[handleRetryMedia error]', retryErr);
        const errMsg = retryErr.message || '';
        const isStillBusy =
          retryErr.name === 'NotReadableError' ||
          retryErr.name === 'TrackStartError' ||
          errMsg.toLowerCase().includes('allocate') ||
          errMsg.toLowerCase().includes('videosource');
        if (isStillBusy) {
          setPermissionError('Камера все еще занята другим приложением. Закройте его и нажмите «Запросить снова».');
        } else {
          setPermissionError(retryErr.message || 'Не удалось получить доступ к камере.');
        }
        setStatus('В эфире (только микрофон)');
        return;
      }
    }

    // Fallback when not yet connected or microphone also failed: full clean restart
    cleanup();
    setRetryKey((prev) => prev + 1);
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCam = async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCamOff(!videoTrack.enabled);
        return;
      }
    }
    // If no video track exists yet (e.g. camera was blocked on start), request it now
    await handleRetryMedia();
  };

  const drainCandidates = async () => {
    while (candidateQueue.current.length > 0) {
      const cand = candidateQueue.current.shift();
      if (cand && pcRef.current) {
        try {
          await pcRef.current.addIceCandidate(cand);
        } catch (e) {
          console.warn('[WebRTC] addIceCandidate drain error:', e);
        }
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function initCall() {
      const token = tokenStorage.get();
      if (!token) {
        setStatus('Ошибка: нет токена авторизации');
        return;
      }

      setStatus('Запрос доступа к микрофону и камере...');
      setPermissionError(null);

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: callType === 'video'
            ? { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } }
            : false,
        });
      } catch (mediaErr: any) {
        console.warn('[getUserMedia initial error]', mediaErr);
        const errMsg = mediaErr.message || '';
        const isCameraIssue =
          callType === 'video' &&
          (mediaErr.name === 'NotReadableError' ||
            mediaErr.name === 'TrackStartError' ||
            mediaErr.name === 'OverconstrainedError' ||
            mediaErr.name === 'AbortError' ||
            errMsg.toLowerCase().includes('allocate') ||
            errMsg.toLowerCase().includes('videosource') ||
            errMsg.toLowerCase().includes('camera') ||
            errMsg.toLowerCase().includes('device'));

        if (isCameraIssue) {
          try {
            setStatus('Камера занята или недоступна, подключаем только микрофон...');
            stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
              video: false,
            });
            setPermissionError('Камера занята другим приложением или вкладкой. Звонок продолжен с микрофоном.');
          } catch (audioErr: any) {
            setPermissionError(audioErr.message || 'Ошибка доступа к микрофону');
            setStatus('Ошибка доступа к медиаустройствам');
            return;
          }
        } else {
          const errName = mediaErr.name;
          let userMsg = mediaErr.message || 'Нет доступа к микрофону/камере';
          if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
            userMsg = 'Доступ к микрофону/камере заблокирован в браузере или системе.';
          } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
            userMsg = 'Микрофон или камера не найдены на устройстве.';
          } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
            userMsg = 'Камера или микрофон уже используются другим приложением.';
          }
          setPermissionError(userMsg);
          setStatus('Требуется разрешение на использование медиаустройств');
          return;
        }
      }

      if (!isMounted) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      localStreamRef.current = stream;
      if (localVideoRef.current && callType === 'video' && stream.getVideoTracks().length > 0) {
        localVideoRef.current.srcObject = stream;
      }

      try {
        // Connect signaling WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        let wsUrl = `${protocol}//${host}/api/v1/calls/ws?token=${encodeURIComponent(token)}&chat_id=${encodeURIComponent(chatId)}`;
        if (roomId) {
          wsUrl += `&room_id=${encodeURIComponent(roomId)}`;
        }

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = async () => {
          if (!isMounted) return;
          setStatus('Подключение к SFU...');

          const pc = new RTCPeerConnection({
            iceServers: [
              {
                urls: [
                  'stun:stun.relay.metered.ca:80',
                  'stun:stun.cloudflare.com:3478',
                ],
              },
              {
                urls: [
                  'turn:global.relay.metered.ca:80',
                  'turn:global.relay.metered.ca:80?transport=tcp',
                  'turn:global.relay.metered.ca:443',
                  'turns:global.relay.metered.ca:443?transport=tcp',
                ],
                username: '089c7a03d37f148503bd0a37',
                credential: 'SSaJsDxbP7gSuJDU',
              },
            ],
          });
          pcRef.current = pc;

          // Add local tracks
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));

          // Ensure video and audio transceivers exist so renegotiations can receive both
          if (stream.getVideoTracks().length === 0) {
            pc.addTransceiver('video', { direction: 'recvonly' });
          }
          if (stream.getAudioTracks().length === 0) {
            pc.addTransceiver('audio', { direction: 'recvonly' });
          }

          // Handle incoming remote media tracks
          pc.ontrack = (event) => {
            const track = event.track;
            const remoteStream = event.streams?.[0];

            // Identify peer ID from stream id ("stream-<peerId>") or track id ("video-<peerId>", "audio-<peerId>")
            let peerId = '';
            if (remoteStream?.id && remoteStream.id.startsWith('stream-')) {
              peerId = remoteStream.id.replace('stream-', '');
            } else if (track.id.startsWith('video-')) {
              peerId = track.id.replace('video-', '');
            } else if (track.id.startsWith('audio-')) {
              peerId = track.id.replace('audio-', '');
            }

            if (!peerId) {
              const knownPeers = Array.from(participantsRef.current.keys());
              if (knownPeers.length === 1) {
                peerId = knownPeers[0];
              } else if (remoteStream?.id) {
                const matched = Array.from(participantsRef.current.values()).find(
                  (p) => p.stream_id === remoteStream.id || p.peer_id === remoteStream.id
                );
                if (matched) {
                  peerId = matched.peer_id;
                }
              }
            }

            // Avoid adding own track or rogue unknown tracks
            if (!peerId || (myPeerIdRef.current && peerId === myPeerIdRef.current)) {
              return;
            }
            if (localStreamRef.current && (remoteStream?.id === localStreamRef.current.id || track.id === localStreamRef.current.id)) {
              return;
            }

            // Maintain stable persistent MediaStream per peer
            let persistentStream = remoteStreamsRef.current.get(peerId);
            if (!persistentStream) {
              persistentStream = new MediaStream();
              remoteStreamsRef.current.set(peerId, persistentStream);
            }

            // Add or replace track in persistent stream
            const existingTrack = persistentStream.getTracks().find((t) => t.kind === track.kind);
            if (existingTrack) {
              if (existingTrack.id !== track.id) {
                persistentStream.removeTrack(existingTrack);
                persistentStream.addTrack(track);
              }
            } else {
              persistentStream.addTrack(track);
            }

            setParticipants((prev) => {
              const next = new Map(prev);
              const existing = next.get(peerId);
              next.set(peerId, {
                peer_id: peerId,
                user_id: existing?.user_id,
                username: existing?.username || `Участник`,
                stream_id: `stream-${peerId}`,
                stream: persistentStream,
              });
              return next;
            });
          };

          pc.onicecandidate = (event) => {
            if (event.candidate && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
            }
          };

          // Prefer VP8 on video transceivers if browser supports setCodecPreferences
          if (typeof RTCRtpSender !== 'undefined' && 'getCapabilities' in RTCRtpSender) {
            const capabilities = RTCRtpSender.getCapabilities('video');
            if (capabilities && capabilities.codecs) {
              const vp8 = capabilities.codecs.filter((c) => c.mimeType.toLowerCase() === 'video/vp8');
              const others = capabilities.codecs.filter((c) => c.mimeType.toLowerCase() !== 'video/vp8');
              const preferred = [...vp8, ...others];
              pc.getTransceivers().forEach((tc) => {
                if (tc.receiver.track?.kind === 'video' || tc.sender.track?.kind === 'video') {
                  try {
                    tc.setCodecPreferences(preferred);
                  } catch (_) {}
                }
              });
            }
          }

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ws.send(JSON.stringify({ type: 'offer', sdp: offer.sdp }));

          // Start duration timer
          timerRef.current = setInterval(() => {
            setCallDuration((prev) => prev + 1);
          }, 1000);
        };

        ws.onmessage = async (event) => {
          const msg = JSON.parse(event.data);
          const pc = pcRef.current;
          if (!pc) return;

          if (msg.type === 'room-info') {
            setStatus('В эфире');
            setRoomId(msg.room_id);
            myPeerIdRef.current = msg.peer_id;

            if (msg.participants) {
              const next = new Map<string, RemoteParticipant>();
              msg.participants.forEach((p: any) => {
                if (p.peer_id !== msg.peer_id) {
                  const stream = remoteStreamsRef.current.get(p.peer_id);
                  next.set(p.peer_id, {
                    ...p,
                    stream,
                  });
                }
              });
              setParticipants(next);
            }
          } else if (msg.type === 'user-joined') {
            if (msg.peer_id === myPeerIdRef.current) return;
            setParticipants((prev) => {
              const next = new Map(prev);
              const existing = next.get(msg.peer_id);
              const stream = existing?.stream || remoteStreamsRef.current.get(msg.peer_id);
              next.set(msg.peer_id, {
                ...msg,
                stream,
              });
              return next;
            });
          } else if (msg.type === 'offer') {
            // Incoming offer from server (renegotiation for newly joined peer)
            if (pc.signalingState !== 'stable') {
              await Promise.all([
                pc.setLocalDescription({ type: 'rollback' }).catch(() => {}),
                pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp })),
              ]);
            } else {
              await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }));
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'answer', sdp: answer.sdp }));

            await drainCandidates();
          } else if (msg.type === 'answer') {
            if (pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }));
              await drainCandidates();
            }
            setStatus('В эфире');
          } else if (msg.type === 'candidate') {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              pc.addIceCandidate(msg.candidate).catch((err) => {
                console.warn('[WebRTC] addIceCandidate failed:', err);
              });
            } else {
              candidateQueue.current.push(msg.candidate);
            }
          } else if (msg.type === 'user-left') {
            remoteStreamsRef.current.delete(msg.peer_id);
            setParticipants((prev) => {
              const next = new Map(prev);
              next.delete(msg.peer_id);
              return next;
            });
          } else if (msg.type === 'call-ended') {
            setStatus('Звонок завершен');
            setTimeout(handleHangup, 1000);
          }
        };

        ws.onerror = (err) => {
          console.error('[WebRTC WS error]', err);
          setStatus('Ошибка соединения со звонком');
        };

        ws.onclose = (ev) => {
          if (ev.code === 403) {
            setStatus('Доступ запрещен: вы не состоите в этом чате');
          }
        };
      } catch (err: any) {
        console.error('[initCall error]', err);
        const msg = err.message || 'Ошибка соединения со звонком';
        setStatus(`Ошибка доступа к медиа: ${msg}`);
        setPermissionError(msg);
      }
    }

    initCall();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [chatId, callType, retryKey, cleanup]);

  const uniqueParticipants = useMemo(() => {
    const map = new Map<string, RemoteParticipant>();
    participants.forEach((p) => {
      const key = p.user_id ? `user-${p.user_id}` : `peer-${p.peer_id}`;
      const existing = map.get(key);
      if (!existing || (p.stream && !existing.stream)) {
        map.set(key, p);
      }
    });
    return Array.from(map.values());
  }, [participants]);

  return (
    <div
      className={`fixed z-50 transition-all duration-300 shadow-2xl ${
        isMinimized
          ? 'bottom-6 right-6 w-80 bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden'
          : 'inset-0 bg-slate-950/95 flex flex-col'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/80 border-b border-slate-800 text-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div className="truncate">
            <h4 className="font-semibold text-sm truncate">{chatTitle}</h4>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{status}</span>
              <span>•</span>
              <span className="font-mono text-emerald-400">{formatTimer(callDuration)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title={isMinimized ? 'Развернуть' : 'Свернуть'}
          >
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Permission Error / Warning Banner with Retry */}
      {permissionError && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between text-amber-200 text-xs">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <AlertCircle size={16} className="text-amber-400 shrink-0" />
            <span className="truncate">{permissionError}</span>
          </div>
          <button
            onClick={handleRetryMedia}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded font-medium transition shrink-0"
          >
            <RefreshCw size={12} />
            <span>Запросить снова</span>
          </button>
        </div>
      )}

      {/* Media / Video Grid */}
      <div className={`flex-1 p-4 overflow-y-auto ${isMinimized ? 'max-h-56' : ''}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
          {/* Local Participant Tile */}
          <div className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center min-h-[160px]">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-contain transform -scale-x-100 ${
                callType === 'video' && !isCamOff ? 'block' : 'hidden'
              }`}
            />
            {!(callType === 'video' && !isCamOff) && (
              <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-xl font-bold">
                  Вы
                </div>
                <span className="text-xs">Камера выключена</span>
              </div>
            )}
            <div className="absolute bottom-3 left-3 bg-slate-950/70 backdrop-blur px-2.5 py-1 rounded text-xs text-white">
              Вы {isMuted ? '🔇' : ''}
            </div>
          </div>

          {/* Remote Participants Tiles */}
          {uniqueParticipants.map((p) => (
            <RemoteVideoTile key={p.peer_id} participant={p} />
          ))}

          {uniqueParticipants.length === 0 && (
            <div className="bg-slate-900/50 rounded-xl border border-dashed border-slate-800 flex flex-col items-center justify-center p-6 text-slate-400">
              <Users size={32} className="mb-2 text-slate-600" />
              <p className="text-sm font-medium">Ожидание собеседников...</p>
              <p className="text-xs text-slate-500 mt-1">Они могут подключиться из этого чата</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="flex items-center justify-center gap-3 p-4 bg-slate-900/90 border-t border-slate-800">
        <button
          onClick={toggleMic}
          className={`p-3 rounded-full transition ${
            isMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-slate-800 text-white hover:bg-slate-700'
          }`}
          title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {callType === 'video' && (
          <button
            onClick={toggleCam}
            className={`p-3 rounded-full transition ${
              isCamOff ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
            title={isCamOff ? 'Включить камеру' : 'Выключить камеру'}
          >
            {isCamOff ? <VideoOff size={20} /> : <VideoIcon size={20} />}
          </button>
        )}

        <button
          onClick={handleHangup}
          className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-full transition shadow-lg shadow-red-600/30"
          title="Завершить звонок"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
};

// Sub-component for remote video and audio rendering
const RemoteVideoTile: React.FC<{ participant: RemoteParticipant }> = ({ participant }) => {
  const [hasLiveVideo, setHasLiveVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Bind video element stream
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (participant.stream) {
      if (videoEl.srcObject !== participant.stream) {
        videoEl.srcObject = participant.stream;
      }
      videoEl.play().catch((e) => {
        // Ignored if user has not interacted or already playing
      });
    } else {
      videoEl.srcObject = null;
    }
  }, [participant.stream]);

  // Bind audio element stream
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    if (participant.stream) {
      if (audioEl.srcObject !== participant.stream) {
        audioEl.srcObject = participant.stream;
      }
      audioEl.play().catch((e) => {
        // Ignored if user has not interacted or already playing
      });
    } else {
      audioEl.srcObject = null;
    }
  }, [participant.stream]);

  // Track video track liveliness
  useEffect(() => {
    if (!participant.stream) {
      setHasLiveVideo(false);
      return;
    }

    const evaluateVideo = () => {
      const vTracks = participant.stream?.getVideoTracks() || [];
      const live = vTracks.length > 0 && vTracks.some((t) => t.readyState !== 'ended');
      setHasLiveVideo(live);
    };

    evaluateVideo();

    const handleTrackChange = () => evaluateVideo();
    participant.stream.addEventListener('addtrack', handleTrackChange);
    participant.stream.addEventListener('removetrack', handleTrackChange);

    participant.stream.getVideoTracks().forEach((track) => {
      track.onunmute = handleTrackChange;
      track.onmute = handleTrackChange;
      track.onended = handleTrackChange;
    });

    return () => {
      participant.stream?.removeEventListener('addtrack', handleTrackChange);
      participant.stream?.removeEventListener('removetrack', handleTrackChange);
    };
  }, [participant.stream]);

  return (
    <div className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center min-h-[160px]">
      {/* Hidden dedicated audio element: GUARANTEES remote audio plays */}
      <audio
        ref={audioRef}
        autoPlay
      />

      {/* Video element: always present in DOM, displayed when video track is active */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={true}
        className={`w-full h-full object-contain ${hasLiveVideo ? 'block' : 'hidden'}`}
      />

      {/* Fallback avatar when camera is off or audio-only */}
      {!hasLiveVideo && (
        <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
          <div className="w-16 h-16 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center text-xl font-bold">
            {(participant.username || 'У')[0].toUpperCase()}
          </div>
          <span className="text-xs text-slate-300">{participant.username || 'Участник'}</span>
          <span className="text-[10px] text-slate-500">Без видео</span>
        </div>
      )}

      <div className="absolute bottom-3 left-3 bg-slate-950/70 backdrop-blur px-2.5 py-1 rounded text-xs text-white">
        {participant.username || `Пир ${participant.peer_id.substring(0, 6)}`}
      </div>
    </div>
  );
};
