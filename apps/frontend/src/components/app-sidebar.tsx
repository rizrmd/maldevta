"use client";

import * as React from "react"
import { type LucideIcon } from "lucide-react"
import {
  Code,
  MessageCircle,
  Library,
  History,
  Puzzle,
  MessageSquare,
  Folder,
  CreditCard,
  DollarSign,
} from "lucide-react"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { useProjectStore } from "@/stores";
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

interface MenuItem {
  title: string
  url: string
  icon?: LucideIcon
  items?: MenuItem[]
  defaultOpen?: boolean
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { currentProject } = useProjectStore();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const appName = React.useState<string>("Maldevta")[0];
  const logoUrl = React.useState<string | null>(null)[0];

  // Check if we're on project selector page (no active project)
  const hasActiveProject = !!currentProject;

  // Generate the URL for the current project
  const getUrl = React.useCallback((_path: string) => {
    if (!currentProject?.id) return "#";
    return `/chat/${currentProject.id}`;
  }, [currentProject]);

  // === MENU SAAT TIDAK ADA PROJECT YANG DIPILIH (Project Selector) ===
  // Hanya muncul: Projects, Billing, Payment (admin only)
  const projectSelectorItems = React.useMemo(() => {
    const items: MenuItem[] = [
      {
        title: "Projects",
        url: "/",
        icon: Folder,
      }
    ];

    // Admin-only items when no project selected
    if (isAdmin) {
      items.push({
        title: "Billing",
        url: "/billing",
        icon: CreditCard,
      });

      items.push({
        title: "Payment",
        url: "/payment",
        icon: DollarSign,
      });
    }

    return items;
  }, [isAdmin]);

  // === PLATFORM MENU (SAAT ADA PROJECT YANG DIPILIH) ===
  // Chat, History, Workspace (admin only - collapsible)
  const platformItems = React.useMemo(() => {
    if (!hasActiveProject) return [];

    const items: MenuItem[] = [
      {
        title: "Chat",
        url: getUrl("chat"),
        icon: MessageCircle,
      },
      {
        title: "History",
        url: "/history",
        icon: History,
      }
    ];

    // Workspace for admin only - collapsible like AIBase
    if (isAdmin) {
      items.push({
        title: "Workspace",
        url: "/settings/context",
        icon: Library,
        items: [
          {
            title: "Context",
            url: "/settings/context",
          },
          {
            title: "Files",
            url: "/files",
          },
          {
            title: "Memory",
            url: "/memory",
          }
        ]
      });
    }

    return items;
  }, [hasActiveProject, getUrl, isAdmin]);

  // === MANAGEMENT MENU (SAAT ADA PROJECT YANG DIPILIH - ADMIN ONLY) ===
  // Items khusus untuk project yang sedang aktif
  const managementItems = React.useMemo(() => {
    if (!hasActiveProject) return [];
    if (!isAdmin) return [];

    const items: MenuItem[] = [];

    // WhatsApp Dashboard (khusus project yang aktif)
    items.push({
      title: "WhatsApp",
      url: "/dashboard",
      icon: MessageSquare,
    });

    // WhatsApp Chats (khusus project yang aktif)
    items.push({
      title: "WhatsApp Chats",
      url: "/chats",
      icon: MessageSquare,
    });

    // Developer (exact structure from AIBase)
    items.push({
      title: "Developer",
      url: "/developer",
      icon: Code,
      items: [
        {
          title: "API",
          url: "/developer",
        },
        {
          title: "Extensions",
          url: "/extensions",
        },
      ]
    });

    return items;
  }, [hasActiveProject, isAdmin]);

  // Secondary nav (bottom) - Support & Feedback (selalu muncul)
  const navSecondary = [
    {
      title: "Support",
      url: "/support",
      icon: Puzzle,
    },
    {
      title: "Feedback",
      url: "/feedback",
      icon: MessageCircle,
    },
  ];

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border bg-sidebar" {...props}>
      <SidebarHeader className={cn("border-b border-border/50 transition-all duration-200", isCollapsed ? "p-2" : "p-4")}>
        <TeamSwitcher
          appName={appName}
          currentProjectName={currentProject?.name || "Select Project"}
          logoUrl={logoUrl}
        />
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {/* Saat tidak ada project: Menu sederhana (Projects, Billing, Payment) */}
        {!hasActiveProject && (
          <div className="px-3">
            <NavMain label="Platform" items={projectSelectorItems} />
          </div>
        )}

        {/* Saat ada project: Platform menu (Chat, History, Workspace) */}
        {hasActiveProject && platformItems.length > 0 && (
          <div className="px-3">
            <NavMain label="Platform" items={platformItems} />
          </div>
        )}

        {/* Saat ada project: Management menu (admin only, project-specific) */}
        {hasActiveProject && managementItems.length > 0 && (
          <div className="mt-4 px-3">
            <NavMain label="Management" items={managementItems} />
          </div>
        )}
      </SidebarContent>

      {/* Secondary nav at bottom - Support & Feedback */}
      <NavSecondary items={navSecondary} className="mt-auto" />

      <SidebarFooter className={cn("border-t border-border/50 transition-all duration-200", isCollapsed ? "p-2" : "p-4")}>
        {user && (
          <NavUser
            user={{
              name: user.userId || "User",
              email: user.role || "member",
              avatar: "",
            }}
          />
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
