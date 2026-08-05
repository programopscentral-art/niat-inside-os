import { requireUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { NotificationsList } from '@/components/notifications/notifications-list';

export default async function NotificationsPage() {
  const user = await requireUser();
  const supabase = createSupabaseServer();

  const { data: notifs } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const taskIds = [...new Set((notifs ?? []).map((n: any) => n.task_id).filter(Boolean))];
  const tagMap = new Map<string, string>();
  if (taskIds.length) {
    const { data: tasks } = await supabase.from('tasks').select('id, tag').in('id', taskIds);
    (tasks ?? []).forEach((t: any) => tagMap.set(t.id, t.tag));
  }

  const items = (notifs ?? []).map((n: any) => ({
    id: n.id, type: n.type, title: n.title, body: n.body, is_read: n.is_read,
    created_at: n.created_at, tag: n.task_id ? tagMap.get(n.task_id) ?? null : null
  }));

  return <NotificationsList items={items} />;
}
