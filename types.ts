
export interface Position {
  x: number;
  y: number;
}

// Base content structure
export interface LessonContent {
  title?: string;
  summary?: string; // Used for brief explanations
  details?: string; // Used for long explanations
  bulletPoints?: string[]; // Used for sub-points in detail view
  learningPoints?: string[]; // New: List of topics for Sub-chapters
  quiz?: {
    question: string;
    options: string[];
    correctAnswer: number;
  };
}

export type NodeType = 'root' | 'chapter' | 'subchapter' | 'detail';

export interface NodeData {
  id: string;
  parentId: string | null;
  title: string;
  position: Position;
  level: number; 
  nodeType: NodeType; 
  collapsed?: boolean; // Tracks if children are hidden
  contentMinimized?: boolean; // New: Tracks if own content is hidden (Title only mode)
  height?: number; 
  isLoading?: boolean; // New: Visual state for sequential generation
  data?: {
    summary?: string;
    details?: string;
    bulletPoints?: string[];
    learningPoints?: string[]; // New
    quiz?: LessonContent['quiz'];
  };
}

export interface CanvasState {
  offset: Position;
  scale: number;
}

// For AI Responses
export interface GeneratedChapter {
  title: string;
  briefDescription: string;
}

export interface GeneratedSubChapter {
  title: string;
  learningPoints: string[]; // Changed from keyPointSummary string to array
}

export interface GeneratedDetail {
  title: string;
  comprehensiveExplanation: string;
  corePoints: string[];
}
