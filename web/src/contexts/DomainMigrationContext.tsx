import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getDomainMigrationState, type DomainMigrationState } from '../lib/domainMigration';

const DomainMigrationContext = createContext<DomainMigrationState>(getDomainMigrationState(0, ''));

export function DomainMigrationProvider({ children }: { children: React.ReactNode }) {
  const getSnapshot = () =>
    getDomainMigrationState(
      Date.now(),
      typeof window !== 'undefined' ? window.location.hostname : '',
    );

  const [state, setState] = useState<DomainMigrationState>(getSnapshot);

  useEffect(() => {
    const refresh = () => setState(getSnapshot());
    refresh();

    const intervalMs = state.legacyHost && state.enabled ? 1000 : 30_000;
    const timer = window.setInterval(refresh, intervalMs);
    window.addEventListener('focus', refresh);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [state.enabled, state.legacyHost]);

  const value = useMemo(() => state, [state]);
  return <DomainMigrationContext.Provider value={value}>{children}</DomainMigrationContext.Provider>;
}

export function useDomainMigration() {
  return useContext(DomainMigrationContext);
}
