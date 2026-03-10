export interface BunkerIdea {
  id: number;
  title: string;
  description: string;
}

export interface Project {
  id: string;
  projectName: string;
  selectedIdea: string;
  finalStyle: string;
  visualMood: string;
  constructionIntensity: string;
  notes: string;
  projectSummary: string;
  createdAt: string;
  qualityMode: QualityMode;
}

export interface Scene {
  id: string;
  projectId: string;
  sceneNumber: number;
  sceneTitle: string;
  imagePrompt: string;
  animationPrompt: string;
  soundPrompt: string;
  referenceImageUrl: string | null;
  outputImageUrl: string | null;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  narrationText: string;
  soundFxNotes: string;
  ambienceNotes: string;
  narrationAudioUrl: string | null;
}

export interface Transition {
  id: string;
  projectId: string;
  transitionNumber: number;
  fromScene: number;
  toScene: number;
  animationPrompt: string;
  startImageUrl: string | null;
  endImageUrl: string | null;
  outputVideoUrl: string | null;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  providerMode: string;
  videoModel: string;
}

export type QualityMode = 'fast' | 'balanced' | 'quality';

export type WorkflowStep = 'ideas' | 'create' | 'plan' | 'scenes' | 'continuity' | 'transitions' | 'audio' | 'export';

export interface QualityPreset {
  label: string;
  description: string;
  planning: string;
  image: string;
  imageRefinement?: string;
  video: string;
  voice: string;
}

export const QUALITY_PRESETS: Record<QualityMode, QualityPreset> = {
  fast: {
    label: 'Fast',
    description: 'Quick drafts for testing. Lower quality, faster results.',
    planning: 'google/gemini-2.5-flash',
    image: 'google/gemini-2.5-flash-image',
    video: 'veo-3.1-fast-generate-preview',
    voice: 'gemini-2.5-flash-preview-tts',
  },
  balanced: {
    label: 'Balanced',
    description: 'Good quality with reasonable speed. Recommended for most projects.',
    planning: 'google/gemini-2.5-pro',
    image: 'google/gemini-2.5-flash-image',
    video: 'veo-3.0-generate-001',
    voice: 'gemini-2.5-pro-preview-tts',
  },
  quality: {
    label: 'Quality',
    description: 'Best possible output. Slower generation, highest fidelity.',
    planning: 'google/gemini-2.5-pro',
    image: 'google/gemini-3.1-flash-image-preview',
    imageRefinement: 'google/gemini-3-pro-image-preview',
    video: 'veo-3.1-generate-preview',
    voice: 'gemini-2.5-pro-preview-tts',
  },
};

export interface ContinuityProfile {
  bunkerIdentity: string;
  environmentSummary: string;
  cameraFramingRules: string;
  architecturalAnchors: string;
  lightingStyleRules: string;
  materialPalette: string;
  finalDesignTarget: string;
  visualConstraints: string;
  negativeConstraints: string;
}
