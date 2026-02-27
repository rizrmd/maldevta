import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAuthStore } from "@/stores/authStore";

export default function SubClientRedirectPage() {
  const { shortPath } = useParams<{ shortPath: string }>();
  const [, setLocation] = useLocation();
  const { user, checkSession } = useAuthStore();

  useEffect(() => {
    const initialize = async () => {
      // Check session first
      await checkSession();

      // If user is authenticated and is a sub-client user, go to chat
      if (user && user.scopeType === "sub_client_user") {
        setLocation(`/s/${shortPath}/chat`, { replace: true });
      } else {
        // Otherwise, redirect to login
        setLocation(`/s/${shortPath}/login`, { replace: true });
      }
    };

    initialize();
  }, [shortPath, user, checkSession, setLocation]);

  // Show loading while redirecting
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', padding: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div style={{ height: '48px', width: '48px', borderRadius: '50%', border: '4px solid #e5e7eb', borderTopColor: '#000000', animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: '16px', color: '#374151', fontWeight: 500 }}>Loading...</p>
      </div>
    </div>
  );
}
