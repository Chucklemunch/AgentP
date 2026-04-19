import { useState } from 'react';
import type { Exercise, ExerciseProgram } from '../types';

interface ProgramsPanelProps {
  programs: ExerciseProgram[];
  onClose: () => void;
  onUpdate: (id: string, program: ExerciseProgram) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatParams(ex: Exercise): string {
  const parts: string[] = [];
  if (ex.sets && ex.reps) parts.push(`${ex.sets} × ${ex.reps} reps`);
  else if (ex.sets && ex.suggested_rep_range) parts.push(`${ex.sets} × ${ex.suggested_rep_range} reps`);
  else if (ex.sets) parts.push(`${ex.sets} sets`);
  if (ex.duration_seconds) parts.push(`${ex.duration_seconds}s`);
  if (ex.rir != null) parts.push(`RIR ${ex.rir}`);
  parts.push(`${ex.frequency_per_week}×/week`);
  return parts.join(' · ');
}

interface EditState {
  programId: string;
  draft: ExerciseProgram;
}

export default function ProgramsPanel({ programs, onClose, onUpdate, onDelete }: ProgramsPanelProps) {
  const [selected, setSelected] = useState<ExerciseProgram | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const openDetail = (p: ExerciseProgram) => {
    setSelected(p);
    setEdit(null);
    setExpandedExercise(null);
    setConfirmDelete(false);
  };

  const startEdit = (p: ExerciseProgram) => {
    setEdit({ programId: p.id, draft: structuredClone(p) });
    setExpandedExercise(null);
  };

  const updateDraft = (field: keyof ExerciseProgram, value: unknown) => {
    setEdit((prev) => prev ? { ...prev, draft: { ...prev.draft, [field]: value } } : prev);
  };

  const updateExercise = (i: number, field: keyof Exercise, value: string | number | null) => {
    setEdit((prev) => {
      if (!prev) return prev;
      const exercises = [...prev.draft.exercises];
      exercises[i] = { ...exercises[i], [field]: value };
      return { ...prev, draft: { ...prev.draft, exercises } };
    });
  };

  const handleSaveEdit = async () => {
    if (!edit) return;
    await onUpdate(edit.programId, edit.draft);
    setSelected(edit.draft);
    setEdit(null);
  };

  const handleDelete = async () => {
    if (!selected) return;
    await onDelete(selected.id);
    setSelected(null);
    setEdit(null);
    setConfirmDelete(false);
  };

  const back = () => {
    setSelected(null);
    setEdit(null);
    setConfirmDelete(false);
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100 shrink-0">
          {selected && (
            <button onClick={back} className="text-slate-400 hover:text-slate-600 transition-colors -ml-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h2 className="flex-1 text-sm font-semibold text-slate-800">
            {selected ? (edit ? 'Edit Program' : selected.title) : 'My Programs'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* List view */}
          {!selected && (
            programs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
                <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">No saved programs yet</p>
                  <p className="text-xs text-slate-400 mt-1">Ask Perry to create an exercise program and save it here.</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {programs.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => openDetail(p)}
                    className="w-full text-left px-4 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-slate-800 leading-snug">{p.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug line-clamp-1">{p.goal}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-teal-600">{p.exercises.length} exercises</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-teal-600">{p.total_weeks} weeks</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-slate-400">{formatDate(p.created_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}

          {/* Detail view */}
          {selected && !edit && (
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs text-slate-400">Goal</p>
                <p className="text-sm text-slate-700 mt-0.5">{selected.goal}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-slate-400">Duration</p>
                  <p className="text-sm font-medium text-slate-700">{selected.total_weeks} weeks</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Exercises</p>
                  <p className="text-sm font-medium text-slate-700">{selected.exercises.length}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Created</p>
                  <p className="text-sm font-medium text-slate-700">{formatDate(selected.created_at)}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Exercises</p>
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                  {selected.exercises.map((ex, i) => (
                    <div key={i}>
                      <button
                        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
                        onClick={() => setExpandedExercise(expandedExercise === i ? null : i)}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{ex.name}</p>
                          <p className="text-teal-600 text-xs mt-0.5">{formatParams(ex)}</p>
                        </div>
                        <svg
                          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${expandedExercise === i ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expandedExercise === i && (
                        <div className="px-3 pb-3 space-y-1.5 text-xs text-slate-600 bg-slate-50 border-t border-slate-100">
                          <p className="leading-relaxed pt-2">{ex.instructions}</p>
                          {ex.progression_notes && (
                            <p className="text-teal-700 italic">↑ {ex.progression_notes}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {confirmDelete ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
                  <p className="text-xs text-red-700 font-medium">Delete this program?</p>
                  <p className="text-xs text-red-600">This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 text-xs font-medium py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => startEdit(selected)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Modify
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Edit view */}
          {selected && edit && (
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                  value={edit.draft.title}
                  onChange={(e) => updateDraft('title', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Goal</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                  value={edit.draft.goal}
                  onChange={(e) => updateDraft('goal', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Duration (weeks)</label>
                <input
                  type="number" min={1}
                  className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                  value={edit.draft.total_weeks}
                  onChange={(e) => updateDraft('total_weeks', Number(e.target.value))}
                />
              </div>

              <p className="text-xs font-medium text-slate-500 pt-1">Exercises</p>
              {edit.draft.exercises.map((ex, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                    value={ex.name}
                    onChange={(e) => updateExercise(i, 'name', e.target.value)}
                    placeholder="Exercise name"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Sets</label>
                      <input
                        type="number" min={1}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                        value={ex.sets ?? ''}
                        onChange={(e) => updateExercise(i, 'sets', e.target.value ? Number(e.target.value) : null)}
                        placeholder="—"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Reps</label>
                      <input
                        type="number" min={1}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                        value={ex.reps ?? ''}
                        onChange={(e) => updateExercise(i, 'reps', e.target.value ? Number(e.target.value) : null)}
                        placeholder="—"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Duration (s)</label>
                      <input
                        type="number" min={1}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                        value={ex.duration_seconds ?? ''}
                        onChange={(e) => updateExercise(i, 'duration_seconds', e.target.value ? Number(e.target.value) : null)}
                        placeholder="—"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Rep range</label>
                      <input
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                        value={ex.suggested_rep_range ?? ''}
                        onChange={(e) => updateExercise(i, 'suggested_rep_range', e.target.value || null)}
                        placeholder="e.g. 8-12"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">RIR</label>
                      <input
                        type="number" min={0} max={10}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                        value={ex.rir ?? ''}
                        onChange={(e) => updateExercise(i, 'rir', e.target.value ? Number(e.target.value) : null)}
                        placeholder="—"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Frequency (×/week)</label>
                    <input
                      type="number" min={1} max={7}
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                      value={ex.frequency_per_week}
                      onChange={(e) => updateExercise(i, 'frequency_per_week', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Instructions</label>
                    <textarea
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent resize-none"
                      value={ex.instructions}
                      onChange={(e) => updateExercise(i, 'instructions', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Progression notes</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                      value={ex.progression_notes ?? ''}
                      onChange={(e) => updateExercise(i, 'progression_notes', e.target.value || null)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit footer */}
        {edit && (
          <div className="px-4 py-3 border-t border-slate-100 flex gap-2 shrink-0">
            <button
              onClick={() => setEdit(null)}
              className="flex-1 text-xs font-medium py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="flex-1 text-xs font-medium py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        )}
      </div>
    </>
  );
}
