import { useEffect, useRef } from "react";
import { apiPost } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";

declare global {
  interface Window {
    google?:
    | {
      accounts?: {
        id?: {
          initialize: (opts: Record<string, unknown>) => void;
          renderButton: (
            el: HTMLElement,
            opts: Record<string, unknown>
          ) => void;
        };
      };
    }
    | undefined;
  }
}

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

async function loadGoogleScript(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.google) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
}

export default function GoogleSignButton({
  label = "Continue with Google",
}: {
  label?: string;
}) {
  const btnRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme } = useTheme();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadGoogleScript();
        if (!mounted) return;
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
        if (!clientId) {
          console.warn("VITE_GOOGLE_CLIENT_ID not set");
          return;
        }

        
        let buttonTheme = "outline";
        if (theme === "dark") {
          buttonTheme = "filled_black";
        } else if (theme === "system") {
          if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
            buttonTheme = "filled_black";
          }
        }

        window.google?.accounts?.id?.initialize({
          client_id: clientId,
          callback: async (resp: { credential?: string } | unknown) => {
            try {
              const credential =
                typeof resp === "object" &&
                  resp !== null &&
                  "credential" in resp
                  ? (resp as { credential?: string }).credential
                  : undefined;
              if (!credential) throw new Error("No credential from Google");
              const data = await apiPost("/auth/google-login", { credential });
              const token = data?.token;
              const refreshToken = data?.refreshToken;
              if (!token) throw new Error("No token from server");
              setTokens(token, refreshToken);
              try {
                const profile = await (
                  await import("@/lib/api")
                ).apiGet("/auth/me");
                if (profile?.id)
                  localStorage.setItem("dm_user_id", String(profile.id));
                if (profile?.name)
                  localStorage.setItem("dm_user_name", String(profile.name));
              } catch (e) {
                console.warn("Failed to load user profile after Google login", e);
              }
              toast({ title: "Signed in with Google" });
              navigate("/");
            } catch (err: unknown) {
              const message =
                err && typeof err === "object" && "message" in err
                  ? String((err as Record<string, unknown>).message)
                  : "Google sign-in failed";
              toast({ title: "Google sign-in failed", description: message });
            }
          },
        });

        
        if (btnRef.current) {
          window.google?.accounts?.id?.renderButton(btnRef.current, {
            theme: buttonTheme,
            size: "large",
            text: "signin_with",
            width: 250, 
          } as Record<string, unknown>);
        }
      } catch (err) {
        console.warn("Failed to load Google script", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [navigate, toast, theme]);

  return (
    <div className="flex justify-center w-full">
      <div ref={btnRef} className="w-full flex justify-center" />
    </div>
  );
}
