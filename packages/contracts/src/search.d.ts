export interface SearchResult {
  kind: 'user' | 'community' | 'post';
  id: string;
  title: string;
}
