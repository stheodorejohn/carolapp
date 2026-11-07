export default function Loading() {
  return (
    <div className="page-container bg-slate-50 p-4 space-y-4 pt-14">
      <div className="carol-card p-4 animate-pulse">
        <div className="h-5 bg-slate-200 rounded w-1/2 mb-3" />
        <div className="h-3 bg-slate-100 rounded w-3/4 mb-2" />
        <div className="h-3 bg-slate-100 rounded w-1/3" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="carol-card p-4 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
            <div className="h-3 bg-slate-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

