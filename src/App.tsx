import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Layout } from "@/components/Layout";
import { AuthGate } from "@/components/AuthGate";
import { isStaff } from "@/lib/store";
import Index from "./pages/Index";
import Members from "./pages/Members";
import CommunicakeIndex from "./pages/CommunicakeIndex";
import CommunicakeMembers from "./pages/CommunicakeMembers";
import NewCommunicakeMember from "./pages/NewCommunicakeMember";
import CommunicakeMemberProfile from "./pages/CommunicakeMemberProfile";
import NewMember from "./pages/NewMember";
import MemberProfile from "./pages/MemberProfile";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function StaffGuard({ children }: { children: React.ReactNode }) {
  if (isStaff()) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center max-w-md">
          <p className="text-lg font-semibold text-foreground">
            You don't have access to this page
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthGate>
              <Routes>
                <Route path="/onboarding" element={<Onboarding />} />
                <Route element={<Layout />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/members" element={<Members />} />
                  <Route path="/members/new" element={<NewMember />} />
                  <Route path="/members/:id" element={<MemberProfile />} />
                  <Route
                    path="/analytics"
                    element={
                      <StaffGuard>
                        <Analytics />
                      </StaffGuard>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <StaffGuard>
                        <Settings />
                      </StaffGuard>
                    }
                  />

                  <Route path="/communicake" element={<CommunicakeIndex />} />
                  <Route
                    path="/communicake/members"
                    element={<CommunicakeMembers />}
                  />
                  <Route
                    path="/communicake/members/new"
                    element={<NewCommunicakeMember />}
                  />
                  <Route
                    path="/communicake/members/:id"
                    element={<CommunicakeMemberProfile />}
                  />
                  <Route
                    path="/communicake/analytics"
                    element={
                      <StaffGuard>
                        <Analytics />
                      </StaffGuard>
                    }
                  />
                  <Route
                    path="/communicake/settings"
                    element={
                      <StaffGuard>
                        <Settings />
                      </StaffGuard>
                    }
                  />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthGate>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
