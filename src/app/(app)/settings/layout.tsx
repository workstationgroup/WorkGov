"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Clock,
  Key,
  MessageCircle,
  Search,
  Fingerprint,
  Users,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";

const settingsNav = [
  { name: "Schedule", href: "/settings/schedule", icon: Clock },
  { name: "Keywords", href: "/settings/keywords", icon: Search },
  { name: "Security", href: "/settings/security", icon: Fingerprint },
  { name: "Credentials", href: "/settings/credentials", icon: Key },
  { name: "LINE", href: "/settings/line", icon: MessageCircle },
  { name: "Changelog", href: "/settings/changelog", icon: History },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin === true;

  const allNav = isAdmin
    ? [...settingsNav, { name: "Admin", href: "/settings/admin", icon: Users }]
    : settingsNav;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure e-GP monitoring, keywords, and notifications
        </p>
      </div>

      <div className="flex overflow-x-auto gap-1 border-b border-border pb-px -mb-px">
        {allNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg border-b-2 transition-colors",
                isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
