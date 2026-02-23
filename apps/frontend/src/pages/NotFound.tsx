import { Link } from "wouter";
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
                <Link
                  href="/"
                  className="font-medium text-primary hover:underline"
                >
                  Go back to home
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
    </AppLayout>
  );
}
