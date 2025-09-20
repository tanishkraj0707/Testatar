export type FeedbackPreference = 'full' | 'summary';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface UserProfile {
  name: string;
  grade: number;
  dob: string;
  board: string; // Changed to string to accommodate more boards
  badges: string[];
  feedbackPreference?: FeedbackPreference;
}

export interface Question {
  questionText: string;
  questionType: 'MCQ' | 'SHORT' | 'LONG';
  marks: number;
  topic: string;
  options?: string[];
  correctOptionIndex?: number;
  modelAnswer?: string;
}

export interface Test {
  id: string;
  subject: string;
  chapter: string; // Will be used for topic
  questions: Question[];
}

export interface Answer {
  questionIndex: number;
  selectedOptionIndex?: number;
  writtenAnswer?: string;
  isCorrect?: boolean;
  solution?: string;
}

export interface Report {
  id:string;
  subject: string;
  chapter: string;
  score: number;
  totalMarks: number;
  marksScored: number;
  totalQuestions: number;
  correctAnswers: number;
  timeTaken: number; // in seconds
  date: string;
  weakAreas: string[];
  answers: Answer[];
  questions: Question[];
  feedbackPreference: FeedbackPreference;
}

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    sources?: { title: string; uri: string }[];
}

export interface Goal {
  id: string;
  description: string;
  type: 'completion' | 'improvement';
  subject: string; // 'Any' for all subjects
  targetValue: number;
  currentValue: number;
  timeframe: 'week' | 'month';
  startDate: string;
  status: 'active' | 'completed';
}

export type AppView = 
  | 'welcome' 
  | 'dashboard' 
  | 'createTest' 
  | 'test' 
  | 'results' 
  | 'reports' 
  | 'reportDetail'
  | 'tutor'
  | 'studyNotes'
  | 'poemsAndStories'
  | 'settings'
  | 'goals'
  | 'studyPlanner';