import { Lock, CreditCard, FileText, TrendingUp, AlertCircle } from "lucide-react";
import AppLayout from "@/components/app-layout";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function BillingPage() {
  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Billing</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden rounded-2xl border bg-gradient-to-br from-[#f7f2ea] via-white to-[#e6f7f1] p-6">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#ffd7a8]/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-16 h-72 w-72 rounded-full bg-[#9fe7d4]/70 blur-3xl" />

        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Billing & Payments
              </p>
              <h1 className="font-display text-3xl text-slate-900 md:text-4xl">
                Billing Management
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage your subscription, invoices, and payment methods
              </p>
            </div>
          </div>

          {/* Under Development Notice */}
          <Card className="border-slate-200 bg-white/80 backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                  <Lock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-slate-900">Billing Under Development</CardTitle>
                  <CardDescription className="text-slate-500">
                    This page is currently being built. Features coming soon:
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Subscription Plans */}
                <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <CreditCard className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-slate-900">Subscription Plans</h3>
                    <p className="text-sm text-slate-500">
                      View and manage your subscription plan, upgrade or downgrade as needed
                    </p>
                  </div>
                </div>

                {/* Payment Methods */}
                <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <CreditCard className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-slate-900">Payment Methods</h3>
                    <p className="text-sm text-slate-500">
                      Add, remove, or manage your payment methods and billing details
                    </p>
                  </div>
                </div>

                {/* Invoice History */}
                <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <FileText className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-slate-900">Invoice History</h3>
                    <p className="text-sm text-slate-500">
                      Download and view all your past invoices and payment receipts
                    </p>
                  </div>
                </div>

                {/* Usage Statistics */}
                <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <TrendingUp className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-slate-900">Usage Statistics</h3>
                    <p className="text-sm text-slate-500">
                      Monitor your resource usage and track against plan limits
                    </p>
                  </div>
                </div>

                {/* Billing Alerts */}
                <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <AlertCircle className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-slate-900">Billing Alerts</h3>
                    <p className="text-sm text-slate-500">
                      Configure notifications for billing events and payment reminders
                    </p>
                  </div>
                </div>

                {/* Billing Address */}
                <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <FileText className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-slate-900">Billing Address</h3>
                    <p className="text-sm text-slate-500">
                      Update your billing address and tax information for invoices
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
