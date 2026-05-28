import React, { createContext, useContext, useMemo, useState } from 'react';

type GameTabBarContextValue = {
  hideTabBar: boolean;
  setHideTabBar: (hide: boolean) => void;
};

const GameTabBarContext = createContext<GameTabBarContextValue | null>(null);

export function GameTabBarProvider({ children }: { children: React.ReactNode }) {
  const [hideTabBar, setHideTabBar] = useState(false);
  const value = useMemo(
    () => ({ hideTabBar, setHideTabBar }),
    [hideTabBar],
  );
  return (
    <GameTabBarContext.Provider value={value}>{children}</GameTabBarContext.Provider>
  );
}

export function useGameTabBar(): GameTabBarContextValue {
  const ctx = useContext(GameTabBarContext);
  if (!ctx) {
    throw new Error('useGameTabBar must be used within GameTabBarProvider');
  }
  return ctx;
}
