import { createContext, useContext, useEffect, useState } from 'react';
import { loadContent } from './load-content.js';

const ContentContext = createContext({ status: 'loading', bundle: null, error: null });

function initialContent(initialBundle, initialError) {
  if (initialBundle) return { status: 'ready', bundle: initialBundle, error: null };
  if (initialError) return { status: 'error', bundle: null, error: initialError };
  return { status: 'loading', bundle: null, error: null };
}

export function ContentProvider({
  children,
  initialBundle = null,
  initialError = null,
  loadContentImpl = loadContent,
}) {
  const [content, setContent] = useState(() => initialContent(initialBundle, initialError));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (attempt === 0 && (initialBundle || initialError)) return undefined;

    let active = true;
    setContent({ status: 'loading', bundle: null, error: null });
    loadContentImpl().then(
      (bundle) => active && setContent({ status: 'ready', bundle, error: null }),
      (error) => active && setContent({ status: 'error', bundle: null, error })
    );
    return () => { active = false; };
  }, [attempt, initialBundle, initialError, loadContentImpl]);

  return (
    <ContentContext.Provider value={{ ...content, retry: () => setAttempt((current) => current + 1) }}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  return useContext(ContentContext);
}
