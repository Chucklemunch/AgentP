export default function ProgramCardSkeleton() {
  return (
    <div className="mt-3 rounded-xl border border-teal-200 overflow-hidden text-sm animate-pulse">
      {/* Header */}
      <div className="bg-teal-600 px-4 py-3 flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-teal-400/60 rounded w-2/3" />
          <div className="h-2.5 bg-teal-400/40 rounded w-1/2" />
        </div>
        <div className="h-5 w-16 bg-teal-400/40 rounded-full shrink-0" />
      </div>

      {/* Exercise rows */}
      <div className="bg-white divide-y divide-slate-100">
        {[0, 1, 2].map((i) => (
          <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-slate-200 rounded w-1/2" />
              <div className="h-2.5 bg-slate-100 rounded w-1/3" />
            </div>
            <div className="w-4 h-4 bg-slate-200 rounded shrink-0" />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-white border-t border-slate-100 flex gap-2">
        <div className="flex-1 h-8 bg-teal-100 rounded-lg" />
        <div className="flex-1 h-8 bg-slate-100 rounded-lg" />
      </div>
    </div>
  );
}
