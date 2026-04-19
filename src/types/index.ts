export type UserRole = 'applicant' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  phone?: string;
  department?: string;
  bio?: string;
  country?: string;
  role: UserRole;
  completedTest: boolean;
  isBlocked?: boolean;
  assignedTeamId?: string | null;
  attendancePercentage?: number;
  attendedSessionsCount?: number;
  absentSessionsCount?: number;
  createdAt: string;
}

export interface Traits {
  O: number;
  C: number;
  E: number;
  A: number;
  N: number;
}

export interface Question {
  id: string;
  text: string;
  textAr?: string;
  trait: keyof Traits;
  active: boolean;
  order: number;
}

export interface TestResponse {
  id?: string;
  userId: string;
  questionId: string;
  value: number;
  timestamp: string;
}

export type UserRoleType = 
  | 'The Leader' 
  | 'The Strategist' 
  | 'The Executor' 
  | 'The Thinker' 
  | 'The Supporter' 
  | 'The Challenger' 
  | 'The Stabilizer' 
  | 'The Sensitive Contributor' 
  | 'General Contributor';

export interface PersonalityProfile {
  type: string;
  type_ar: string;
  bestRole: string;
  bestRole_ar: string;
  description: string;
  description_ar: string;
}

export interface UserScore {
  userId: string;
  traits: Traits;
  role: string; // Keep for backward compatibility or general type
  personalityType: string;
  personalityTypeAr: string;
  bestRole: string;
  bestRoleAr: string;
  description: string;
  descriptionAr: string;
  leaderScore: number;
  leadershipPotential: 'High' | 'Medium' | 'Low';
  primaryTrait?: string; // For dashboard charts
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  minSize: number;
  maxSize: number;
  memberCount: number;
}

export interface Assignment {
  id: string;
  userId: string;
  teamId: string;
  assignedBy: string;
  timestamp: string;
}

export interface Session {
  id: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  date: string;
  durationMinutes: number;
  endTime: string;
  link?: string;
  type: 'live' | 'recorded' | 'workshop';
  active: boolean;
  hasQuiz: boolean;
  imageUrl?: string;
  createdAt: string;
}

export interface SessionQuestion {
  id: string;
  sessionId: string;
  text: string;
  textAr: string;
  options: string[];
  optionsAr: string[];
  correctOptionIndex: number;
  order: number;
}

export interface SessionQuizResult {
  id: string;
  sessionId: string;
  userId: string;
  score: number;
  totalQuestions: number;
  completedAt: string;
}

export interface SessionFeedback {
  id: string;
  sessionId: string;
  userId: string;
  overallRating: number;
  topicRating: number;
  instructorRating: number;
  benefitRating: number;
  comment?: string;
  createdAt: string;
}
