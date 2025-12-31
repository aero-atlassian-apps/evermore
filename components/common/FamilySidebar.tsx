
'use client'
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"

import { Button } from "@/components/ui/button"

export function FamilySidebar() {
  const pathname = usePathname();

  return (
    <div className="hidden border-r bg-neutral-900 text-neutral-300 md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b border-neutral-800 px-4 lg:h-[60px] lg:px-6">
          <Link href="/portal" className="flex items-center gap-2 font-semibold text-white">
            <span className="">Arthur's Life</span>
          </Link>
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            <Link
              href="/portal"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-white ${pathname === "/portal" ? 'bg-neutral-800 text-white' : ''}`}
            >
              📖 Chapters
            </Link>
            <Link
              href="#"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-white"
            >
              👥 People
            </Link>
            <Link
              href="#"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-white"
            >
              📍 Places
            </Link>
            <Link
              href="#"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-white"
            >
              🏷️ Topics
            </Link>
            <div className="my-4 h-px bg-neutral-800" />
            <Link
              href="#"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-white"
            >
              🎨 Timeline View
            </Link>
            <Link
              href="#"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-white"
            >
              📊 Entity Map
            </Link>
          </nav>
        </div>
      </div>
    </div>
  )
}

export function MobileFamilySidebar() {
  const pathname = usePathname();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="md:hidden"
        >
          Open
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col">
        <nav className="grid gap-2 text-lg font-medium">
          <Link
            href="#"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            Evermore
          </Link>
          <Link
            href="/portal"
            className={`mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground ${pathname.includes("portal") ? 'bg-muted text-primary' : ''}`}
          >
            Chapters
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
