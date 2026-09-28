import { useState, useEffect, useRef } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  X,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { memberStore, Member, cckStore, CckMember, isStaff } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { useHub } from "@/hooks/use-hub";

const LOGIN_URL =
  "https://portal.richfromanywhere.com/login?next=https%3A%2F%2Fmembers.richfromanywhere.com%2F";

const getStatusColor = (status: string) => {
  switch (status) {
    case "Active":
      return "bg-status-active text-white";
    case "Past Due":
      return "bg-status-past-due text-white";
    case "Expired":
      return "bg-status-expired text-white";
    case "Canceled":
      return "bg-status-canceled text-white";
    case "Renewed":
      return "bg-status-renewed text-white";
    case "On Extension":
      return "bg-status-extension text-white";
    case "Pending":
      return "bg-status-pending text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hub, isCCK } = useHub();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isOnSettingsPage = location.pathname.endsWith("/settings");

  // Global search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState<string>("");
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const staff = isStaff();

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch signed-in user's email for the sign-out section
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setUserEmail(data.user.email);
    });
  }, []);

  // Reload members whenever location changes or hub changes
  useEffect(() => {
    if (isCCK) {
      cckStore.getMembers().then(setAllMembers);
    } else {
      memberStore.getMembers().then(setAllMembers);
    }
  }, [location.pathname, isCCK]);

  // Auto theme schedule: light at 7am EST, dark at 8pm EST
  useEffect(() => {
    const applyScheduledTheme = () => {
      const autoEnabled =
        localStorage.getItem("rfa-auto-theme-schedule") === "true";
      if (!autoEnabled) return;
      const now = new Date();
      const estHour = new Date(
        now.toLocaleString("en-US", { timeZone: "America/New_York" }),
      ).getHours();
      const shouldBeLight = estHour >= 7 && estHour < 20;
      setTheme(shouldBeLight ? "light" : "dark");
    };

    applyScheduledTheme();
    // Check every minute
    const interval = setInterval(applyScheduledTheme, 60 * 1000);
    return () => clearInterval(interval);
  }, [setTheme]);

  // Live search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results = allMembers
      .filter((m) => {
        const name = m.name || "";
        const email = m.email || "";
        const program = m.program || m.plan_amount_display || "";
        const status = m.status || "";
        const source = m.source || "";
        const notes = m.notes || "";
        return (
          name.toLowerCase().includes(q) ||
          email.toLowerCase().includes(q) ||
          program.toLowerCase().includes(q) ||
          status.toLowerCase().includes(q) ||
          source.toLowerCase().includes(q) ||
          notes.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
    setSearchResults(results);
    setShowResults(true);
  }, [searchQuery, allMembers]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectResult = (id: string) => {
    setSearchQuery("");
    setShowResults(false);
    navigate(isCCK ? `/communicake/members/${id}` : `/members/${id}`);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setShowResults(false);
    inputRef.current?.focus();
  };

  if (!mounted) return null;

  const allNavItems = isCCK
    ? [
        { name: "Command Center", path: "/communicake", icon: LayoutDashboard },
        { name: "All Members", path: "/communicake/members", icon: Users },
        { name: "Analytics", path: "/communicake/analytics", icon: BarChart3 },
        { name: "Settings", path: "/communicake/settings", icon: Settings },
      ]
    : [
        { name: "Command Center", path: "/", icon: LayoutDashboard },
        { name: "All Members", path: "/members", icon: Users },
        { name: "Analytics", path: "/analytics", icon: BarChart3 },
        { name: "Settings", path: "/settings", icon: Settings },
      ];

  // Staff can't see Analytics or Settings
  const navItems = staff
    ? allNavItems.filter(
        (item) => item.name !== "Analytics" && item.name !== "Settings",
      )
    : allNavItems;

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar — portal style: light, thin border */}
      <aside
        className={`bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 relative border-r border-border h-screen sticky top-0 ${isCollapsed ? "w-[72px]" : "w-60"}`}
      >
        {/* Logo / Hub Toggle */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border">
          {isCollapsed ? (
            <button
              onClick={() => navigate(isCCK ? "/" : "/communicake")}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-secondary transition-colors"
              title={`Switch to ${isCCK ? "RFA" : "Communicake"} Hub`}
            >
              <img
                src={
                  isCCK
                    ? "https://vibe.filesafe.space/1779332359274605986/attachments/db28c01b-18d2-492d-8c93-964605532e80.png"
                    : "https://vibe.filesafe.space/1779332359274605986/attachments/74502442-5b62-407d-a898-1bd12073db0a.png"
                }
                alt="Logo"
                className="w-5 h-5 object-contain rounded"
              />
            </button>
          ) : (
            <button
              onClick={() => navigate(isCCK ? "/" : "/communicake")}
              className="relative flex items-center rounded-full p-0.5 transition-all duration-300 bg-muted"
              title={`Switch to ${isCCK ? "RFA" : "Communicake"} Hub`}
            >
              {/* Sliding pill indicator */}
              <span
                className="absolute top-0.5 bottom-0.5 rounded-full transition-all duration-300 ease-in-out shadow-sm"
                style={{
                  width: "calc(50% - 2px)",
                  left: isCCK ? "2px" : "calc(50%)",
                  background: isCCK ? "hsl(342 75% 58%)" : "hsl(42 76% 50%)",
                }}
              />
              <span
                className={cn(
                  "relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-300 text-sm",
                  isCCK
                    ? "text-white font-medium"
                    : "text-muted-foreground font-normal",
                )}
              >
                <img
                  src="https://vibe.filesafe.space/1779332359274605986/attachments/db28c01b-18d2-492d-8c93-964605532e80.png"
                  alt="CCK"
                  className="w-4 h-4 object-contain rounded shrink-0"
                />
                <span className="text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap">
                  CCK
                </span>
              </span>
              <span
                className={cn(
                  "relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-300 text-sm",
                  !isCCK
                    ? "text-white font-medium"
                    : "text-muted-foreground font-normal",
                )}
              >
                <img
                  src="https://vibe.filesafe.space/1779332359274605986/attachments/74502442-5b62-407d-a898-1bd12073db0a.png"
                  alt="RFA"
                  className="w-4 h-4 object-contain rounded shrink-0"
                />
                <span className="text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap">
                  RFA
                </span>
              </span>
            </button>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-3 top-[72px] h-6 w-6 rounded-full border border-border bg-background z-10 hover:bg-secondary text-muted-foreground hover:text-foreground"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>

        {/* Navigation — portal style: subtle active tint, group labels */}
        <nav className="flex-1 py-5 space-y-1 overflow-hidden">
          {!isCollapsed && (
            <p className="px-4 mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Overview
            </p>
          )}

          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 py-2 transition-all duration-150 rounded-md",
                  isCollapsed ? "px-2 justify-center mx-2" : "px-4 mx-3",
                  isActive
                    ? "bg-secondary text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                )}
              >
                <Icon
                  className={cn("w-4 h-4 shrink-0", isActive && "text-primary")}
                />
                {!isCollapsed && (
                  <span className="truncate text-sm">{item.name}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-border mt-auto">
          {!isCollapsed && userEmail && (
            <p
              className="text-xs text-muted-foreground truncate mb-2 px-1"
              title={userEmail}
            >
              {userEmail}
            </p>
          )}
          <button
            onClick={() => {
              supabase.auth.signOut().then(() => {
                window.location.href = LOGIN_URL;
              });
            }}
            className={cn(
              "flex items-center gap-3 py-2 text-muted-foreground hover:text-red-500 transition-all rounded-md",
              isCollapsed ? "px-2 justify-center" : "px-4",
            )}
            title="Sign out"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && (
              <span className="text-xs font-medium uppercase tracking-wider">
                Sign Out
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Topbar — portal style: clean, minimal */}
        <header className="h-14 border-b border-border bg-background flex items-center justify-between px-6 shrink-0 z-50">
          {isOnSettingsPage ? (
            <div className="flex-1" />
          ) : (
            <div ref={searchRef} className="relative w-full max-w-sm">
              <div className="flex items-center gap-2 rounded-md bg-background border border-border px-3 py-1.5 focus-within:border-primary/40 transition-all">
                <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search members..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery.trim() && setShowResults(true)}
                />
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {showResults && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card rounded-lg overflow-hidden z-50 border border-border shadow-lg">
                  {searchResults.length > 0 ? (
                    <>
                      <div className="px-3 py-2 border-b border-border">
                        <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                          {searchResults.length} result
                          {searchResults.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {searchResults.map((member) => (
                        <button
                          key={member.id}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/60 transition-colors text-left"
                          onClick={() => handleSelectResult(member.id)}
                        >
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-semibold text-primary">
                              {(member.name || "U")
                                .split(" ")
                                .map((n) => n?.[0] || "")
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {member.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {member.program}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 ${getStatusColor(member.status)}`}
                          >
                            {member.status}
                          </Badge>
                        </button>
                      ))}
                    </>
                  ) : (
                    <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                      No results found
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 ml-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground h-8 w-8"
                >
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-card border-border"
              >
                <DropdownMenuItem
                  onClick={() => setTheme("light")}
                  className="cursor-pointer"
                >
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("dark")}
                  className="cursor-pointer"
                >
                  Dark
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("system")}
                  className="cursor-pointer"
                >
                  System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {!isOnSettingsPage && !staff && (
              <Link to={isCCK ? "/communicake/members/new" : "/members/new"}>
                <Button
                  className="bg-foreground text-background hover:bg-foreground/90 text-xs font-medium"
                  size="sm"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add New Member
                </Button>
              </Link>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8 relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
