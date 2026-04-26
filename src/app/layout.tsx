import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Design Intel",
  description: "Design team manager dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <Sidebar />
        <main className="ml-52 min-h-screen">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
