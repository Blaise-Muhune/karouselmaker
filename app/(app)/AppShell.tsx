"use client";

import { useState } from "react";
import Link from "next/link";
import { ContactUsModal } from "@/components/admin/ContactUsModal";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { createCustomerPortalSession } from "@/app/actions/subscription/createCustomerPortalSession";
import { UpgradePlansDialog } from "@/components/subscription/UpgradePlansDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { LogoutButtonWithOverlay } from "@/components/auth/LogoutButtonWithOverlay";
import { WeeklyCreatorNotePreference } from "@/components/email/WeeklyCreatorNotePreference";
import {
  ChevronDownIcon,
  CreditCardIcon,
  FolderIcon,
  Gem,
  Loader2Icon,
  MenuIcon,
  PlusCircleIcon,
  ShieldIcon,
  UserIcon,
} from "lucide-react";
import { ADMIN_EMAILS } from "@/lib/server/auth/isAdmin";

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

function GoProButton({ className }: { className?: string }) {
  const [plansOpen, setPlansOpen] = useState(false);
  return (
    <>
      <Button variant="default" size="sm" className={className} onClick={() => setPlansOpen(true)}>
        <Gem className="mr-2 size-4" />
        View plans
      </Button>
      <UpgradePlansDialog open={plansOpen} onOpenChange={setPlansOpen} />
    </>
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
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        className
      )}
    >
      {children}
    </Link>
  );
}

function DestinationLinks({
  pathname,
  isAdmin,
  onNavigate,
  className,
}: {
  pathname: string;
  isAdmin?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <NavLink
        href="/projects"
        isActive={pathname === "/projects" || pathname.startsWith("/projects/")}
        onClick={onNavigate}
      >
        Projects
      </NavLink>
      <NavLink href="/assets" isActive={pathname.startsWith("/assets")} onClick={onNavigate}>
        Assets
      </NavLink>
      {isAdmin ? (
        <NavLink href="/admin" isActive={pathname.startsWith("/admin")} onClick={onNavigate}>
          <ShieldIcon className="size-3.5 opacity-80" aria-hidden />
          Admin
        </NavLink>
      ) : null}
    </div>
  );
}

