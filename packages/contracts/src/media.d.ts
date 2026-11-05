export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';
export type MediaState = 'PENDING' | 'VERIFYING' | 'READY' | 'REJECTED' | 'DELETING' | 'DELETED' | 'EXPIRED';
export interface MediaImage {
  id: string; originalName: string; mime: ImageMime; bytes: number;
  width: number; height: number; createdAt: string;
}
export interface MediaMetadata {
  id: string; originalName: string; state: MediaState; image: MediaImage | null;
  uploadExpiresAt: string; postId: string | null;
}
export interface MediaOptions { allowedTypes: ImageMime[]; maxBytes: number; maxPerPost: number }
export interface MediaUploadIntent {
  media: MediaMetadata;
  upload: { url: string; method: 'PUT'; headers: Record<string, string>; expiresAt: string };
}
export interface MediaReadUrl { url: string; expiresAt: string }
export interface MediaUsage { usedBytes: number; reservedBytes: number; limitBytes: number }
