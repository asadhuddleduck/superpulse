"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Item {
  href: string;
  label: string;
  icon: string;
  minRole?: "admin" | "owner";
}

const ITEMS: Item[] = [
  { href: "/admin", label: "Clients", icon: "◐" },
  { href: "/admin/links", label: "Join links", icon: "⛓" },
  { href: "/admin/team", label: "Team", icon: "◇", minRole: "admin" },
  { href: "/admin/funnel", label: "Funnel", icon: "▤" },
];

const RANK = { member: 1, admin: 2, owner: 3 } as const;

export default function ConsoleNav({ role }: { role: "owner" | "admin" | "member" }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" || pathname.startsWith("/admin/clients") : pathname.startsWith(href);

  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.filter((i) => !i.minRole || RANK[role] >= RANK[i.minRole]).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
            isActive(item.href)
              ? "bg-zinc-800/80 text-white"
              : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
          }`}
        >
          <span className="text-zinc-500 w-4 text-center">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
