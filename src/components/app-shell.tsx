"use client";

import { useState } from "react";
import {
  Briefcase,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  Settings,
  Users,
} from "lucide-react";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/shared";
import { apiClient, SessionUser } from "@/lib/client";
import { Area, can } from "@/lib/permissions";
import { PermissionsProvider } from "@/lib/permissions-context";
import { useOrg } from "@/lib/org-context";
import { cn } from "@/lib/utils";
import { DashboardView } from "@/components/dashboard-view";
import { JobsView, JobDetailView } from "@/components/jobs-view";
import { CandidatesView, CandidateDetailView } from "@/components/candidates-view";
import { ApplicationsView } from "@/components/applications-view";
import { InterviewsView } from "@/components/interviews-view";
import { settingsTabAllowed, SETTINGS_TABS, SettingsTab, SettingsView } from "@/components/settings-view";
import { ClassificationView } from "@/components/classification-view";

import { LanguageSwitcher, useI18n } from "@/lib/i18n";
export type NavState =
  | { view: "dashboard" }
  | { view: "jobs" }
  | { view: "job-detail"; jobId: string }
  | { view: "candidates" }
  | { view: "candidate-detail"; candidateId: string }
  | { view: "applications"; focusApplicationId?: string }
  | { view: "interviews" }
  | { view: "classification" }
  | { view: "settings"; tab?: SettingsTab; accessId?: string };

type NavItem = { view: NavState["view"]; label: string; icon: typeof LayoutDashboard; area?: Area };
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Recruitment",
    items: [
      { view: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { view: "jobs", label: "Jobs", icon: Briefcase, area: "jobs" },
      { view: "candidates", label: "Candidates", icon: Users, area: "candidates" },
      { view: "applications", label: "Applications", icon: ClipboardList, area: "applications" },
      { view: "interviews", label: "Interviews", icon: CalendarDays, area: "interviews" },
    ],
  },
  { title: "Setup", items: [{ view: "classification", label: "Classification", icon: Layers, area: "classification" }] },
];

