import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const savedTheme = localStorage.getItem('app-theme') as Theme | null;
      if (savedTheme === 'light') {
        localStorage.removeItem('app-theme');
      } else if (savedTheme === 'dark') {
        return 'dark';
      }
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    const applyTheme = (t: Theme) => {
      const docEl = document.documentElement;
      const metaTheme = document.getElementById('theme-color-meta') || document.querySelector('meta[name="theme-color"]');
      if (t === 'dark') {
        docEl.classList.add('dark');
        docEl.classList.remove('light');
        docEl.style.backgroundColor = '#131314';
        docEl.style.colorScheme = 'dark';
        if (metaTheme) metaTheme.setAttribute('content', '#131314');
      } else {
        docEl.classList.remove('dark');
        docEl.classList.add('light');
        docEl.style.backgroundColor = '#ffffff';
        docEl.style.colorScheme = 'light';
        if (metaTheme) metaTheme.setAttribute('content', '#ffffff');
      }
    };

    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const newTheme = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('app-theme', newTheme);
      } catch {}
      return newTheme;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
