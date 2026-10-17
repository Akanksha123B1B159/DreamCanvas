/**
 * Unit 4.A: Distributed Object-Based Systems
 * Decoupled Service Object Interfaces defining the contracts for DreamCanvas services.
 */

export interface RoadmapGenerationRequest {
  userId: string;
  targetRole: string;
  currentSkills: string[];
  durationDays?: number;
}

export interface RoadmapGenerationResponse {
  roadmapId: string;
  targetRole: string;
  missingSkills: string[];
  days: Array<{ day: number; topic: string; subtasks: string[] }>;
  generatedAt: string;
}

export interface IRoadmapService {
  generateRoadmap(req: RoadmapGenerationRequest): Promise<RoadmapGenerationResponse>;
  getRoadmap(roadmapId: string): Promise<RoadmapGenerationResponse | null>;
  queueAsyncRoadmap(req: RoadmapGenerationRequest): Promise<{ jobId: string; status: string }>;
}

export interface JobAnalysisRequest {
  jobDescription: string;
  requestId?: string;
}

export interface JobAnalysisResponse {
  prediction: 'REAL' | 'FAKE';
  confidence: number;
  explanation?: string;
  safetyAdvice?: string;
  timestamp: string;
}

export interface IJobAnalysisService {
  analyzeJob(req: JobAnalysisRequest): Promise<JobAnalysisResponse>;
  getExplanation(jobDescription: string, prediction: number): Promise<string>;
}

export interface ChatMessageRequest {
  userId: string;
  message: string;
  roleContext?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface IAIChatService {
  sendQuery(req: ChatMessageRequest): Promise<{ reply: string; timestamp: string }>;
}

export interface IResourceService {
  fetchVideosForTopic(topic: string, maxResults?: number): Promise<Array<{ title: string; url: string; thumbnail: string }>>;
}

export interface IProgressService {
  recordTaskCompletion(userId: string, day: number, taskId: string): Promise<{ streak: number; badgesUnlocked: string[] }>;
  getUserProgress(userId: string): Promise<{ completedDays: number[]; streakCount: number; badges: string[] }>;
}
