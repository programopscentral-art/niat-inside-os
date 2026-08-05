import type { TaskStatus } from './types';

// All selectable statuses (board columns exclude CANCELLED, but the detail
// view lets you cancel).
export const TASK_STATUS_ALL: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE', 'CANCELLED'];
