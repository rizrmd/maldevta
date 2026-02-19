import AppLayout from "@/components/app-layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LLMEndpointsPage() {
  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>LLM Endpoints</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <div className="mx-auto w-full max-w-4xl">
        <Card className="border-slate-200 bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle>LLM Endpoints</CardTitle>
            <CardDescription>
              Manage provider endpoints and tenant allocations for AI routing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Endpoint management UI will be added here.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
