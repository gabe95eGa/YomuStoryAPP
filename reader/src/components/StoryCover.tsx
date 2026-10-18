const categories = new Set(['cooking', 'daily', 'work', 'travel', 'japan']);
export function coverCategory(id: string) {
  const category = id.split('_')[0];
  return categories.has(category) ? category : 'daily';
}
export function StoryCover({ id, priority = false }: { id: string; priority?: boolean }) {
  return <img className="cover-photo" src={`${import.meta.env.BASE_URL}images/covers/${coverCategory(id)}.webp`}
    alt="" width={900} height={480} loading={priority ? 'eager' : 'lazy'} decoding="async"
    fetchPriority={priority ? 'high' : 'auto'} onError={(event) => { event.currentTarget.hidden = true; }} />;
}
