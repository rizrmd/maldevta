"use client";

import * as React from "react"
import { type LucideIcon } from "lucide-react"
import {
  Code,
  MessageCircle,
  Library,
  History,
  Folder,
  CreditCard,
  DollarSign,
  Building2,
} from "lucide-react"
import { useLocation } from "wouter"
import { NavMain } from "@/components/nav-main"
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
import { useProjectStore, useAuthStore } from "@/stores";
import { cn } from "@/lib/utils"
// Import reusable icon
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon"

interface MenuItem {
  title: string
  url: string
  icon?: LucideIcon
  items?: MenuItem[]
  defaultOpen?: boolean
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { currentProject, projects, loadProjects, hasInitialized } = useProjectStore();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "admin";
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [pathname] = useLocation();

  const appName = React.useState<string>("Maldevta")[0];
  const logoUrl = React.useState<string | null>(null)[0];

  // === URL-BASED PROJECT DETECTION ===
  // Determine if we're on a project page based on URL, not Zustand store
  const [isInProjectPage, setIsInProjectPage] = React.useState(false);
  const [urlProjectId, setUrlProjectId] = React.useState<string>("");

  // Effect to detect project pages from URL
  React.useEffect(() => {
    const init = async () => {
      // Load projects if not yet initialized
      if (!hasInitialized) {
        await loadProjects();
      }
    };

    init();

    // Project pages with projectId in URL:
    // /chat/:projectId, /projects/:projectId/*, /api/:projectId, /embed/:projectId, /settings/context/:projectId, /whatsapp/:projectId, /extensions/:projectId
    const projectPagePatterns = [
      /^\/chat\/([^\/]+)/,  // /chat/:projectId
      /^\/projects\/([^\/]+)\//,  // /projects/:projectId/*
      /^\/api\/([^\/]+)/,  // /api/:projectId
      /^\/embed\/([^\/]+)/,  // /embed/:projectId
      /^\/settings\/context\/([^\/]+)/,  // /settings/context/:projectId
      /^\/whatsapp\/([^\/]+)/,  // /whatsapp/:projectId
      /^\/extensions\/([^\/]+)/,  // /extensions/:projectId
    ];

    let matchedProjectId = "";
    const onProjectPage = projectPagePatterns.some(pattern => {
      const match = pathname.match(pattern);
      if (match) {
        matchedProjectId = match[1];
        return true;
      }
      return false;
    });

    setIsInProjectPage(onProjectPage);
    setUrlProjectId(matchedProjectId);

    // Also sync project with Zustand if URL contains project ID
    if (onProjectPage && matchedProjectId) {
      // Sync project with Zustand store
      const storeCurrentProject = useProjectStore.getState().currentProject;
      if (storeCurrentProject?.id !== matchedProjectId) {
        // Try to find project in loaded projects
        const project = projects.find(p => p.id === matchedProjectId);
        if (project) {
          console.log('[AppSidebar] Syncing project:', matchedProjectId);
          useProjectStore.getState().selectProject(matchedProjectId);
        }
      }
    }
  }, [pathname, projects, hasInitialized, loadProjects]);

  // Get the effective project to use for generating URLs
  // Prefer currentProject from store, but fall back to urlProjectId from URL
  const effectiveProject = currentProject || (urlProjectId ? projects.find(p => p.id === urlProjectId) : null);

