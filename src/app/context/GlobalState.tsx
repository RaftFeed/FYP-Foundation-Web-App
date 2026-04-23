import React, { createContext, useContext, useState } from 'react';

interface GlobalState {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  notification: { message: string; type: 'success' | 'error' | 'info' } | null;
  setNotification: (notification: any) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const GlobalContext = createContext<GlobalState | undefined>(undefined);

export function GlobalStateProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <GlobalContext.Provider value={{ searchQuery, setSearchQuery, notification, setNotification, isLoading, setIsLoading }}>
      {children}
    </GlobalContext.Provider>
  );
}

export function useGlobalState() {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('useGlobalState must be used within GlobalStateProvider');
  }
  return context;
}
