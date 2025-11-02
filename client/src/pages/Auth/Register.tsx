import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { apiPost, apiGet } from "@/lib/api";
import GoogleSignButton from "@/components/Auth/GoogleSignButton";

const Register = () => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiPost("/auth/register", { email, password, name });
      const token = data?.token;
      if (token) {
        localStorage.setItem("dm_token", token);
        try {
          const profile = await apiGet("/auth/me");
          if (profile?.id)
            localStorage.setItem("dm_user_id", String(profile.id));
          if (profile?.name)
            localStorage.setItem("dm_user_name", String(profile.name));
        } catch (err) {
          console.warn("Failed to fetch profile after register:", err);
        }
        setLoading(false);
        toast({ title: "Account created", description: "Welcome!" });
        navigate("/");
        return;
      }
      setLoading(false);
      toast({
        title: "Registration",
        description: data?.message || "Registered",
      });
      navigate("/login");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as Record<string, unknown>).message)
          : "Could not register";
      setLoading(false);
      toast({ title: "Registration failed", description: message });
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="glass-card max-w-md w-full p-8">
        <h1 className="text-2xl font-semibold mb-2">Create account</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Start using DriveMerge to unify your cloud storage
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input-style"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-style"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-style"
            />
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary-glass w-full"
            >
              {loading ? "Creating..." : "Create account"}
            </button>
            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-muted-foreground underline"
              >
                Already have an account?
              </Link>
            </div>
          </div>
        </form>

        <div className="mt-4">
          <div className="text-center text-sm text-muted-foreground mb-2">
            or
          </div>
          <GoogleSignButton />
        </div>
      </div>
    </div>
  );
};

export default Register;
