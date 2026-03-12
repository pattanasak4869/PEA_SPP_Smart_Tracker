
import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize state synchronously to avoid flash
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
       const saved = localStorage.getItem('app_theme');
       if (saved === 'light' || saved === 'dark') {
         // Apply immediately during initialization
         document.documentElement.classList.remove('light', 'dark');
         document.documentElement.classList.add(saved);
         return saved;
       }
       
       const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
       const defaultTheme = sysDark ? 'dark' : 'light';
       document.documentElement.classList.add(defaultTheme);
       return defaultTheme;
    }
    return 'dark';
  });

  const setTheme = (newTheme: Theme) => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(newTheme);
    localStorage.setItem('app_theme', newTheme);
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Sync if system preference changes while app is open (optional but good UX)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
        if (!localStorage.getItem('app_theme')) {
            setTheme(mediaQuery.matches ? 'dark' : 'light');
        }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
