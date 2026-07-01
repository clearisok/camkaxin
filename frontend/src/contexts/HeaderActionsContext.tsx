import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

export type HeaderActionsConfig = {
  back?: boolean;
  onBack?: () => void;
  history?: boolean;
  onHistory?: () => void;
  save?: boolean;
  onSave?: () => void;
  saving?: boolean;
};

type HeaderActionsContextValue = {
  config: HeaderActionsConfig;
  setConfig: Dispatch<SetStateAction<HeaderActionsConfig>>;
};

const HeaderActionsContext = createContext<HeaderActionsContextValue | null>(null);

export function HeaderActionsProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<HeaderActionsConfig>({});
  const value = useMemo(() => ({ config, setConfig }), [config]);
  return <HeaderActionsContext.Provider value={value}>{children}</HeaderActionsContext.Provider>;
}

export function useHeaderActionsConfig(): HeaderActionsConfig {
  const ctx = useContext(HeaderActionsContext);
  return ctx?.config ?? {};
}

export function useRegisterHeaderActions(config: HeaderActionsConfig) {
  const setConfig = useContext(HeaderActionsContext)?.setConfig;

  useLayoutEffect(() => {
    if (!setConfig) return;
    setConfig(config);
    return () => setConfig({});
  }, [
    setConfig,
    config.back,
    config.onBack,
    config.history,
    config.onHistory,
    config.save,
    config.onSave,
    config.saving,
  ]);
}
