import { FormEvent, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { server } from "@/constants";
import axios from "axios";
import { GoogleLogin } from "@react-oauth/google";
import { userExists } from "@/redux/reducers/auth";
import { useDispatch } from "react-redux";

export default function SignIn() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

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
        `${server}/api/v1/user/login`,
        { email, password },
        { withCredentials: true }
      );

      if (data.success) {
        saveSession(data.data.accessToken, data.data.refreshToken, data.data.user);
        toast.success(data.message || "Welcome back!");

        if (data?.data?.user) {
          dispatch(userExists(data?.data?.user));
        }

        navigate("/dashboard");
      } else {
        toast.error(data.message || "Sign in failed");
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        toast.error(err.response?.data?.message || "Sign in failed");
      } else {
        toast.error(err instanceof Error ? err.message : "Sign in failed");
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
           <Link to="/" className="flex justify-center mb-2 items-center gap-2 group flex-shrink-0">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/30 blur-md rounded-full group-hover:bg-primary/50 transition" />
                <Shield className="relative h-6 w-6 text-primary" strokeWidth={2.2} />
              </div>
              <span className="font-bold text-xl tracking-tight">
                Fin<span className="text-gradient-primary">Shield</span>
                <span className="ml-0.5 text-[10px] font-mono text-muted-foreground align-super">AI</span>
              </span>
            </Link>

        <div className="glass-strong rounded-2xl p-8">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to continue to your privacy pipeline.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="alex@company.com"
                required
                autoComplete="email"
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
                placeholder="••••••••"
                required
                autoComplete="current-password"
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border/50" />
            <span className="font-mono">OR</span>
            <div className="h-px flex-1 bg-border/50" />
          </div>

          {/* Custom Google button wrapper */}
          <div className="relative w-full">
            {/* Invisible GoogleLogin sits on top to capture the click */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0,
                zIndex: 10,
                overflow: "hidden",
                borderRadius: "9999px",
              }}
            >
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
                      toast.success(data.message || "Google login successful!");

                      if (data?.user) {
                        dispatch(userExists(data?.user));
                      }

                      navigate("/dashboard");
                    } else {
                      toast.error(data.message || "Google login failed");
                    }
                  } catch (err) {
                    if (axios.isAxiosError(err)) {
                      toast.error(err.response?.data?.message || "Google login failed");
                    } else {
                      toast.error("Google login failed");
                    }
                  } finally {
                    setGoogleLoading(false);
                  }
                }}
                onError={() => {
                  toast.error("Google sign-in was cancelled or failed");
                  setGoogleLoading(false);
                }}
                text="signin_with"
                theme="outline"
                shape="pill"
                width="500"
              />
            </div>

            {/* Visible custom-styled button */}
            <button
              type="button"
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 rounded-full border border-border/60 bg-muted/40 hover:bg-muted/60 transition-colors px-4 py-2.5 text-sm font-medium text-foreground pointer-events-none select-none"
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {/* Google "G" SVG */}
                  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                    <g fill="none" fillRule="evenodd">
                      <path
                        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                        fill="#4285F4"
                      />
                      <path
                        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                        fill="#34A853"
                      />
                      <path
                        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                        fill="#EA4335"
                      />
                    </g>
                  </svg>
                  Sign in with Google
                </>
              )}
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary hover:underline">
              Sign up
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