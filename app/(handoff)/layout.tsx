import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Continue from Digilaine",
};

export default function DigilaineHandoffLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <img src="/logo.png" alt="Karouselmaker" className="mb-6 h-12 w-12 rounded-xl object-contain" />
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
