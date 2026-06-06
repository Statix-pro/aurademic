import { createContextualCan } from '@casl/react';
import React, { createContext, useContext, useMemo } from 'react';

import { defineAbilityFor, defaultAbility, AppAbility } from './ability';
import { useAuth } from '../../contexts/AuthContext';

// ─── Context ───────────────────────────────────────────────────────────
const AbilityContext = createContext<AppAbility>(defaultAbility);

// ─── <Can> component (from @casl/react) ────────────────────────────────
// Usage: <Can I="edit" a="Journal">...</Can>
export const Can = createContextualCan(AbilityContext.Consumer);

// ─── useAbility hook ───────────────────────────────────────────────────
// Usage: const ability = useAbility(); ability.can('edit', 'Journal');
export const useAbility = (): AppAbility => {
  const ability = useContext(AbilityContext);
  if (!ability) {
    throw new Error('useAbility must be used within an AbilityProvider');
  }
  return ability;
};

// ─── Provider ──────────────────────────────────────────────────────────
export const AbilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const ability = useMemo(() => defineAbilityFor(user), [user]);

  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>;
};
