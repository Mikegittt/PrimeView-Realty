export default function PropertiesLoading() {
  return (
    <main className="listing-page" aria-busy="true" aria-label="Loading properties">
      <section className="listing-intro">
        <div className="loading-line loading-line--short" />
        <div className="loading-line loading-line--title" />
      </section>
      <div className="loading-panel" />
      <section className="loading-grid" aria-hidden="true">
        {[1, 2, 3].map((item) => (
          <div className="loading-card" key={item}>
            <div className="loading-card__image" />
            <div className="loading-line" />
            <div className="loading-line loading-line--short" />
          </div>
        ))}
      </section>
    </main>
  );
}
