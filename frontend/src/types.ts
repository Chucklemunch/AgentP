export interface Exercise {
  name: string;
  sets: number | null;
  reps: number | null;
  duration_seconds: number | null;
  suggested_rep_range: string | null;
  rir: number | null;
  frequency_per_week: number;
  instructions: string;
  progression_notes: string | null;
}

export interface ExerciseProgram {
  id: string;
  title: string;
  goal: string;
  exercises: Exercise[];
  total_weeks: number;
  created_at: string;
}

export interface LibraryExercise {
  id: string;
  name: string;
  default_sets: number | null;
  default_reps: number | null;
  default_duration_seconds: number | null;
  default_frequency_per_week: number;
  instructions: string;
  is_custom: boolean;
}

export interface Message {
  role: 'user' | 'perry';
  content: string;
  program?: ExerciseProgram;
  programLoading?: boolean;
}
