import Link from "next/link";
import { requireHqUser } from "@/lib/hq-auth";
import ConsoleNav from "./nav";

// Authenticated shell for the whole HQ console. requireHqUser() is the
// authoritative gate (middleware only does a coarse cookie check).
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireHqUser();
  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-black text-foreground">
      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-zinc-900 px-4 py-6 md:flex">
          <Link href="/admin" className="mb-8 px-2 text-xl font-bold tracking-tight">
            <span className="text-viridian">Super</span>
            <span className="text-sandstorm">Pulse</span>
            <span className="text-zinc-600 font-medium"> HQ</span>
          </Link>
          <ConsoleNav role={user.role} />
          <div className="mt-auto border-t border-zinc-900 pt-4">
            <div className="flex items-center gap-3 px-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-viridian/20 text-sm font-semibold text-viridian">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-zinc-300">{user.name || user.email}</div>
                <div className="truncate text-xs capitalize text-zinc-600">{user.role}</div>
              </div>
            </div>
            <a
              href="/admin/api/auth/logout"
              className="mt-2 block px-2 text-xs text-zinc-500 hover:text-white"
            >
              Log out
            </a>
          </div>
        </aside>

        {/* Mobile top bar */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-zinc-900 px-4 py-3 md:hidden">
            <Link href="/admin" className="text-lg font-bold tracking-tight">
              <span className="text-viridian">Super</span>
              <span className="text-sandstorm">Pulse</span>
              <span className="text-zinc-600 font-medium"> HQ</span>
            </Link>
            <a href="/admin/api/auth/logout" className="text-xs text-zinc-500">
              Log out
            </a>
          </header>
          <div className="md:hidden border-b border-zinc-900 px-2 py-2">
            <ConsoleNav role={user.role} />
          </div>

          <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
