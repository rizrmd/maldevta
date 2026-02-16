"use client";

import * as React from "react"
import { type LucideIcon } from "lucide-react"
import {
  Code,
  MessageCircle,
  Library,
  History,
  MessageSquare,
  Folder,
  CreditCard,
  DollarSign,
  Building2,
} from "lucide-react"
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
  const { currentProject, projects } = useProjectStore();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "admin";
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const appName = React.useState<string>("Maldevta")[0];
  const logoUrl = React.useState<string | null>(null)[0];

  // === URL-BASED PROJECT DETECTION ===
  // Determine if we're on a project page based on URL, not Zustand store
  const [isInProjectPage, setIsInProjectPage] = React.useState(false);

  // Effect to detect project pages from URL
  React.useEffect(() => {
    const pathname = window.location.pathname;

    // Project pages: /chat/:id, /files, /memory, /history, /settings/context, /whatsapp, /extensions, /developer
    // Non-project pages: /, /projects, /dashboard, /chats, /billing, /payment
    const projectPagePatterns = [
      /^\/chat(\/|$)/,
      /^\/files/,
      /^\/memory/,
      /^\/history/,
      /^\/settings\/context/,
      /^\/whatsapp/,
      /^\/extensions/,
      /^\/developer/,
      /^\/api/,
      /^\/embed/,
      /^\/sub-clients/,
    ];

    const onProjectPage = projectPagePatterns.some(pattern => pattern.test(pathname));
    setIsInProjectPage(onProjectPage);

    // Also sync project with Zustand if URL contains project ID
    if (onProjectPage) {
      const pathMatch = pathname.match(/^\/chat\/([^\/]+)/);
      if (pathMatch && pathMatch[1]) {
        const projectId = pathMatch[1];
        const project = projects.find(p => p.id === projectId);
        if (project && currentProject?.id !== projectId) {
          useProjectStore.getState().selectProject(projectId);
        }
      }
    }
  }, [projects, currentProject]);

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
        url: currentProject ? `/chat/${currentProject.id}` : "/chat",
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
  }, [isInProjectPage, currentProject, isAdmin]);

  // === MANAGEMENT MENU (SAAT DI PROJECT PAGE - ADMIN ONLY) ===
  // Items khusus untuk project yang sedang aktif
  const managementItems = React.useMemo(() => {
    if (!isInProjectPage) return [];
    if (!isAdmin) return [];

    const items: MenuItem[] = [];

    // WhatsApp (khusus project yang aktif)
    items.push({
      title: "WhatsApp",
      url: "/whatsapp",
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
          url: "/api",
        },
        {
          title: "Embed",
          url: "/embed",
        },
        {
          title: "Extensions",
          url: "/extensions",
        },
      ]
    });

    // Settings (collapsible)
    items.push({
      title: "Settings",
      url: "/settings",
      icon: Settings2,
      items: [
        {
          title: "General",
          url: "/settings/general",
        },
        {
          title: "Context",
          url: "/settings/context",
        },
        {
          title: "Projects",
          url: "/settings/projects",
        },
        {
          title: "Profile",
          url: "/settings/profile",
        },
      ],
    });

    return items;
  }, [isInProjectPage, isAdmin]);


  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border bg-sidebar" {...props}>
      <SidebarHeader className={cn("border-b border-border/50 transition-all duration-200", isCollapsed ? "p-2" : "p-4")}>
        <TeamSwitcher
          appName={appName}
          currentProjectName={currentProject?.name}
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
