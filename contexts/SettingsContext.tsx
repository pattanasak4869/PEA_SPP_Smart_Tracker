
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

interface AppSettings {
  autoSync: boolean;
  dataSaver: boolean;
}

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
}

const defaultSettings: AppSettings = {
  autoSync: true,
  dataSaver: false,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    if (typeof window !== 'undefined') {
      const savedSync = localStorage.getItem('setting_sync');
      const savedSaver = localStorage.getItem('setting_datasaver');
      
      return {
        autoSync: savedSync !== null ? savedSync === 'true' : defaultSettings.autoSync,
        dataSaver: savedSaver !== null ? savedSaver === 'true' : defaultSettings.dataSaver,
      };
    }
    return defaultSettings;
  });

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      // Persist to storage immediately
      if (newSettings.autoSync !== undefined) localStorage.setItem('setting_sync', String(newSettings.autoSync));
      if (newSettings.dataSaver !== undefined) localStorage.setItem('setting_datasaver', String(newSettings.dataSaver));
      return updated;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
