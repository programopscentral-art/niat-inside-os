import { Ban } from 'lucide-react';

export default function SuspendedPage() {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="card max-w-md p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-danger/10"><Ban className="h-6 w-6 text-danger" /></div>
        <h1 className="mt-4 text-lg font-bold">Account suspended</h1>
        <p className="mt-1 text-sm text-fg-muted">Your access to NIAT Inside OS has been paused. Please contact your administrator.</p>
        <form action="/auth/signout" method="post" className="mt-5">
          <button className="btn btn-outline btn-md">Sign out</button>
        </form>
      </div>
    </div>
  );
}
