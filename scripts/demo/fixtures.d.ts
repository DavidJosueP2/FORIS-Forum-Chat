export const profiles: readonly (readonly [key: string, name: string, bio: string])[];
export interface Topic {
  key: string;
  name: string;
  description: string;
  category: string;
  author: string;
  daysAgo: number;
  title: string;
  intro: string;
  photos: readonly string[];
  replies: readonly string[];
  private?: boolean;
}
export const topics: readonly Topic[];
