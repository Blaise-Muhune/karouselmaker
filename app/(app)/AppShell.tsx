"use client";

import { useState } from "react";
import Link from "next/link";
import { ContactUsModal } from "@/components/admin/ContactUsModal";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { createCustomerPortalSession } from "@/app/actions/subscription/createCustomerPortalSession";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/server/db/types";
import { ChevronDownIcon, CreditCardIcon, Loader2Icon, LogOutIcon, MenuIcon, PlusCircleIcon, ShieldIcon, UserIcon } from "lucide-react";

const ADMIN_EMAILS = ["blaisemu007@gmail.com", "muyumba@andrews.edu"];

function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      className="flex w-full items-center"
      onClick={async () => {
        setLoading(true);
        const result = await createCustomerPortalSession();
        if ("url" in result) {
          window.location.href = result.url;
        } else {
          setLoading(false);
          alert(result.error ?? "Failed to open billing");
        }
      }}
      disabled={loading}
    >
      {loading ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : <CreditCardIcon className="mr-2 size-4" />}
      Manage subscription
    </button>
  );
}

function getCurrentProjectId(pathname: string): string | undefined {
  const match = pathname.match(/^\/p\/([^/]+)/);
  return match?.[1];
}

function isSlideEditPage(pathname: string): boolean {
  return /^\/p\/[^/]+\/c\/[^/]+\/s\/[^/]+$/.test(pathname);
}

function NavLink({
  href,
  children,
  isActive,
  className,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  isActive: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
        isActive
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
    >
      {children}
    </Link>
  );
}

function NavContent({
  currentProject,
  projects,
  setSheetOpen,
  isAdmin,
  pathname,
}: {
  currentProject?: Project;
  projects: Project[];
  setSheetOpen?: (open: boolean) => void;
  isAdmin?: boolean;
  pathname: string;
}) {
  return (
    <>
      <NavLink
        href="/projects"
        isActive={pathname === "/projects" || pathname.startsWith("/projects/")}
        onClick={() => setSheetOpen?.(false)}
        className="w-full justify-start md:w-auto md:inline-flex"
      >
        Projects
      </NavLink>
      {isAdmin && (
        <NavLink
          href="/admin"
          isActive={pathname.startsWith("/admin")}
          onClick={() => setSheetOpen?.(false)}
          className="w-full justify-start md:w-auto md:inline-flex"
        >
          <ShieldIcon className="mr-2 size-4" />
          Admin
        </NavLink>
      )}
      <NavLink
        href="/templates"
        isActive={pathname.startsWith("/templates")}
        onClick={() => setSheetOpen?.(false)}
        className="w-full justify-start md:w-auto md:inline-flex"
      >
        Templates
      </NavLink>
      <NavLink
        href="/assets"
        isActive={pathname.startsWith("/assets")}
        onClick={() => setSheetOpen?.(false)}
        className="w-full justify-start md:w-auto md:inline-flex"
      >
        Assets
      </NavLink>
          <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-full min-w-0 justify-between md:w-auto md:min-w-[160px] font-normal",
              currentProject && "border-primary/30 text-primary"
            )}
          >
            <span className="truncate">
              {currentProject?.name ?? "Select project"}
            </span>
            <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[240px]">
          {projects.length === 0 ? (
            <DropdownMenuItem asChild>
              <Link href="/projects/new" onClick={() => setSheetOpen?.(false)}>Create your first project</Link>
            </DropdownMenuItem>
          ) : (
            <>
              {projects.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  asChild
                  className={p.id === currentProject?.id ? "bg-primary/10 text-primary" : undefined}
                >
                  <Link href={`/p/${p.id}`} onClick={() => setSheetOpen?.(false)}>{p.name}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem asChild>
                <Link href="/projects/new" onClick={() => setSheetOpen?.(false)}>
                  <PlusCircleIcon className="mr-2 size-4" />
                  New project
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {projects.length > 0 ? (
        <Button variant="default" size="sm" className="w-full justify-start md:w-auto" asChild>
          <Link href={`/p/${currentProject?.id ?? projects[0]!.id}/new`} onClick={() => setSheetOpen?.(false)}>
            <PlusCircleIcon className="mr-2 size-4" />
            New carousel
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" className="w-full justify-start md:w-auto" disabled>
          <PlusCircleIcon className="mr-2 size-4" />
          New carousel
        </Button>
      )}
    </>
  );
}

export function AppShell({
  userEmail,
  userName = "",
  projects,
  children,
  isPro = false,
}: {
  userEmail: string;
  userName?: string;
  projects: Project[];
  children: React.ReactNode;
  isPro?: boolean;
}) {
  const pathname = usePathname();
  const currentProjectId = getCurrentProjectId(pathname);
  const isAdmin = ADMIN_EMAILS.includes(userEmail);

  const currentProject = currentProjectId
    ? projects.find((p) => p.id === currentProjectId)
    : undefined;

  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/60 bg-background/95 sticky top-0 z-10 backdrop-blur safe-area-t">
        <div className="flex h-14 items-center gap-2 px-4 sm:px-5 md:px-6 md:gap-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.25rem,env(safe-area-inset-left))] sm:pr-[max(1.25rem,env(safe-area-inset-right))] md:pl-[max(1.5rem,env(safe-area-inset-left))] md:pr-[max(1.5rem,env(safe-area-inset-right))]">
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            {/* Mobile: hamburger menu */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="md:hidden shrink-0" aria-label="Open menu">
                  <MenuIcon className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] sm:w-[300px]">
                <SheetHeader>
                  <SheetTitle>
                    <Link href="/projects" className="flex items-center gap-2 font-semibold tracking-tight" onClick={() => setSheetOpen(false)}>
                      <img src="/logo.svg" alt="" className="h-5 w-5" />
                      Karouselmaker
                    </Link>
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1">
                  <NavContent currentProject={currentProject} projects={projects} setSheetOpen={setSheetOpen} isAdmin={isAdmin} pathname={pathname} />
                </nav>
              </SheetContent>
            </Sheet>
            <Link href="/projects" className="flex items-center gap-2 truncate font-semibold tracking-tight transition-opacity hover:opacity-80">
              <img src="/logo.svg" alt="" className="h-5 w-5 shrink-0" />
              <span>Karouselmaker</span>
            </Link>
          </div>
          {/* Desktop nav */}
          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
            <NavContent currentProject={currentProject} projects={projects} isAdmin={isAdmin} pathname={pathname} />
          </nav>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="User menu">
                  <UserIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-muted-foreground cursor-default" disabled>
                  {userEmail}
                </DropdownMenuItem>
                {isPro && (
                  <DropdownMenuItem asChild>
                    <ManageSubscriptionButton />
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <form action={signOut}>
                    <button type="submit" className="flex w-full items-center">
                      <LogOutIcon className="mr-2 size-4" />
                      Log out
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="flex-1 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">{children}</main>
      {!isSlideEditPage(pathname) && (
        <footer className="border-t border-border/60 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col items-center gap-2 px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
            <a
              href="https://karouselmaker.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground text-sm hover:text-foreground transition-colors"
            >
              Made with KarouselMaker.com
            </a>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
              <Link href="/copyright" className="hover:text-foreground">Copyright</Link>
              <ContactUsModal userEmail={userEmail} userName={userName} />
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
