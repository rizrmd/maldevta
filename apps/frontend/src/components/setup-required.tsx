import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export function SetupRequired() {
  const [, setLocation] = useLocation();

  const goToSetup = () => {
    setLocation("/admin-setup");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-none">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold">Welcome to MalDevTa</CardTitle>
            <CardDescription className="text-base">
              Your AI workspace is ready to be configured. Let's get you set up in just a few steps.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-4 pb-6">
          <div className="rounded-lg bg-secondary/50 p-4 text-sm text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">What we'll do:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Verify your license key</li>
              <li>Create your first workspace (tenant)</li>
              <li>Set up your admin account</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={goToSetup} className="w-full" size="lg">
            Start Setup
          </Button>
        </CardFooter>
      </Card>
      
      <div className="fixed bottom-4 text-center text-xs text-muted-foreground w-full">
        Powered by MalDevTa Engine
      </div>
    </div>
  );
}
