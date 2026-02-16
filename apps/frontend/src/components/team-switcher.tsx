import { ChevronsUpDown, Command, Check, Home } from "lucide-react"
import { cn } from "@/lib/utils"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useLocation } from "wouter"
import { useProjectStore } from "@/stores"

export function TeamSwitcher({
  appName,
  currentProjectName,
  logoUrl,
}: {
  appName: string
  currentProjectName: string
  logoUrl?: string | null
}) {
  const { isMobile, state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const [, navigate] = useLocation()
  const projects = useProjectStore((state) => state.projects)
  const currentProject = useProjectStore((state) => state.currentProject)
  const selectProject = useProjectStore((state) => state.selectProject)

  const handleProjectSelect = (projectId: string) => {
    selectProject(projectId)
    navigate(`/chat/${projectId}`)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className={cn(
                "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground transition-all duration-200",
                isCollapsed ? "justify-center items-center p-0" : ""
              )}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground overflow-hidden shrink-0">
                {logoUrl ? (
                    <img src={logoUrl} alt={appName} className="size-full object-cover"/>
                ) : (
                    <Command className="size-4" />
                )}
              </div>
              {!isCollapsed && (
                <>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {appName}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{currentProjectName}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </>
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            {/* Home / All Projects */}
            <DropdownMenuItem
              onClick={() => navigate("/")}
              className="gap-2 p-2 cursor-pointer"
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Home className="size-4" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">All Projects</div>
                <div className="text-xs text-muted-foreground">View all projects</div>
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* List all projects */}
            {projects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onClick={() => handleProjectSelect(project.id)}
                className="gap-2 p-2 cursor-pointer"
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <Command className="size-4" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{project.name}</div>
                </div>
                {currentProject?.id === project.id && (
                  <Check className="size-4 text-muted-foreground" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
