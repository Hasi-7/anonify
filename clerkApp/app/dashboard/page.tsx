import { UserButton } from "@clerk/nextjs";

export default function DashboardPage() {
  return (
    <main className="flex min-h-screen flex-col gap-6 bg-zinc-50 p-8 text-zinc-950">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <UserButton />
      </div>
      <p className="text-zinc-600">You are signed in.</p>
    </main>
  );
}
