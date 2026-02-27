"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { FileText, History, Settings, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard/editor", label: "Editor", icon: FileText },
  { href: "/dashboard/history", label: "History", icon: History },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 px-4 border-b border-zinc-200 dark:border-zinc-800">
          <Bot className="h-5 w-5 text-indigo-500" />
          <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
            HumanizeIt
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-2 flex-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 md:hidden">
            <Bot className="h-5 w-5 text-indigo-500" />
            <span className="font-semibold text-sm">HumanizeIt</span>
          </div>

          {/* Mobile nav */}
          <nav className="hidden sm:flex md:hidden items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-zinc-600 hover:bg-zinc-100"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="md:hidden" />
          <UserButton afterSignOutUrl="/" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="flex sm:hidden border-t border-zinc-200 bg-white dark:bg-zinc-900">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
                  active ? "text-indigo-600" : "text-zinc-500"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
