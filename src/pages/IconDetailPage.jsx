export function IconDetailPage({ icon }) {
  return (
    <main id="main-content" className="baseline-page">
      <h1>{icon?.title ?? 'Икона не найдена'}</h1>
    </main>
  );
}
