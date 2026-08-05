'use client';
import { useEffect, useRef, useState } from 'react';
import { Search, X, Check } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { createSupabaseBrowser } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';

export interface Person { email: string; full_name: string | null; avatar_url?: string | null; }

/**
 * Searchable person picker.
 * - Pass `people` for a fixed local list (e.g. team members) — filtered client-side.
 * - Set `orgSearch` to query all profiles org-wide (for cross-team tagging/mentions).
 * Calls onSelect(email) when a person is chosen.
 */
export function PersonPicker({
  people, orgSearch, value, onSelect, placeholder = 'Search people…', allowUnassign
}: {
  people?: Person[];
  orgSearch?: boolean;
  value?: string;
  onSelect: (email: string) => void;
  placeholder?: string;
  allowUnassign?: boolean;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Person[]>(people ?? []);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!orgSearch) {
      const ql = q.toLowerCase();
      setResults((people ?? []).filter((p) => `${p.full_name ?? ''} ${p.email}`.toLowerCase().includes(ql)).slice(0, 8));
      return;
    }
    const t = setTimeout(async () => {
      const term = q.trim();
      if (term.length < 2) { setResults([]); return; }
      const supabase = createSupabaseBrowser();
      const { data } = await supabase
        .from('profiles').select('email, full_name, avatar_url')
        .or(`email.ilike.%${term}%,full_name.ilike.%${term}%`)
        .limit(8);
      setResults((data ?? []) as Person[]);
    }, 220);
    return () => clearTimeout(t);
  }, [q, orgSearch, people]);

  function choose(p: Person) { onSelect(p.email); setQ(''); setOpen(false); }

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
        <input
          className="input pl-9"
          placeholder={value ? value : placeholder}
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter' && results[active]) { e.preventDefault(); choose(results[active]); }
            else if (e.key === 'Escape') setOpen(false);
          }}
        />
        {value && (
          <button type="button" onClick={() => onSelect('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg" title="Clear">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && (results.length > 0 || allowUnassign) && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-soft">
          {allowUnassign && (
            <button type="button" onClick={() => { onSelect(''); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
              <span className="chip">Unassign</span>
            </button>
          )}
          {results.map((p, i) => (
            <button key={p.email} type="button" onMouseEnter={() => setActive(i)} onClick={() => choose(p)}
              className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-sm', i === active ? 'bg-muted' : 'hover:bg-muted')}>
              <Avatar name={p.full_name} email={p.email} src={p.avatar_url} size={24} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.full_name || p.email}</span>
                {p.full_name && <span className="block truncate text-xs text-fg-muted">{p.email}</span>}
              </span>
              {value === p.email && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
          {orgSearch && q.trim().length >= 2 && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-fg-muted">No matches. They must sign in once to appear.</div>
          )}
        </div>
      )}
    </div>
  );
}
