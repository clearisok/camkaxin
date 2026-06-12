import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const SIDER_COLLAPSED_STORAGE_KEY = 'jiankai-app-sider-collapsed';

type SidebarContextValue = {
  collapsed: boolean;
  toggleCollapsed: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

function readCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(SIDER_COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function applyCollapsedDataset(collapsed: boolean) {
  document.documentElement.dataset.siderCollapsed = collapsed ? '1' : '0';
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    const initial = readCollapsedPreference();
    applyCollapsedDataset(initial);
    return initial;
  });

  useEffect(() => {
    applyCollapsedDataset(collapsed);
    try {
      localStorage.setItem(SIDER_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({ collapsed, toggleCollapsed }),
    [collapsed, toggleCollapsed]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return ctx;
}
