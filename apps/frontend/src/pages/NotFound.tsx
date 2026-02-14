import AppLayout from "@/components/app-layout";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NotFoundPage() {
  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>404 Not Found</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden rounded-2xl border bg-gradient-to-br from-[#f7f2ea] via-white to-[#e6f7f1] p-6">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#ffd7a8]/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-16 h-72 w-72 rounded-full bg-[#9fe7d4]/70 blur-3xl" />

        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Page not found</CardTitle>
              <CardDescription>
                The page you're looking for doesn't exist.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                <a
                  href="/"
                  className="font-medium text-primary hover:underline"
                >
                  Go back to home
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
