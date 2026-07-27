export interface UserProfile {
  height: number;
  weight: number;
  bodyFat: number;
  trainingDays: number;
  experience: string;
  goal: string;
  equipment: string[];
  strengthLevel: "新手" | "有一定基础" | "进阶";
}

export interface Exercise {
  id: string;
  name: string;
  targetSets: number;
  targetReps: number;
  targetWeight: number;
  baseWeight: number;
  restSeconds: number;
  sortOrder: number;
  previousWeight?: number;
  previousReps?: number;
}

export interface TrainingBlock {
  name: string;
  duration: number;
  description: string;
  items: string[];
}

export interface TrainingDay {
  id: string;
  dayName: string;
  focusArea: string;
  exercises: Exercise[];
}

export interface TrainingPlan {
  id: string;
  name: string;
  cycleType: string;
  days: TrainingDay[];
}

export interface SetRecord {
  setNumber: number;
  actualWeight: number;
  actualReps: number;
  completed: boolean;
}

export interface ExerciseRecord {
  exerciseId: string;
  exerciseName: string;
  sets: SetRecord[];
}

export interface WorkoutSession {
  id: string;
  planDayId: string;
  startedAt: string;
  exercises: ExerciseRecord[];
}

export interface BodyRecord {
  date: string;
  weight: number;
  bodyFat?: number;
}

export interface StrengthData {
  date: string;
  exercise: string;
  weight: number;
}
