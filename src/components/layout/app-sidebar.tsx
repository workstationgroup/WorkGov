"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FileText,
  Settings,
  Building2,
  LogOut,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Tenders", href: "/tenders", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface AppSidebarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}

function UserBlock({ user, initials }: { user: AppSidebarProps["user"]; initials: string }) {
  return (
    <div className="flex items-center gap-3 px-3">
      {user?.image ? (
        <img src={user.image} alt="" className="h-8 w-8 rounded-full" />
      ) : (
        <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold text-sidebar-accent-foreground">
          {initials}
        </div>
      )}
      <div className="flex-1 min-w-0 text-xs">
        <p className="font-medium text-sidebar-foreground/90 truncate">
          {user?.name || "User"}
        </p>
        <p className="text-sidebar-foreground/50 truncate">
          {user?.email || ""}
        </p>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-3 space-y-1">
      {navigation.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}

// Desktop/Tablet: hamburger drawer
function DesktopDrawer({ user, initials }: { user: AppSidebarProps["user"]; initials: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="hidden md:block">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="fixed top-4 left-4 z-40 p-2 rounded-lg bg-background border border-border shadow-sm hover:bg-muted transition-colors">
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" showCloseButton={false} className="w-64 p-0 bg-sidebar text-sidebar-foreground">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="p-6">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3"
            >
              <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
                <Building2 className="h-5 w-5 text-sidebar-primary-foreground" />
              </div>
              <div>
                <h1 className="font-heading text-lg font-bold tracking-tight">
                  WorkGov
                </h1>
                <p className="text-xs text-sidebar-foreground/60">
                  Tender Management
                </p>
              </div>
            </Link>
          </div>
          <SidebarNav onNavigate={() => setOpen(false)} />
          <div className="p-4 border-t border-sidebar-border">
            <UserBlock user={user} initials={initials} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Mobile: bottom tab bar
function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border">
      <div className="flex items-center justify-around h-14">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors",
                isActive
                  ? "text-accent"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppSidebar({ user }: AppSidebarProps) {
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <>
      <DesktopDrawer user={user} initials={initials} />
      <MobileTabBar />
    </>
  );
}