  // === MENU SAAT TIDAK ADA PROJECT (Project Selector) ===
  // Hanya muncul: Projects, Billing, Payment (admin only)
  const projectSelectorItems = React.useMemo(() => {
    if (isInProjectPage) return [];

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
        title: "Tenants",
        url: "/admin/tenants",
        icon: Building2,
      });

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
  }, [isAdmin, isInProjectPage]);

  // === PLATFORM MENU (SAAT DI PROJECT PAGE) ===
  // Chat, History, Workspace (admin only - collapsible)
  const platformItems = React.useMemo(() => {
    if (!isInProjectPage) return [];

    const items: MenuItem[] = [
      {
        title: "Chat",
        url: effectiveProject ? `/chat/${effectiveProject.id}` : "/chat",
        icon: MessageCircle,
      },
      {
        title: "History",
        url: effectiveProject ? `/projects/${effectiveProject.id}/history` : "/history",
        icon: History,
      }
    ];

    // Workspace for admin only - collapsible like AIBase
    if (isAdmin) {
      items.push({
        title: "Workspace",
        url: effectiveProject ? `/settings/context/${effectiveProject.id}` : "/settings/context",
        icon: Library,
        items: [
          {
            title: "Context",
            url: effectiveProject ? `/settings/context/${effectiveProject.id}` : "/settings/context",
          },
          {
            title: "Files",
            url: effectiveProject ? `/projects/${effectiveProject.id}/files` : "/files",
          },
          {
            title: "Memory",
            url: effectiveProject ? `/projects/${effectiveProject.id}/memory` : "/memory",
          }
        ]
      });
    }

    return items;
  }, [isInProjectPage, effectiveProject, isAdmin]);

  // === MANAGEMENT MENU (SAAT DI PROJECT PAGE - ADMIN ONLY) ===
  // Items khusus untuk project yang sedang aktif
  const managementItems = React.useMemo(() => {
    if (!isInProjectPage) return [];
    if (!isAdmin) return [];

    const items: MenuItem[] = [];

    // WhatsApp (khusus project yang aktif)
    items.push({
      title: "WhatsApp",
      url: effectiveProject ? `/whatsapp/${effectiveProject.id}` : "/whatsapp",
      icon: WhatsAppIcon as LucideIcon,
    });

    // Sub Client (collapsible) - exact structure from AIBase
    items.push({
      title: "Sub Client",
      url: "/sub-clients",
      icon: Building2,
      items: [
        {
          title: "Management",
          url: "/sub-clients/management",
        },
        {
          title: "Settings",
          url: "/sub-clients/settings",
        },
      ]
    });

    // Developer (collapsible) - exact structure from AIBase
    items.push({
      title: "Developer",
      url: "/developer",
      icon: Code,
      items: [
        {
          title: "API",
          url: effectiveProject ? `/api/${effectiveProject.id}` : "/api",
        },
        {
          title: "Embed",
          url: effectiveProject ? `/embed/${effectiveProject.id}` : "/embed",
        },
        {
          title: "Extensions",
          url: effectiveProject ? `/extensions/${effectiveProject.id}` : "/extensions",
        },
      ]
    });

    return items;
  }, [isInProjectPage, isAdmin, effectiveProject]);


  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border bg-sidebar" {...props}>
      <SidebarHeader className={cn("border-b border-border/50 transition-all duration-200", isCollapsed ? "p-2" : "p-4")}>
        <TeamSwitcher
          appName={appName}
          currentProjectName={effectiveProject?.name}
          logoUrl={logoUrl}
          isSelectable={isInProjectPage}
        />
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {/* Saat tidak ada project: Menu sederhana (Projects, Billing, Payment) */}
        {!isInProjectPage && projectSelectorItems.length > 0 && (
          <div className="px-3">
            <NavMain label="Platform" items={projectSelectorItems} />
          </div>
        )}

        {/* Saat ada project: Platform menu (Chat, History, Workspace) */}
        {isInProjectPage && platformItems.length > 0 && (
          <div className="px-3">
            <NavMain label="Platform" items={platformItems} />
          </div>
        )}

        {/* Saat ada project: Management menu (admin only, project-specific) */}
        {isInProjectPage && managementItems.length > 0 && (
          <div className="mt-4 px-3">
            <NavMain label="Management" items={managementItems} />
          </div>
        )}
      </SidebarContent>



      <SidebarFooter className={cn("border-t border-border/50 transition-all duration-200", isCollapsed ? "p-2" : "p-4")}>
        {user && (
          <NavUser
            user={{
              name: user.username || user.userId || "User",
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
