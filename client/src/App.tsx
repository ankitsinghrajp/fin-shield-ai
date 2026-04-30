import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Processing from "./pages/Processing.tsx";
import Result from "./pages/Result.tsx";
import History from "./pages/History.tsx";
import NotFound from "./pages/NotFound.tsx";
import SignIn from "./pages/SignIn.tsx";
import SignUp from "./pages/SignUp.tsx";
import ScrollToTop from "./components/specifics/ScrollToTop.tsx";
import { useDispatch, useSelector } from "react-redux";
import { useRefreshTokenMutation } from "./redux/api/api.ts";
import { userExists, userNotExists } from "./redux/reducers/auth.ts";
import { useEffect } from "react";
import ProtectedRoute from "./components/auth/ProtectedRoute.tsx";
import ProcessPage from "./pages/ProcessPage.tsx";
import RunDetailPage from "./pages/RunDetailPage.tsx";

const queryClient = new QueryClient();

const App = () => {
  const { user } = useSelector((state: any) => state.auth);
  const dispatch = useDispatch();
  const [refreshToken] = useRefreshTokenMutation();

  useEffect(() => {
    const restoreSession = async () => {
      try {
        await refreshToken().unwrap();
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          dispatch(userExists(JSON.parse(storedUser)));
        } else {
          dispatch(userNotExists());
        }
      } catch (err) {
        console.log("Session restore failed:", err);
        dispatch(userNotExists());
      }
    };
    restoreSession();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
             <Route path="/process" element={<ProcessPage />} />

            {/* Guest-only routes — redirect to /dashboard if already logged in */}
            <Route element={<ProtectedRoute user={!user} redirect="/dashboard" />}>
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
            </Route>

            {/* Protected routes — redirect to /signin if not logged in */}
            <Route element={<ProtectedRoute user={user} />}>
              <Route path="/processing" element={<Processing />} />
               <Route path="/dashboard" element={<Dashboard />} />
               <Route path="/dashboard/:runId" element={<RunDetailPage/>} />
              <Route path="/result/:id" element={<Result />} />
              <Route path="/history" element={<History />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;