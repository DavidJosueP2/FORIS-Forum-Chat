import type { AuthConfig } from './auth-config.js';

export interface MailSender { name: string; address: string }

function hasControls(value: string): boolean {
  return [...value].some(character => {
    const point = character.codePointAt(0) ?? 0;
    return point < 32 || point === 127;
  });
}
function isAddress(value: string): boolean {
  return value.length <= 254 && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/u.test(value);
}

/** Admite nombre visible, dirección simple y el formato previo Nombre <correo>. */
export function resolveMailSender(mail: Pick<AuthConfig['mail'], 'from' | 'fromAddress' | 'user'>): MailSender | null {
  const from = mail.from.trim();
  const explicitAddress = mail.fromAddress?.trim() ?? '';
  if (!from || hasControls(from) || hasControls(explicitAddress)) return null;

  const formatted = from.match(/^(.*?)\s*<([^<>]+)>$/u);
  if (!formatted && /[<>]/u.test(from)) return null;

  const bareAddress = isAddress(from);
  const address = explicitAddress || (formatted ? formatted[2].trim() : bareAddress ? from : mail.user.trim());
  if (!isAddress(address) || hasControls(address)) return null;

  const name = (formatted ? formatted[1].trim() : bareAddress ? '' : from).replace(/^"(.*)"$/u, '$1');
  return { name, address };
}