function SidebarContent({
  nav,
  user,
  onNavigate,
}: {
  nav: NavState;
  user: SessionUser;
  onNavigate: (state: NavState) => void;
}) {
  const { t } = useI18n();
  const { org } = useOrg();
  const activeView = nav.view;
  const activeTab: SettingsTab = nav.view === "settings" ? nav.tab ?? "profile" : "profile";
  const [settingsOpen, setSettingsOpen] = useState(activeView === "settings");
  const open = settingsOpen || activeView === "settings";
  const tabs = SETTINGS_TABS.filter((x) => settingsTabAllowed(x, user));

  const itemClass = (active: boolean) =>
    cn(
      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    );

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <button
        className="flex items-center gap-3 px-5 pb-4 pt-6 text-start text-sidebar-foreground"
        onClick={() => onNavigate({ view: "dashboard" })}
      >
        <img src={org.logoUrl} alt="" className="h-9 w-9 object-contain" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold tracking-tight">{org.name}</span>
          {org.tagline && <span className="block text-[10px] leading-tight text-muted-foreground">{org.tagline}</span>}
        </span>
      </button>

      {/* Nav (scrolls when the menu is long; leaves room for the user bar) */}
      <nav className="thin-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-20 pt-2" aria-label={t("Main navigation")}>
        {NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((i) => !i.area || can(user.permissions, i.area, "view")) }))
          .filter((group) => group.items.length > 0)
          .map((group) => (
          <div key={group.title} className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">{t(group.title)}</p>
            {group.items.map(({ view, label, icon: Icon }) => {
              const active =
                view === activeView ||
                (view === "jobs" && activeView === "job-detail") ||
                (view === "candidates" && activeView === "candidate-detail");
              return (
                <button
                  key={view}
                  onClick={() => onNavigate({ view } as NavState)}
                  aria-current={active ? "page" : undefined}
                  className={itemClass(active)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {t(label)}
                </button>
              );
            })}
          </div>
        ))}

        {/* Settings with a submenu */}
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">{t("Administration")}</p>
          <button
            onClick={() => setSettingsOpen((o) => (activeView === "settings" ? true : !o))}
            aria-expanded={open}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              activeView === "settings" ? "text-sidebar-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-start">{t("Settings")}</span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div className="ms-4 space-y-0.5 border-s border-sidebar-border ps-2">
              {tabs.map(({ tab, label, icon: Icon }) => {
                const active = activeView === "settings" && activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => onNavigate({ view: "settings", tab })}
                    aria-current={active ? "page" : undefined}
                    className={cn(itemClass(active), "py-1.5 text-[13px]")}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {t(label)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <LanguageSwitcher className="w-full justify-start gap-2 border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground" />
        </div>
      </nav>
    </div>
  );
}

export function AppShell({
  user,
  onUserChange,
  onLogout,
}: {
  user: SessionUser;
  onUserChange: (user: SessionUser) => void;
  onLogout: () => void;
}) {
  const { t, dir } = useI18n();
  const { org } = useOrg();
  const [nav, setNav] = useState<NavState>({ view: "dashboard" });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);

  const navigate = (state: NavState) => {
    setNav(state);
    setMobileOpen(false);
  };

  async function handleLogout() {
    setLogoutBusy(true);
    try {
      await apiClient.logout();
      toast.success("Signed out");
      onLogout();
    } catch {
      toast.error("Could not sign out. Please try again.");
      setLogoutBusy(false);
    }
  }

  const activeView = nav.view;

  return (
    <PermissionsProvider value={user.permissions}>
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 border-e border-sidebar-border bg-sidebar lg:block">
        <SidebarContent nav={nav} user={user} onNavigate={navigate} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <img src={org.logoUrl} alt="" className="h-7 w-7 object-contain" />
          <span className="text-sm font-bold tracking-tight">{org.name}</span>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label={t("Open navigation menu")}>
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side={dir === "rtl" ? "right" : "left"} className="w-72 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>{t("Navigation")}</SheetTitle>
            </SheetHeader>
            <SidebarContent nav={nav} user={user} onNavigate={navigate} />
          </SheetContent>
        </Sheet>
      </header>

      {/* Main content */}
      <main className="lg:ps-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {activeView === "dashboard" && <DashboardView user={user} onNavigate={navigate} />}
          {activeView === "jobs" && <JobsView onNavigate={navigate} />}
          {activeView === "job-detail" && "jobId" in nav && <JobDetailView jobId={nav.jobId} onNavigate={navigate} />}
          {activeView === "candidates" && <CandidatesView onNavigate={navigate} />}
          {activeView === "candidate-detail" && "candidateId" in nav && (
            <CandidateDetailView candidateId={nav.candidateId} onNavigate={navigate} />
          )}
          {activeView === "applications" && (
            <ApplicationsView
              onNavigate={navigate}
              focusApplicationId={"focusApplicationId" in nav ? nav.focusApplicationId : undefined}
            />
          )}
          {activeView === "interviews" && <InterviewsView onNavigate={navigate} />}
          {activeView === "classification" && <ClassificationView />}
          {activeView === "settings" && <SettingsView user={user} onUserChange={onUserChange} tab={"tab" in nav ? nav.tab : undefined} accessId={"accessId" in nav ? nav.accessId : undefined} />}
        </div>
      </main>

      {/* User bar (desktop: bottom-left of sidebar area is inside SidebarContent; mobile: floating) */}
      <div className="fixed bottom-0 start-0 end-0 z-20 flex h-14 items-center justify-between border-t bg-card px-4 lg:start-64 lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
            {user.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{user.name}</p>
            <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setLogoutOpen(true)}>
          <LogOut className="me-1 h-4 w-4" />
          {t("Logout")}
        </Button>
      </div>
      <div className="hidden lg:block">
        <div className="fixed bottom-0 start-0 z-30 w-64 border-t border-sidebar-border bg-sidebar p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/25 text-xs font-semibold text-primary-foreground ring-1 ring-inset ring-white/15">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-sidebar-foreground">{user.name}</p>
                <p className="truncate text-[10px] text-sidebar-foreground/60">{user.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("Log out")}
              onClick={() => setLogoutOpen(true)}
              className="text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      {/* bottom padding for mobile user bar */}
      <div className="h-14 lg:hidden" aria-hidden />

      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title={t("Sign out of {name}?", { name: org.name })}
        description={t("You will need to sign in again to access your workspace.")}
        confirmLabel={t("Sign out")}
        destructive={false}
        onConfirm={handleLogout}
        busy={logoutBusy}
      />
    </div>
    </PermissionsProvider>
  );
}
