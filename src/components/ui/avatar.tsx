import { initials } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function Avatar({
  name, email, src, size = 32, className
}: { name?: string | null; email?: string | null; src?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.4) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name || email || ''} width={size} height={size}
      className={cn('rounded-full object-cover ring-1 ring-border', className)} style={{ width: size, height: size }} />;
  }
  return (
    <div
      className={cn('rounded-full grid place-items-center font-semibold text-white ring-1 ring-border', className)}
      style={{ ...style, background: `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))` }}
      title={name || email || ''}
    >
      {initials(name, email)}
    </div>
  );
}
