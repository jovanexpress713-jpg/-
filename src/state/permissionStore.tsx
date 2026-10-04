/**
 * EJAZ Transport — Live Permission Store (client)
 * ─────────────────────────────────────────────────────────────────────────
 * The client's single answer to «may this user see / do this?».
 *
 * It is a mirror of the server registry, never a second source of truth:
 *   • on sign-in it fetches `/api/permissions/me`,
 *   • it polls `/api/permissions/changes` so an administrator's edit reaches an
 *     already-open session without a sign-out,
 *   • every screen, menu item, tab, shortcut and button asks this store.
 *
 * The server re-checks the same permissions on every request — this store only
 * decides what is *rendered*. Hiding is presentation; the API is the guard.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiClient, getAuthToken } from "../services/apiClient";
import { DEFAULT_CLIENT_PERMISSIONS } from "../utils/permissions";

export interface PermissionState {
  role: string;
  wildcard: boolean;
  permissions: string[];
  /** Console page ids this role may open. */
  pages: string[];
  /** Console section ids that contain at least one visible page. */
  sections: string[];
  version: number;
  canManagePermissions: boolean;
}

const EMPTY: PermissionState = {
  role: "GUEST",
  wildcard: false,
  permissions: [],
  pages: [],
  sections: [],
  version: 0,
  canManagePermissions: false,
};

interface PermissionContextValue extends PermissionState {
  /** True when the live grant has been loaded (until then the fallback is used). */
  ready: boolean;
  can: (permission: string) => boolean;
  canAny: (...permissions: string[]) => boolean;
  canAll: (...permissions: string[]) => boolean;
  pageVisible: (pageId: string) => boolean;
  sectionVisible: (sectionId: string) => boolean;
  /** Force a refetch (used right after the administrator saves). */
  refresh: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

/** Pages a signed-in staff member always keeps, so nobody is ever locked out of
 *  the shell itself. The account menu and settings remain reachable. */
const ALWAYS_AVAILABLE_PAGES = ["settings"];

export function PermissionProvider({
  children,
  role,
  tokenPermissions,
  initial,
}: {
  children: ReactNode;
  /** The signed-in role, used for the offline fallback. */
  role?: string;
  /** Permissions carried in the session token, used until the API answers. */
  tokenPermissions?: string[];
  /**
   * An explicit grant to use verbatim. Used by the test harness (and any
   * pre-rendered surface) where there is no API to ask; production never passes
   * it, so the live registry always wins there.
   */
  initial?: PermissionState;
}) {
  const [state, setState] = useState<PermissionState>(initial ?? EMPTY);
  const [ready, setReady] = useState(!!initial);
  const inflight = useRef(false);

  const load = useCallback(async () => {
    if (!getAuthToken() || inflight.current) return;
    inflight.current = true;
    try {
      const me = await apiClient.permissions.me();
      if (me?.role) {
        setState({
          role: me.role,
          wildcard: !!me.wildcard,
          permissions: Array.isArray(me.permissions) ? me.permissions : [],
          pages: Array.from(new Set([...(me.pages || []), ...ALWAYS_AVAILABLE_PAGES])),
          sections: me.sections || [],
          version: Number(me.version) || 0,
          canManagePermissions: !!me.canManagePermissions,
        });
        setReady(true);
      }
    } catch {
      /* Offline or unauthenticated — the static fallback below applies. */
    } finally {
      inflight.current = false;
    }
  }, []);

  /* Load once per session, and follow the registry version afterwards. */
  useEffect(() => {
    if (initial) return; // an explicit grant is authoritative for this tree
    if (!getAuthToken()) {
      setState(EMPTY);
      setReady(false);
      return;
    }
    void load();

    const timer = window.setInterval(async () => {
      try {
        const res = await apiClient.permissions.changes();
        const next = Number(res?.version) || 0;
        if (next && next !== state.version) await load();
      } catch {
        /* a missed poll is harmless — the next one catches up */
      }
    }, 15000);

    return () => window.clearInterval(timer);
  }, [load, role, state.version, initial]);

  /* Fallback: before the API answers (or with no network) the role's factory
     defaults keep the shell usable instead of rendering an empty console. */
  const effective = useMemo<PermissionState>(() => {
    if (ready && state.permissions.length) return state;
    const fallbackRole = state.role !== "GUEST" ? state.role : role || "GUEST";
    const list =
      tokenPermissions && tokenPermissions.length
        ? tokenPermissions
        : DEFAULT_CLIENT_PERMISSIONS[fallbackRole] || [];
    const wildcard = list.includes("*");
    return {
      role: fallbackRole,
      wildcard,
      permissions: list,
      pages: state.pages.length ? state.pages : [],
      sections: state.sections,
      version: state.version,
      canManagePermissions: wildcard || list.includes("permissions.manage"),
    };
  }, [ready, state, role, tokenPermissions]);

  const can = useCallback(
    (permission: string) => {
      if (effective.wildcard) return true;
      return effective.permissions.includes(permission);
    },
    [effective]
  );

  const canAny = useCallback(
    (...permissions: string[]) => permissions.some((p) => can(p)),
    [can]
  );

  const canAll = useCallback(
    (...permissions: string[]) => permissions.every((p) => can(p)),
    [can]
  );

  const pageVisible = useCallback(
    (pageId: string) => {
      if (effective.wildcard) return true;
      if (!effective.pages.length) return false;
      return effective.pages.includes(pageId);
    },
    [effective]
  );

  const sectionVisible = useCallback(
    (sectionId: string) => {
      if (effective.wildcard) return true;
      return effective.sections.includes(sectionId);
    },
    [effective]
  );

  const value = useMemo<PermissionContextValue>(
    () => ({ ...effective, ready, can, canAny, canAll, pageVisible, sectionVisible, refresh: load }),
    [effective, ready, can, canAny, canAll, pageVisible, sectionVisible, load]
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermissions(): PermissionContextValue {
  const ctx = useContext(PermissionContext);
  if (ctx) return ctx;
  /* Outside the provider (unit tests, SSR probes) everything is denied — the
     safe default, and the reason a missing wrapper shows up immediately. */
  return {
    ...EMPTY,
    ready: false,
    can: () => false,
    canAny: () => false,
    canAll: () => false,
    pageVisible: () => false,
    sectionVisible: () => false,
    refresh: async () => {},
  };
}


/**
 * Test / SSR helper — renders a subtree under an explicit grant.
 *
 * Production code never uses this: the live registry is the only source there.
 * It exists so a unit test can assert what a role *sees* without standing up the
 * API, and so a missing provider shows up as a blank surface rather than a
 * silently permissive one.
 */
export function withPermissions(
  node: ReactNode,
  grant: { permissions?: string[]; pages?: string[]; sections?: string[]; role?: string; wildcard?: boolean } = {}
): ReactNode {
  const permissions = grant.permissions ?? [];
  const wildcard = grant.wildcard ?? permissions.includes("*");
  return (
    <PermissionProvider
      initial={{
        role: grant.role ?? "TESTER",
        wildcard,
        permissions,
        pages: grant.pages ?? [],
        sections: grant.sections ?? [],
        version: 1,
        canManagePermissions: wildcard || permissions.includes("permissions.manage"),
      }}
    >
      {node}
    </PermissionProvider>
  );
}
