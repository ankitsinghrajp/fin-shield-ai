import { Link, useLocation } from "react-router-dom";
import { Shield, Github } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Navbar = () => {
  const { pathname } = useLocation();
  const onApp = pathname !== "/" && pathname !== "/signin";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 glass">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 blur-md rounded-full group-hover:bg-primary/50 transition" />
            <Shield className="relative h-7 w-7 text-primary" strokeWidth={2.2} />
          </div>
          <span className="font-bold text-lg tracking-tight">
            Privacy<span className="text-gradient-primary">Guard</span>
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
              <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition">Dashboard</Link>
              <Link to="/history" className="text-muted-foreground hover:text-foreground transition">History</Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild className="hidden sm:inline-flex">
            <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub">
              <Github className="h-4 w-4" />
            </a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/signin">Sign in</Link>
          </Button>
          <Button size="sm" asChild className="bg-gradient-primary text-primary-foreground hover:opacity-90 btn-glow shadow-glow-primary">
            <Link to="/dashboard">Launch app</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};
