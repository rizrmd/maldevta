import { Wallet, CreditCard, Clock, RefreshCw, DollarSign, FileText } from "lucide-react";
import AppLayout from "@/components/app-layout";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function PaymentPage() {
  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Payment</BreadcrumbPage>
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
                Payment Management
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage your transactions and payment methods
              </p>
            </div>
          </div>

          {/* Under Development Notice */}
          <Card className="border-slate-200 bg-white/80 backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                  <Wallet className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-slate-900">Payment Under Development</CardTitle>
                  <CardDescription className="text-slate-500">
                    This page is currently being built. Features coming soon:
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Payment Methods */}
                <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <CreditCard className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-slate-900">Payment Methods</h3>
                    <p className="text-sm text-slate-500">
                      Add and manage credit cards, debit cards, and other payment options
                    </p>
                  </div>
                </div>

                {/* Transaction History */}
                <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <Clock className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-slate-900">Transaction History</h3>
                    <p className="text-sm text-slate-500">
                      View complete history of all your transactions and payments
                    </p>
                  </div>
                </div>

                {/* Invoice Payments */}
                <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <FileText className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-slate-900">Invoice Payments</h3>
                    <p className="text-sm text-slate-500">
                      Pay outstanding invoices or schedule automatic payments
                    </p>
                  </div>
                </div>

                {/* Payment Scheduling */}
                <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <RefreshCw className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-slate-900">Payment Scheduling</h3>
                    <p className="text-sm text-slate-500">
                      Set up automatic payments and customize payment schedules
                    </p>
                  </div>
                </div>

                {/* Refund Requests */}
                <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <DollarSign className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-slate-900">Refund Requests</h3>
                    <p className="text-sm text-slate-500">
                      Request refunds and track status of refund requests
                    </p>
                  </div>
                </div>

                {/* Payment Receipts */}
                <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <FileText className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-slate-900">Payment Receipts</h3>
                    <p className="text-sm text-slate-500">
                      Download payment receipts and tax documents
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
