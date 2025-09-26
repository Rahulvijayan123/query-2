"use client"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { User, LogOut } from "lucide-react"
import { logout } from "@/lib/actions/auth"

export function AppNavigation() {
  return (
    <nav className="border-b border-emerald-500/20 bg-black/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/app" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image src="/convexia-logo.png" alt="Convexia" width={32} height={32} className="w-8 h-8" />
            <span className="text-xl font-semibold tracking-tight text-white">Convexia</span>
          </Link>

          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="rounded-full hover:bg-emerald-500/10 text-white">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-slate-900 border-emerald-500/20">
                <DropdownMenuItem asChild>
                  <form action={logout} className="w-full">
                    <button type="submit" className="flex items-center gap-2 w-full text-white hover:bg-emerald-500/10">
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  )
}
