import { Link, useNavigate } from "react-router-dom";
import { Shield, Github, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignIn() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 cyber-grid opacity-50" />
      <div className="absolute inset-0 bg-gradient-glow" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-72 w-[40rem] bg-primary/15 blur-[120px] rounded-full" />

      <div className="relative z-10 w-full max-w-md p-6">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <Shield className="h-8 w-8 text-primary" />
          <span className="font-bold text-xl">
            Privacy<span className="text-gradient-primary">Guard</span>
            <span className="ml-1 text-xs font-mono text-muted-foreground">AI</span>
          </span>
        </Link>

        <div className="glass-strong rounded-2xl p-8">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to continue to your privacy pipeline.</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate("/dashboard");
            }}
            className="mt-6 space-y-4"
          >
            <div>
              <Label htmlFor="email" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Email</Label>
              <Input id="email" type="email" placeholder="alex@company.com" required className="mt-1.5 bg-muted/40 border-border/60" />
            </div>
            <div>
              <Label htmlFor="password" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" required className="mt-1.5 bg-muted/40 border-border/60" />
            </div>
            <Button type="submit" className="w-full bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary">
              Sign in
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border/50" />
            <span className="font-mono">OR</span>
            <div className="h-px flex-1 bg-border/50" />
          </div>

          <div className="space-y-2">
            <Button variant="outline" className="w-full border-border/60 hover:border-primary/40">
              <Github className="h-4 w-4 mr-2" /> Continue with GitHub
            </Button>
            <Button variant="outline" className="w-full border-border/60 hover:border-primary/40">
              <Mail className="h-4 w-4 mr-2" /> Continue with email link
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Don't have an account? <Link to="/dashboard" className="text-primary hover:underline">Start free</Link>
          </p>
        </div>

        <p className="text-center text-[11px] font-mono text-muted-foreground mt-4">
          🔒 Your data never leaves your session
        </p>
      </div>
    </div>
  );
}
