import { useState } from 'react';
import type { Exercise, ExerciseProgram } from '../types';

interface ProgramCardProps {
  program: ExerciseProgram;
  onSave: (program: ExerciseProgram) => void;
  isSaved: boolean;
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

export default function ProgramCard({ program, onSave, isSaved }: ProgramCardProps) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ExerciseProgram>(program);

  const updateExercise = (i: number, field: keyof Exercise, value: string | number | null) => {
    setDraft((prev) => {
      const exercises = [...prev.exercises];
      exercises[i] = { ...exercises[i], [field]: value };
      return { ...prev, exercises };
    });
  };

  const handleSaveChanges = () => {
    onSave(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(program);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="mt-3 rounded-xl border border-teal-200 overflow-hidden text-sm">
        <div className="bg-teal-600 px-4 py-3 flex items-center justify-between">
          <span className="text-white font-semibold">Edit Program</span>
          <button onClick={handleCancel} className="text-teal-200 hover:text-white text-xs transition-colors">
            Cancel
          </button>
        </div>

        <div className="bg-white p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              value={draft.title}
              onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Goal</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              value={draft.goal}
              onChange={(e) => setDraft((p) => ({ ...p, goal: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Duration (weeks)</label>
            <input
              type="number" min={1}
              className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              value={draft.total_weeks}
              onChange={(e) => setDraft((p) => ({ ...p, total_weeks: Number(e.target.value) }))}
            />
          </div>

          <p className="text-xs font-medium text-slate-500 pt-1">Exercises</p>
          {draft.exercises.map((ex, i) => (
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

        <div className="px-4 py-3 bg-white border-t border-slate-100">
          <button
            onClick={handleSaveChanges}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-teal-200 overflow-hidden text-sm">
      {/* Header */}
      <div className="bg-teal-600 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-white font-semibold leading-snug">{program.title}</p>
            <p className="text-teal-100 text-xs mt-0.5 leading-snug">{program.goal}</p>
          </div>
          <span className="shrink-0 bg-teal-500/50 text-teal-50 text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
            {program.total_weeks}w program
          </span>
        </div>
      </div>

      {/* Exercise list */}
      <div className="bg-white divide-y divide-slate-100">
        {program.exercises.map((ex, i) => (
          <div key={i}>
            <button
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <div className="min-w-0">
                <p className="text-slate-800 font-medium truncate">{ex.name}</p>
                <p className="text-teal-600 text-xs mt-0.5">{formatParams(ex)}</p>
              </div>
              <svg
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${expanded === i ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expanded === i && (
              <div className="px-4 pb-3 space-y-1.5 text-xs text-slate-600 bg-slate-50 border-t border-slate-100">
                <p className="leading-relaxed pt-2">{ex.instructions}</p>
                {ex.progression_notes && (
                  <p className="text-teal-700 italic">↑ {ex.progression_notes}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-white border-t border-slate-100 flex gap-2">
        <button
          onClick={() => onSave(program)}
          disabled={isSaved}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:bg-teal-100 disabled:text-teal-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSaved ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h6l4 4v12a2 2 0 01-2 2H7a2 2 0 01-2-2V5z" />
              </svg>
              Save Program
            </>
          )}
        </button>
        <button
          onClick={() => setEditing(true)}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Modify
        </button>
      </div>
    </div>
  );
}
