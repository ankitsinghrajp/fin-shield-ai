import { Link, useLocation } from "react-router-dom";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDispatch, useSelector } from "react-redux";
import { useLogoutMutation } from "@/redux/api/api";
import { userNotExists } from "@/redux/reducers/auth";
import { toast } from "sonner";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Navbar = () => {
  const { pathname } = useLocation();
  const onApp = pathname !== "/" && pathname !== "/signin" && pathname !== "/signup";
  const onDashboard = pathname === "/dashboard";

  const { user } = useSelector((state: any) => state.auth);
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);

  const [logout, { isLoading }] = useLogoutMutation();

  const logoutHandler = async () => {
    const res = await logout().unwrap();
    if (res.statusCode === 200) {
      toast.success(res.message || "Logout Successful!");
      dispatch(userNotExists());
    }
    setOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/40 glass">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 blur-md rounded-full group-hover:bg-primary/50 transition" />
              <Shield className="relative h-7 w-7 text-primary" strokeWidth={2.2} />
            </div>
            <span className="font-bold text-lg tracking-tight">
              Fin<span className="text-gradient-primary">Shield</span>
              <span className="ml-1 text-xs font-mono text-muted-foreground align-top">AI</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            {!onApp ? (
              <>
                <a href="#features" className="text-muted-foreground hover:text-foreground transition">Features</a>
                <a href="#how" className="text-muted-foreground hover:text-foreground transition">How it works</a>
                <a href="#trust" className="text-muted-foreground hover:text-foreground transition">Trust</a>
              </>
            ) : (
              <>
                {onDashboard ? (
                  <Link to="/" className="text-muted-foreground hover:text-foreground transition">Home</Link>
                ) : (
                  <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition">Dashboard</Link>
                )}
                <Link to="/history" className="text-muted-foreground hover:text-foreground transition">History</Link>
              </>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <Button
                onClick={() => setOpen(true)}
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging out...
                  </>
                ) : (
                  "Logout"
                )}
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/signin">Sign in</Link>
                </Button>
                <Button size="sm" asChild className="bg-gradient-primary text-primary-foreground hover:opacity-90 btn-glow shadow-glow-primary">
                  <Link to="/signup">Sign up</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to logout? You'll need to sign in again to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={logoutHandler} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging out...
                </>
              ) : (
                "Logout"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};