"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Project } from "@/lib/server/db/types";
import { ChevronDownIcon, LogOutIcon, PlusCircleIcon, UserIcon } from "lucide-react";

function getCurrentProjectId(pathname: string): string | undefined {
  const match = pathname.match(/^\/p\/([^/]+)/);
  return match?.[1];
}

export function AppShell({
  userEmail,
  projects,
  children,
}: {
  userEmail: string;
  projects: Project[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentProjectId = getCurrentProjectId(pathname);

  const currentProject = currentProjectId
    ? projects.find((p) => p.id === currentProjectId)
    : undefined;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="flex h-14 items-center gap-4 px-4 md:px-6">
          <Link href="/projects" className="font-semibold">
            Karouselmaker
          </Link>
          <nav className="flex flex-1 items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/templates">Templates</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/assets">Assets</Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="min-w-[180px] justify-between">
                  <span className="truncate">
                    {currentProject?.name ?? "Select project"}
                  </span>
                  <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[240px]">
                {projects.length === 0 ? (
                  <DropdownMenuItem asChild>
                    <Link href="/projects/new">Create your first project</Link>
                  </DropdownMenuItem>
                ) : (
                  <>
                    {projects.map((p) => (
                      <DropdownMenuItem key={p.id} asChild>
                        <Link href={`/p/${p.id}`}>{p.name}</Link>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem asChild>
                      <Link href="/projects/new">
                        <PlusCircleIcon className="mr-2 size-4" />
                        New project
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="default" size="sm" asChild>
              <Link href="/projects/new">
                <PlusCircleIcon className="mr-2 size-4" />
                New project
              </Link>
            </Button>
          </nav>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <UserIcon className="size-4" />
                <span className="sr-only">User menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-muted-foreground cursor-default" disabled>
                {userEmail}
              </DropdownMenuItem>
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
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
