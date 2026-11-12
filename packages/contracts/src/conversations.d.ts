export interface Conversation {
  kind: 'community' | 'direct';
  id: string;
  name: string;
  imageId: string | null;
}
