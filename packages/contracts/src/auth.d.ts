export interface AccountUser {
  id: string; email: string; displayName: string; givenName: string; familyName: string;
  bio: string; emailVerified: boolean; hasPassword: boolean;
  google: { email: string } | null; createdAt: string;
}
export interface AuthSession {
  user: AccountUser | null;
  expiresAt: string | null;
  authenticatedAt: string | null;
}
export interface AuthOptions { enabled: boolean; google: boolean; emailDelivery: boolean }
export type OtpPurpose = 'verify_email' | 'reset_password' | 'change_password' | 'change_email';
export interface OtpChallenge {
  challengeId: string; expiresAt: string; resendAt: string; message: string;
}
