import { createContext, useContext, useEffect, useState } from 'react';
import { loadContent } from './load-content.js';

const ContentContext = createContext({ status: 'loading', bundle: null, error: null });

export function ContentProvider({ children }) {
  const [content, setContent] = useState({ status: 'loading', bundle: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setContent({ status: 'loading', bundle: null, error: null });
    loadContent().then(
      (bundle) => active && setContent({ status: 'ready', bundle, error: null }),
      (error) => active && setContent({ status: 'error', bundle: null, error })
    );
    return () => { active = false; };
  }, [attempt]);

  return (
    <ContentContext.Provider value={{ ...content, retry: () => setAttempt((current) => current + 1) }}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  return useContext(ContentContext);
}
