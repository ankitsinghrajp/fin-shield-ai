import { Link, useLocation } from "react-router-dom";
import { Shield, Loader2, Menu, X } from "lucide-react";
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
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [logout, { isLoading }] = useLogoutMutation();

  const logoutHandler = async () => {
    const res = await logout().unwrap();
    if (res.statusCode === 200) {
      toast.success(res.message || "Logout Successful!");
      dispatch(userNotExists());
    }
    setLogoutOpen(false);
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/40 glass">
        <div className="container">
          {/* ── Main bar ── */}
          <div className="flex h-16 items-center justify-between gap-3">

            {/* Logo */}
            <Link to="/" onClick={closeMenu} className="flex items-center gap-2 group flex-shrink-0">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/30 blur-md rounded-full group-hover:bg-primary/50 transition" />
                <Shield className="relative h-6 w-6 text-primary" strokeWidth={2.2} />
              </div>
              <span className="font-bold text-base tracking-tight">
                Fin<span className="text-gradient-primary">Shield</span>
                <span className="ml-0.5 text-[10px] font-mono text-muted-foreground align-super">AI</span>
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-6 text-sm">
              {!onApp ? (
                <>
                  <a href="#features" className="text-muted-foreground hover:text-foreground transition">Features</a>
                  <a href="#how" className="text-muted-foreground hover:text-foreground transition">How it works</a>
                  <a href="/dashboard" className="text-muted-foreground hover:text-foreground transition">Dashboard</a>
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

            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-2 flex-shrink-0">
              {user ? (
                <Button
                  onClick={() => setLogoutOpen(true)}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Logging out...</>
                  ) : "Logout"}
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

            {/* Mobile hamburger */}
            <button
              className="md:hidden flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {/* ── Mobile drawer ── */}
          {menuOpen && (
            <div className="md:hidden border-t border-border/40 py-4 flex flex-col gap-1 animate-in slide-in-from-top-2 duration-200">
              {/* Mobile nav links */}
              <div className="flex flex-col">
                {!onApp ? (
                  <>
                    <a href="#features" onClick={closeMenu} className="px-1 py-2.5 text-sm text-muted-foreground hover:text-foreground border-b border-border/30 transition">Features</a>
                    <a href="#how" onClick={closeMenu} className="px-1 py-2.5 text-sm text-muted-foreground hover:text-foreground border-b border-border/30 transition">How it works</a>
                    <a href="#trust" onClick={closeMenu} className="px-1 py-2.5 text-sm text-muted-foreground hover:text-foreground transition">Trust</a>
                  </>
                ) : (
                  <>
                    {onDashboard ? (
                      <Link to="/" onClick={closeMenu} className="px-1 py-2.5 text-sm text-muted-foreground hover:text-foreground border-b border-border/30 transition">Home</Link>
                    ) : (
                      <Link to="/dashboard" onClick={closeMenu} className="px-1 py-2.5 text-sm text-muted-foreground hover:text-foreground border-b border-border/30 transition">Dashboard</Link>
                    )}
                    <Link to="/history" onClick={closeMenu} className="px-1 py-2.5 text-sm text-muted-foreground hover:text-foreground transition">History</Link>
                  </>
                )}
              </div>

              {/* Mobile action buttons */}
              <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-border/40">
                {user ? (
                  <Button
                    onClick={() => { setLogoutOpen(true); closeMenu(); }}
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Logging out...</>
                    ) : "Logout"}
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link to="/signin" onClick={closeMenu}>Sign in</Link>
                    </Button>
                    <Button size="sm" className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 btn-glow shadow-glow-primary" asChild>
                      <Link to="/signup" onClick={closeMenu}>Sign up</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
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
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Logging out...</>
              ) : "Logout"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};