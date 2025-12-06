import { apiPost } from "./api";

const TOKEN_KEY = "dm_token";
const REFRESH_TOKEN_KEY = "dm_refresh_token";

export function getAccessToken() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken?: string) {
    if (typeof window === "undefined") return;
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
}

export function clearTokens() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem("dm_user_id");
    localStorage.removeItem("dm_user_name");
}

interface RefreshResponse {
    token: string;
    refreshToken?: string;
}

let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        try {
            
            
            
            
            const API_BASE =
                (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:3000";

            const res = await fetch(`${API_BASE}/auth/refresh`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ refreshToken }),
            });

            if (!res.ok) {
                throw new Error("Refresh failed");
            }

            const data: RefreshResponse = await res.json();
            setTokens(data.token, data.refreshToken);
            return data.token;
        } catch (err) {
            clearTokens();
            return null;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}
