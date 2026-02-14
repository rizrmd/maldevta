"use client";

import * as React from "react";
import {
  MessageSquare,
  Folder,
  Settings2,
  LifeBuoy,
  Send,
  Clock,
  Database,
  Code,
  Puzzle,
  type LucideIcon,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface MenuItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  defaultOpen?: boolean;
  items?: {
    title: string;
    url: string;
  }[];
}

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // ----- Platform menu items -----
  const platformItems = React.useMemo<MenuItem[]>(() => {
    const items: MenuItem[] = [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: Folder,
      },
      {
        title: "Chats",
        url: "/chats",
        icon: MessageSquare,
      },
      {
        title: "History",
        url: "/history",
        icon: Clock,
      },
    ];

    // Workspace group (admin only)
    if (isAdmin) {
      items.push({
        title: "Workspace",
        url: "/settings/context",
        icon: Database,
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
          },
        ],
      });
    }

    return items;
  }, [isAdmin]);

  // ----- Management menu items (admin only) -----
  const managementItems = React.useMemo<MenuItem[]>(() => {
    if (!isAdmin) return [];

    return [
      {
        title: "Projects",
        url: "/projects",
        icon: Folder,
      },
      {
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
        ],
      },
      {
        title: "Settings",
        url: "/settings",
        icon: Settings2,
        items: [
          {
            title: "General",
            url: "/settings/general",
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
      },
    ];
  }, [isAdmin]);

  // ----- Secondary nav items -----
  const navSecondary = [
    {
      title: "Support",
      url: "/support",
      icon: LifeBuoy,
    },
    {
      title: "Feedback",
      url: "/feedback",
      icon: Send,
    },
  ];

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/dashboard">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Puzzle className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">MaldevtaHub</span>
                  <span className="truncate text-xs">Control Panel</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Platform section */}
        <NavMain label="Platform" items={platformItems} />

        {/* Management section (admin only) */}
        {managementItems.length > 0 && (
          <NavMain label="Management" items={managementItems} />
        )}

        {/* Secondary nav at bottom */}
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser
          user={{
            name: user?.userId || "User",
            email: `${user?.role || "member"}`,
            avatar: "",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
