import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { HomeIcon } from "lucide-react";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] right-[max(1rem,env(safe-area-inset-right))] flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/" className="inline-flex items-center gap-2">
            <HomeIcon className="size-4" />
            Main page
          </Link>
        </Button>
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm lg:max-w-4xl">{children}</div>
    </div>
  );
}
