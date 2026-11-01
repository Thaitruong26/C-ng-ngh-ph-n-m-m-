import type { AuthStoreState, User } from "./types";

const STORAGE_KEY = "brewlite.auth";

export function readAuth(): AuthStoreState {
  if (typeof window === "undefined") return { accessToken: null, user: null };

  // 1. Ưu tiên tuyệt đối sessionStorage (độc lập từng tab/cửa sổ)
  try {
    const sessionSaved = window.sessionStorage.getItem(STORAGE_KEY);
    if (sessionSaved) {
      const value = JSON.parse(sessionSaved) as Partial<AuthStoreState>;
      if (value.accessToken) {
        return { accessToken: value.accessToken ?? null, user: value.user ?? null };
      }
    }

    const sessionToken =
      window.sessionStorage.getItem("brewlite_access_token") ||
      window.sessionStorage.getItem("accessToken") ||
      window.sessionStorage.getItem("token");

    if (sessionToken) {
      let sessionUser: User | null = null;
      const userStr = window.sessionStorage.getItem("brewlite_user");
      if (userStr) sessionUser = JSON.parse(userStr);
      return { accessToken: sessionToken, user: sessionUser };
    }
  } catch {
    // ignore
  }

  // 2. Dự phòng localStorage nếu tab mới mở chưa có session riêng
  try {
    const localSaved = window.localStorage.getItem(STORAGE_KEY);
    if (localSaved) {
      const value = JSON.parse(localSaved) as Partial<AuthStoreState>;
      if (value.accessToken) {
        // Sao chép sang sessionStorage của tab hiện tại để từ đây tab này hoạt động độc lập
        try {
          window.sessionStorage.setItem(STORAGE_KEY, localSaved);
          if (value.accessToken) window.sessionStorage.setItem("brewlite_access_token", value.accessToken);
          if (value.user) window.sessionStorage.setItem("brewlite_user", JSON.stringify(value.user));
        } catch {}
        return { accessToken: value.accessToken ?? null, user: value.user ?? null };
      }
    }

    const token =
      window.localStorage.getItem("brewlite_access_token") ||
      window.localStorage.getItem("accessToken") ||
      window.localStorage.getItem("token");

    let user: User | null = null;
    const userStr = window.localStorage.getItem("brewlite_user");
    if (userStr) {
      user = JSON.parse(userStr);
    } else {
      const authStorage = window.localStorage.getItem("auth-storage");
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        user = parsed?.state?.user ?? null;
      }
    }

    if (token) {
      try {
        window.sessionStorage.setItem("brewlite_access_token", token);
        if (user) window.sessionStorage.setItem("brewlite_user", JSON.stringify(user));
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken: token, user }));
      } catch {}
      return { accessToken: token, user };
    }
  } catch {
    // ignore
  }

  return { accessToken: null, user: null };
}

export function saveAuth(accessToken: string, user: User) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({ accessToken, user });

  // 1. Lưu vào sessionStorage riêng của tab này để tab này độc lập hoàn toàn với các tab khác
  try {
    window.sessionStorage.setItem(STORAGE_KEY, payload);
    window.sessionStorage.setItem("brewlite_access_token", accessToken);
    window.sessionStorage.setItem("accessToken", accessToken);
    window.sessionStorage.setItem("brewlite_user", JSON.stringify(user));
  } catch {}

  // 2. Lưu vào localStorage để làm giá trị mặc định cho tab mới
  try {
    window.localStorage.setItem(STORAGE_KEY, payload);
    window.localStorage.setItem("brewlite_access_token", accessToken);
    window.localStorage.setItem("accessToken", accessToken);
    window.localStorage.setItem("brewlite_user", JSON.stringify(user));
    window.localStorage.setItem(
      "auth-storage",
      JSON.stringify({ state: { token: accessToken, user, isAuthenticated: true } }),
    );
  } catch {}

  window.dispatchEvent(new Event("brewlite:auth-change"));
}

export function clearAuth() {
  if (typeof window === "undefined") return;

  // Xóa session riêng của tab này
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem("brewlite_access_token");
    window.sessionStorage.removeItem("accessToken");
    window.sessionStorage.removeItem("token");
    window.sessionStorage.removeItem("brewlite_user");
  } catch {}

  // Xóa cả localStorage
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem("brewlite_access_token");
    window.localStorage.removeItem("accessToken");
    window.localStorage.removeItem("token");
    window.localStorage.removeItem("brewlite_user");
    window.localStorage.removeItem("auth-storage");
  } catch {}

  window.dispatchEvent(new Event("brewlite:auth-change"));
}

export function getAccessToken() {
  return readAuth().accessToken;
}
