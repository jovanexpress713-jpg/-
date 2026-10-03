/**
 * EJAZ Transport — Unified Enterprise API Client
 * Connects frontend UI components directly to the authoritative backend API.
 */

let authToken: string | null = null;
try {
  authToken = localStorage.getItem("ejaz_auth_token");
} catch {
  authToken = null;
}

export function setAuthToken(token: string | null) {
  authToken = token;
  try {
    if (token) {
      localStorage.setItem("ejaz_auth_token", token);
    } else {
      localStorage.removeItem("ejaz_auth_token");
    }
  } catch {
    /* ignore */
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      errorMsg = errJson.error || errorMsg;
    } catch {
      /* ignore */
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const apiClient = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: any }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<any>("/api/auth/me"),
    logout: () =>
      request<any>("/api/auth/logout", {
        method: "POST",
      }),
    getDemoAccounts: () =>
      request<{ enabled: boolean; accounts: Array<{ key: string; role: string; titleAr: string; titleEn: string; email: string; password: string; descAr: string }> }>("/api/auth/demo-accounts"),
  },
  trips: {
    getAll: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : "";
      return request<{ total: number; trips: any[] }>(`/api/trips${qs}`);
    },
    getById: (id: string) => request<any>(`/api/trips/${id}`),
    create: (data: any) =>
      request<any>("/api/trips", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    transition: (id: string, payload: { targetStatus: string; notes?: string; reason?: string; latitude?: number; longitude?: number }) =>
      request<any>(`/api/trips/${id}/transition`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    cancel: (id: string, reason: string) =>
      request<any>(`/api/trips/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    reopen: (id: string, reason: string) =>
      request<any>(`/api/trips/${id}/reopen`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    getClientTrips: () => request<{ total: number; trips: any[] }>("/api/client/trips"),
    getDriverTrips: (tab?: string) => {
      const qs = tab ? `?tab=${tab}` : "";
      return request<{ total: number; trips: any[]; tab?: string }>(`/api/driver/trips${qs}`);
    },
    requestTrip: (tripId: string, notes?: string) =>
      request<any>(`/api/driver/trips/${tripId}/request`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      }),
    approveRequest: (tripId: string) =>
      request<any>(`/api/trips/${tripId}/approve-request`, {
        method: "POST",
      }),
    rejectRequest: (tripId: string, reason: string) =>
      request<any>(`/api/trips/${tripId}/reject-request`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    getTracking: (id: string) => request<any>(`/api/trips/${id}/tracking`),
    assignDriver: (tripId: string, driverId: string, additionalDriverId?: string) =>
      request<any>(`/api/trips/${tripId}/assign-driver`, {
        method: "POST",
        body: JSON.stringify({ driverId, additionalDriverId }),
      }),
    replaceDriver: (tripId: string, newDriverId: string, reason: string) =>
      request<any>(`/api/trips/${tripId}/replace-driver`, {
        method: "POST",
        body: JSON.stringify({ newDriverId, reason }),
      }),
    assignVehicle: (tripId: string, vehicleId: string) =>
      request<any>(`/api/trips/${tripId}/assign-vehicle`, {
        method: "POST",
        body: JSON.stringify({ vehicleId }),
      }),
    replaceVehicle: (tripId: string, newVehicleId: string, reason: string) =>
      request<any>(`/api/trips/${tripId}/replace-vehicle`, {
        method: "POST",
        body: JSON.stringify({ newVehicleId, reason }),
      }),
  },
  vehicles: {
    getAll: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : "";
      return request<{ total: number; vehicles: any[] }>(`/api/vehicles${qs}`);
    },
    getById: (id: string) => request<any>(`/api/vehicles/${id}`),
    create: (data: any) =>
      request<any>("/api/vehicles", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  drivers: {
    getAll: () => request<{ total: number; drivers: any[] }>("/api/drivers"),
    getById: (id: string) => request<any>(`/api/drivers/${id}`),
    create: (data: any) =>
      request<any>("/api/drivers", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  customers: {
    getAll: () => request<{ total: number; customers: any[] }>("/api/customers"),
    create: (data: any) =>
      request<any>("/api/customers", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  finance: {
    getTrips: () => request<any>("/api/finance/trips"),
    getTripById: (id: string) => request<any>(`/api/finance/trips/${id}`),
    settle: (data: { tripId: string; paidAmount: number; settlementStatus?: string; paymentStatus?: string }) =>
      request<any>("/api/finance/settle", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  pod: {
    getForTrip: (tripId: string) => request<any>(`/api/pod/${tripId}`),
    create: (data: any) =>
      request<any>("/api/pod", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  claims: {
    getAll: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : "";
      return request<{ total: number; claims: any[] }>(`/api/claims${qs}`);
    },
    create: (data: any) =>
      request<any>("/api/claims", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  gps: {
    getStatus: () => request<any>("/api/gps/status"),
    getTelemetry: (deviceId: string) => request<any>(`/api/gps/telemetry/${deviceId}`),
    recordTelemetry: (data: any) =>
      request<any>("/api/gps/telemetry", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  notifications: {
    getAll: () => request<{ total: number; unread: number; notifications: any[] }>("/api/notifications"),
    markAsRead: (id: string) =>
      request<any>(`/api/notifications/${id}/read`, {
        method: "POST",
      }),
  },
  audit: {
    getAll: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : "";
      return request<{ total: number; logs: any[] }>(`/api/audit${qs}`);
    },
  },
  reports: {
    getSummary: () => request<any>("/api/reports/operational-summary"),
  },
  system: {
    health: () => request<any>("/api/health"),
    mapsConfig: () => request<any>("/api/system/maps-config"),
  },
  vehicleAssets: {
    getRegistry: () =>
      request<{
        registry: { version: number; updatedAt: string; types: any[]; vehicles: Record<string, any> };
        limits: { maxImageBytes: number; maxModelBytes: number; allowedTypes: string[] };
      }>("/api/vehicle-assets"),
    publishTypeImage: (type: string, payload: { data: string; fileName?: string; notesAr?: string }) =>
      request<any>(`/api/vehicle-assets/${type}/image`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    publishTypeModel: (
      type: string,
      payload: { data: string; fileName?: string; scale?: number; rotationY?: number; yOffset?: number; cameraRadius?: number },
    ) =>
      request<any>(`/api/vehicle-assets/${type}/model`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    updateModelTransform: (
      type: string,
      payload: { scale?: number; rotationY?: number; yOffset?: number; cameraRadius?: number },
    ) =>
      request<any>(`/api/vehicle-assets/${type}/model`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    withdrawTypeModel: (type: string) =>
      request<any>(`/api/vehicle-assets/${type}/model`, { method: "DELETE" }),
    publishVehicleImage: (vehicleId: string, payload: { data: string; fileName?: string }) =>
      request<any>(`/api/vehicle-assets/vehicle/${vehicleId}/image`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    removeVehicleImage: (vehicleId: string) =>
      request<any>(`/api/vehicle-assets/vehicle/${vehicleId}/image`, { method: "DELETE" }),
  },
  branding: {
    get: () => request<{ branding: any }>("/api/branding"),
    update: (data: any) =>
      request<{ message: string; branding: any }>("/api/branding", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },
};
