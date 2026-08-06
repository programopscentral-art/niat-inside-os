import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name?: string | null, email?: string | null) {
  const src = (name || email || '?').trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || src[0]?.toUpperCase() || '?';
}

export function timeAgo(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function isOverdue(due?: string | null, status?: string) {
  if (!due || status === 'DONE' || status === 'CANCELLED') return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(due) < today;
}

/** Return the URL only if it is a safe http(s) link (blocks javascript: etc.). */
export function safeUrl(url?: string | null): string | null {
  if (!url) return null;
  const u = url.trim();
  return /^https?:\/\//i.test(u) ? u : null;
}

/** Extract @mentions (emails) from comment text. */
export function extractMentions(body: string): string[] {
  const re = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const out = new Set<string>();
  let m;
  while ((m = re.exec(body))) out.add(m[1].toLowerCase());
  return [...out];
}
