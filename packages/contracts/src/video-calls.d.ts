export interface VideoCallPeer { id: string; displayName: string }
export interface VideoDescription { type: 'offer' | 'answer'; sdp: string }
export interface VideoSignal { id: string; from: string; description: VideoDescription }
export interface VideoCallStatus { enabled: boolean; participants: number; capacity: number; relay: boolean }
export interface VideoCallSync {
  peers: VideoCallPeer[]; signals: VideoSignal[]; nextCursor: string; hasMore: boolean; expiresAt: string;
}
export interface VideoCallJoin extends VideoCallSync {
  memberId: string;
  iceServers: { urls: string[]; username?: string; credential?: string }[];
  iceTransportPolicy: 'all' | 'relay';
}
