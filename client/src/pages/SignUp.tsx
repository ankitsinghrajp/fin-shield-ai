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

          {/* ── Custom Google Button wrapper ── */}
          <div className="relative w-full h-11">
            {/* Visible custom-styled button — sits behind */}
            <div className="absolute inset-0 z-0 w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/50 hover:border-border transition-all duration-200 select-none">
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                    <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  <span className="text-sm font-medium text-foreground/90">Sign up with Google</span>
                </>
              )}
            </div>

            {/* Invisible real GoogleLogin on top — intercepts all clicks */}
            <div
              className="absolute inset-0 z-20 overflow-hidden rounded-xl"
              style={{ opacity: 0.01, pointerEvents: googleLoading ? "none" : "auto" }}
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
                theme="filled_black"
                shape="pill"
                width="368"
              />
            </div>
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