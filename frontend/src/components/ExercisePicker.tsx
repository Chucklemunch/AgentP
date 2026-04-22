import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Exercise, LibraryExercise } from '../types';

interface ExercisePickerProps {
  exercises: LibraryExercise[];
  onAdd: (exercise: Exercise) => void;
  onClose: () => void;
  onCreateExercise: (data: Omit<LibraryExercise, 'id' | 'is_custom'>) => Promise<LibraryExercise>;
}

function libraryToExercise(lib: LibraryExercise): Exercise {
  return {
    name: lib.name,
    sets: lib.default_sets,
    reps: lib.default_reps,
    duration_seconds: lib.default_duration_seconds,
    suggested_rep_range: null,
    rir: null,
    frequency_per_week: lib.default_frequency_per_week,
    instructions: lib.instructions,
    progression_notes: null,
  };
}

const emptyForm = {
  name: '',
  default_sets: '',
  default_reps: '',
  default_duration_seconds: '',
  default_frequency_per_week: '3',
  instructions: '',
};

export default function ExercisePicker({ exercises, onAdd, onClose, onCreateExercise }: ExercisePickerProps) {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const filtered = exercises.filter((ex) =>
    ex.name.toLowerCase().includes(search.toLowerCase())
  );
  const library = filtered.filter((ex) => !ex.is_custom);
  const custom = filtered.filter((ex) => ex.is_custom);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.instructions.trim()) return;
    setSubmitting(true);
    try {
      const created = await onCreateExercise({
        name: form.name.trim(),
        default_sets: form.default_sets ? Number(form.default_sets) : null,
        default_reps: form.default_reps ? Number(form.default_reps) : null,
        default_duration_seconds: form.default_duration_seconds ? Number(form.default_duration_seconds) : null,
        default_frequency_per_week: Number(form.default_frequency_per_week) || 3,
        instructions: form.instructions.trim(),
      });
      onAdd(libraryToExercise(created));
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/40"
        style={{ zIndex: 9998 }}
        onClick={onClose}
      />
      <div
        className="fixed inset-x-4 top-16 bottom-16 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-96 bg-white rounded-2xl flex flex-col shadow-2xl overflow-hidden"
        style={{ zIndex: 9999 }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 shrink-0">
          {creating && (
            <button
              onClick={() => { setCreating(false); setForm(emptyForm); }}
              className="text-slate-400 hover:text-slate-600 transition-colors -ml-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h3 className="flex-1 text-sm font-semibold text-slate-800">
            {creating ? 'Create Custom Exercise' : 'Add Exercise'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {creating ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Name *</label>
              <input
                autoFocus
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Exercise name"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Sets</label>
                <input
                  type="number" min={1}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                  value={form.default_sets}
                  onChange={(e) => setForm((p) => ({ ...p, default_sets: e.target.value }))}
                  placeholder="—"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Reps</label>
                <input
                  type="number" min={1}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                  value={form.default_reps}
                  onChange={(e) => setForm((p) => ({ ...p, default_reps: e.target.value }))}
                  placeholder="—"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Duration (s)</label>
                <input
                  type="number" min={1}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                  value={form.default_duration_seconds}
                  onChange={(e) => setForm((p) => ({ ...p, default_duration_seconds: e.target.value }))}
                  placeholder="—"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Frequency (×/week) *</label>
              <input
                type="number" min={1} max={7}
                className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                value={form.default_frequency_per_week}
                onChange={(e) => setForm((p) => ({ ...p, default_frequency_per_week: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Instructions *</label>
              <textarea
                rows={4}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent resize-none"
                value={form.instructions}
                onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
                placeholder="Step-by-step instructions..."
              />
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 pt-3 pb-2 shrink-0">
              <input
                autoFocus
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search exercises..."
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {library.length > 0 && (
                <>
                  <p className="px-4 pt-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Library</p>
                  {library.map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => onAdd(libraryToExercise(ex))}
                      className="w-full text-left px-4 py-2.5 hover:bg-teal-50 transition-colors border-b border-slate-50 last:border-0"
                    >
                      <p className="text-sm font-medium text-slate-800">{ex.name}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{ex.instructions}</p>
                    </button>
                  ))}
                </>
              )}
              {custom.length > 0 && (
                <>
                  <p className="px-4 pt-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Custom</p>
                  {custom.map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => onAdd(libraryToExercise(ex))}
                      className="w-full text-left px-4 py-2.5 hover:bg-teal-50 transition-colors border-b border-slate-50 last:border-0"
                    >
                      <p className="text-sm font-medium text-slate-800">{ex.name}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{ex.instructions}</p>
                    </button>
                  ))}
                </>
              )}
              {filtered.length === 0 && (
                <p className="px-4 py-8 text-sm text-slate-400 text-center">No exercises found</p>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-100 shrink-0">
          {creating ? (
            <button
              onClick={handleCreate}
              disabled={submitting || !form.name.trim() || !form.instructions.trim()}
              className="w-full text-xs font-medium py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:bg-teal-100 disabled:text-teal-400 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Saving…' : 'Add to Program'}
            </button>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create custom exercise
            </button>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
