import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { server } from "@/constants";
import axios from "axios";
import { GoogleLogin } from "@react-oauth/google";
import { useDispatch } from "react-redux";
import { userExists } from "@/redux/reducers/auth";

export default function SignUp() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const saveSession = (accessToken: string, refreshToken: string, user: object) => {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("user", JSON.stringify(user));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post(
        `${server}/api/v1/user/register`,
        { fullname: name, email, password },
        { withCredentials: true }
      );

      if (data.success) {
        toast.success(data.message || "Account created");

        if (data?.data) {
          dispatch(userExists(data?.data));
        }

        navigate("/dashboard");
      } else {
        toast.error(data.message || "Sign up failed");
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        toast.error(err.response?.data?.message || "Sign up failed");
      } else {
        toast.error(err instanceof Error ? err.message : "Sign up failed");
      }
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Start your privacy pipeline in seconds.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="name" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Name
              </Label>
              <Input
                id="name"
                required
                autoComplete="name"
                placeholder="Ada Lovelace"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 bg-muted/40 border-border/60"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="alex@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 bg-muted/40 border-border/60"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 bg-muted/40 border-border/60"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border/50" />
            <span className="font-mono">OR</span>
            <div className="h-px flex-1 bg-border/50" />
          </div>

          <div className="w-full">
            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                if (googleLoading) return;
                setGoogleLoading(true);
                try {
                  const { data } = await axios.post(
                    `${server}/api/v1/user/google`,
                    { token: credentialResponse.credential },
                    { withCredentials: true }
                  );

                  if (data.success) {
                    saveSession(data.user.accessToken, data.user.refreshToken, {
                      _id: data.user._id,
                      fullname: data.user.fullname,
                      email: data.user.email,
                    });
                    toast.success(data.message || "Google sign up successful!");

                    if (data?.user) {
                      dispatch(userExists(data?.user));
                    }

                    navigate("/dashboard");
                  } else {
                    toast.error(data.message || "Google sign up failed");
                  }
                } catch (err) {
                  if (axios.isAxiosError(err)) {
                    toast.error(err.response?.data?.message || "Google sign up failed");
                  } else {
                    toast.error("Google sign up failed");
                  }
                } finally {
                  setGoogleLoading(false);
                }
              }}
              onError={() => {
                toast.error("Google sign-in was cancelled or failed");
                setGoogleLoading(false);
              }}
              text="signup_with"
              theme="outline"
              shape="pill"
              width="100%"
            />
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/signin" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-[11px] font-mono text-muted-foreground mt-4">
          🔒 Your data never leaves your session
        </p>
      </div>
    </div>
  );
}