function ProjectSwitcher({
  currentProject,
  projects,
  onNavigate,
  className,
}: {
  currentProject?: Project;
  projects: Project[];
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 max-w-[11rem] min-w-0 justify-between gap-1.5 font-normal lg:max-w-[14rem]",
            currentProject && "border-primary/35 bg-primary/[0.04] text-foreground",
            className
          )}
          aria-label={currentProject ? `Current project: ${currentProject.name}` : "Select project"}
        >
          <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 truncate">{currentProject?.name ?? "Select project"}</span>
          <ChevronDownIcon className="size-3.5 shrink-0 opacity-50" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[240px]">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Projects</DropdownMenuLabel>
        {projects.length === 0 ? (
          <DropdownMenuItem asChild>
            <Link href="/projects/new" onClick={onNavigate}>
              Create your first project
            </Link>
          </DropdownMenuItem>
        ) : (
          <>
            {projects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                asChild
                className={p.id === currentProject?.id ? "bg-primary/10 text-primary" : undefined}
              >
                <Link href={`/p/${p.id}`} onClick={onNavigate}>
                  {p.name}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/projects/new" onClick={onNavigate}>
                <PlusCircleIcon className="mr-2 size-4" />
                New project
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NewPostButton({
  currentProject,
  projects,
  onNavigate,
  className,
  iconOnly = false,
}: {
  currentProject?: Project;
  projects: Project[];
  onNavigate?: () => void;
  className?: string;
  iconOnly?: boolean;
}) {
  if (projects.length === 0) {
    return (
      <Button variant="outline" size="sm" className={cn("h-9", className)} disabled>
        <PlusCircleIcon className={cn("size-4", !iconOnly && "mr-1.5")} />
        {iconOnly ? <span className="sr-only">New post</span> : "New post"}
      </Button>
    );
  }

  return (
    <Button variant="default" size="sm" className={cn("h-9", className)} asChild>
      <Link
        href={`/p/${currentProject?.id ?? projects[0]!.id}/new`}
        onClick={onNavigate}
        aria-label="New post"
      >
        <PlusCircleIcon className={cn("size-4", !iconOnly && "mr-1.5")} />
        {iconOnly ? <span className="sr-only">New post</span> : "New post"}
      </Link>
    </Button>
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
  const closeSheet = () => setSheetOpen(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur safe-area-t">
        <div
          className={cn(
            "mx-auto flex h-14 max-w-[90rem] items-center gap-2",
            "pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]",
            "sm:gap-3 sm:pl-[max(1.25rem,env(safe-area-inset-left))] sm:pr-[max(1.25rem,env(safe-area-inset-right))]",
            "md:pl-[max(1.5rem,env(safe-area-inset-left))] md:pr-[max(1.5rem,env(safe-area-inset-right))]"
          )}
        >
          {/* Left: brand + primary destinations */}
          <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0 md:hidden"
                  aria-label="Open menu"
                >
                  <MenuIcon className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(100%,20rem)]">
                <SheetHeader>
                  <SheetTitle>
                    <Link
                      href="/projects"
                      className="flex items-center gap-2 font-semibold tracking-tight"
                      onClick={closeSheet}
                    >
                      <img src="/logo.png" alt="" className="h-7 w-7 rounded-md object-contain" />
                      Karouselmaker
                    </Link>
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-5" aria-label="Mobile">
                  <div className="space-y-1">
                    <p className="px-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Navigate
                    </p>
                    <DestinationLinks
                      pathname={pathname}
                      isAdmin={isAdmin}
                      onNavigate={closeSheet}
                      className="flex-col items-stretch gap-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="px-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Workspace
                    </p>
                    <ProjectSwitcher
                      currentProject={currentProject}
                      projects={projects}
                      onNavigate={closeSheet}
                      className="w-full max-w-none"
                    />
                    <NewPostButton
                      currentProject={currentProject}
                      projects={projects}
                      onNavigate={closeSheet}
                      className="w-full justify-center"
                    />
                  </div>
                  {!isPro ? (
                    <div className="pt-1">
                      <GoProButton className="w-full" />
                    </div>
                  ) : null}
                </nav>
              </SheetContent>
            </Sheet>

            <Link
              href="/projects"
              className="flex min-w-0 items-center gap-2 rounded-lg py-1 pr-1 font-semibold tracking-tight transition-opacity hover:opacity-80"
            >
              <img src="/logo.png" alt="" className="h-7 w-7 shrink-0 rounded-md object-contain" />
              <span className="hidden truncate sm:inline">Karouselmaker</span>
            </Link>

            <nav className="ml-1 hidden items-center md:flex" aria-label="Primary">
              <DestinationLinks pathname={pathname} isAdmin={isAdmin} />
            </nav>
          </div>

          {/* Right: context + create + account */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="hidden items-center gap-2 md:flex">
              <ProjectSwitcher currentProject={currentProject} projects={projects} />
              <NewPostButton currentProject={currentProject} projects={projects} />
            </div>

            {/* Keep primary create action visible on phones */}
            <NewPostButton
              currentProject={currentProject}
              projects={projects}
              className="md:hidden"
              iconOnly
            />

            {!isPro ? <GoProButton className="hidden lg:inline-flex" /> : null}
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-10" aria-label="Account menu">
                  <UserIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                  {userEmail}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isPro ? (
                  <DropdownMenuItem asChild>
                    <ManageSubscriptionButton />
                  </DropdownMenuItem>
                ) : null}
                <WeeklyCreatorNotePreference />
                <DropdownMenuItem asChild>
                  <form action={signOut}>
                    <LogoutButtonWithOverlay />
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
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Made with KarouselMaker.com
            </a>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
              <Link href="/copyright" className="hover:text-foreground">
                Copyright
              </Link>
              <ContactUsModal userEmail={userEmail} userName={userName} />
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
