import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Providers } from "@/components/providers/providers";
import { useAuth } from "@/components/providers/auth-provider";
import { DriveProvider, useDrive } from "@/components/providers/drive-provider";
import { DriveSetupPrompt } from "@/components/drive/drive-setup-prompt";
import { OrganizationSwitcher } from "@/components/drive/organization-switcher";
import { Sidebar } from "@/components/drive/sidebar";
import { UserMenu } from "@/components/drive/user-menu";
import { Spinner } from "@/components/ui/spinner";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import LoginPage from "@/pages/LoginPage";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import ActivatePage from "@/pages/ActivatePage";
import DrivePage from "@/app/(app)/drive/page";
import SharedPage from "@/app/(app)/shared/page";
import SystemFilesPage from "@/app/(app)/system-files/page";
import TrashPage from "@/app/(app)/trash/page";

function Loading() {
  return <div className="flex min-h-screen flex-1 items-center justify-center"><Spinner className="h-6 w-6" /></div>;
}

function ProtectedLayout() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <Loading />;
  if (status === "unauthenticated") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <DriveProvider><DriveGate /></DriveProvider>;
}

function DriveGate() {
  const { status, error, setupDrive } = useDrive();
  if (status === "checking") return <Loading />;
  if (status === "needs-setup" || status === "error") return <DriveSetupPrompt onSetup={setupDrive} error={error} />;
  return (
    <div className="flex min-h-screen flex-1">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 flex-none items-center justify-end gap-2 border-b border-hairline px-6">
          <OrganizationSwitcher /><ThemeToggle /><UserMenu />
        </header>
        <main className="min-w-0 flex-1"><Outlet /></main>
      </div>
    </div>
  );
}

function Home() {
  const { status } = useAuth();
  if (status === "loading") return <Loading />;
  return <Navigate to={status === "authenticated" ? "/drive" : "/login"} replace />;
}

export default function App() {
  return (
    <Providers>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/callback" element={<AuthCallbackPage />} />
          <Route path="/activate" element={<ActivatePage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/drive" element={<DrivePage />} />
            <Route path="/shared" element={<SharedPage />} />
            <Route path="/system-files" element={<SystemFilesPage />} />
            <Route path="/trash" element={<TrashPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </Providers>
  );
}
