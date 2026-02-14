import * as React from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { useLocation } from "wouter";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function NavMain({
  label,
  items,
}: {
  label?: string;
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
    isActive?: boolean;
    defaultOpen?: boolean;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}) {
  const [location] = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [openMap, setOpenMap] = React.useState<Record<string, boolean>>({});

  return (
    <SidebarGroup className="py-0">
      {label && state !== "collapsed" && (
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
      )}
      <SidebarMenu>
        {items.map((item) => {
          // Check if this item or any sub-item is active based on current URL
          const isSubActive =
            item.items?.some((subItem) =>
              location.startsWith(subItem.url)
            ) ?? false;
          const isActive =
            item.isActive ||
            location === item.url ||
            location.startsWith(item.url + "/") ||
            isSubActive;

          const userOpen = openMap[item.url];
          const isOpen =
            userOpen !== undefined
              ? userOpen
              : isActive || isSubActive || !!item.defaultOpen;

          // Simple menu item (no sub-items)
          if (!item.items || item.items.length === 0) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={isActive}
                >
                  <a href={item.url}>
                    {item.icon && <item.icon className="!size-5" />}
                    {!isCollapsed && (
                      <span className="font-medium">{item.title}</span>
                    )}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          }

          // Collapsible menu item (with sub-items)
          return (
            <Collapsible
              key={item.title}
              asChild
              open={isOpen}
              onOpenChange={(next) =>
                setOpenMap((prev) => ({ ...prev, [item.url]: next }))
              }
              className="group/collapsible transition-all duration-300 ease-in-out data-[state=open]:mb-2"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild disabled={isCollapsed}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={isActive}
                    className="transition-colors duration-200"
                  >
                    {item.icon && (
                      <item.icon className="!size-5 transition-transform duration-300 group-data-[state=open]/collapsible:scale-110" />
                    )}
                    {!isCollapsed && (
                      <span className="font-medium">{item.title}</span>
                    )}
                    <ChevronRight
                      className={`ml-auto transition-transform duration-300 group-data-[state=open]/collapsible:rotate-90 ${
                        isCollapsed ? "hidden" : ""
                      }`}
                    />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isCollapsed ? "hidden" : ""
                  }`}
                >
                  <SidebarMenuSub className="mt-1">
                    {item.items?.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={location.startsWith(subItem.url)}
                          className="transition-colors duration-200"
                        >
                          <a href={subItem.url}>
                            <span>{subItem.title}</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
