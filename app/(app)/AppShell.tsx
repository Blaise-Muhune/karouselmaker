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

function NavContent({
  currentProject,
  projects,
  setSheetOpen,
  isAdmin,
}: {
  currentProject?: Project;
  projects: Project[];
  setSheetOpen?: (open: boolean) => void;
  isAdmin?: boolean;
}) {
  return (
    <>
      {isAdmin && (
        <Button variant="ghost" size="sm" className="w-full justify-start md:w-auto" asChild>
          <Link href="/admin" onClick={() => setSheetOpen?.(false)}>
            <ShieldIcon className="mr-2 size-4" />
            Admin
          </Link>
        </Button>
      )}
      <Button variant="ghost" size="sm" className="w-full justify-start md:w-auto" asChild>
        <Link href="/templates" onClick={() => setSheetOpen?.(false)}>Templates</Link>
      </Button>
      <Button variant="ghost" size="sm" className="w-full justify-start md:w-auto" asChild>
        <Link href="/assets" onClick={() => setSheetOpen?.(false)}>Assets</Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-full min-w-0 justify-between md:w-auto md:min-w-[180px]">
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
                <DropdownMenuItem key={p.id} asChild>
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
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4 md:px-6 md:gap-4">
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
                    <Link href="/projects" className="font-semibold" onClick={() => setSheetOpen(false)}>
                      Karouselmaker
                    </Link>
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-2">
                  <NavContent currentProject={currentProject} projects={projects} setSheetOpen={setSheetOpen} isAdmin={isAdmin} />
                </nav>
              </SheetContent>
            </Sheet>
            <Link href="/projects" className="truncate font-semibold">
              Karouselmaker
            </Link>
          </div>
          {/* Desktop nav */}
          <nav className="hidden flex-1 items-center justify-center gap-3 md:flex">
            <NavContent currentProject={currentProject} projects={projects} isAdmin={isAdmin} />
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
      <main className="flex-1">{children}</main>
      <footer className="border-t py-3">
        <div className="flex flex-col items-center gap-2 px-4">
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
            <ContactUsModal userEmail={userEmail} userName={userName} />
          </div>
        </div>
      </footer>
    </div>
  );
}
