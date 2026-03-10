import { create } from 'zustand';
import { WorkflowStep, QualityMode } from './types';

export interface ProjectData {
  id: string;
  project_name: string;
  selected_idea: string;
  final_style: string;
  visual_mood: string;
  construction_intensity: string;
  notes: string | null;
  project_summary: string | null;
  created_at: string;
  quality_mode: QualityMode;
  continuity_profile: any | null;
  voiceover_script: string;
  music_direction: string;
  planning_model: string;
  image_model: string;
  video_model: string;
  voice_model: string;
}

export interface SceneData {
  id: string;
  project_id: string;
  scene_number: number;
  scene_title: string;
  image_prompt: string;
  animation_prompt: string;
  sound_prompt: string;
  reference_image_url: string | null;
  output_image_url: string | null;
  status: string;
  narration_text: string;
  sound_fx_notes: string;
  ambience_notes: string;
  narration_audio_url: string | null;
}

export interface TransitionData {
  id: string;
  project_id: string;
  transition_number: number;
  from_scene: number;
  to_scene: number;
  animation_prompt: string;
  start_image_url: string | null;
  end_image_url: string | null;
  output_video_url: string | null;
  status: string;
  provider_mode: string;
  video_model: string;
}

interface AppState {
  currentStep: WorkflowStep;
  selectedIdeaId: number | null;
  qualityMode: QualityMode;
  project: ProjectData | null;
  scenes: SceneData[];
  transitions: TransitionData[];
  loading: boolean;
  error: string | null;
  setStep: (step: WorkflowStep) => void;
  selectIdea: (id: number) => void;
  setQualityMode: (mode: QualityMode) => void;
  setProject: (project: ProjectData) => void;
  setScenes: (scenes: SceneData[]) => void;
  setTransitions: (transitions: TransitionData[]) => void;
  updateScene: (sceneId: string, updates: Partial<SceneData>) => void;
  updateTransition: (transitionId: string, updates: Partial<TransitionData>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentStep: 'ideas',
  selectedIdeaId: null,
  qualityMode: 'balanced',
  project: null,
  scenes: [],
  transitions: [],
  loading: false,
  error: null,
  setStep: (step) => set({ currentStep: step }),
  selectIdea: (id) => set({ selectedIdeaId: id }),
  setQualityMode: (mode) => set({ qualityMode: mode }),
  setProject: (project) => set({ project }),
  setScenes: (scenes) => set({ scenes }),
  setTransitions: (transitions) => set({ transitions }),
  updateScene: (sceneId, updates) =>
    set((state) => ({
      scenes: state.scenes.map((s) =>
        s.id === sceneId ? { ...s, ...updates } : s
      ),
    })),
  updateTransition: (transitionId, updates) =>
    set((state) => ({
      transitions: state.transitions.map((t) =>
        t.id === transitionId ? { ...t, ...updates } : t
      ),
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      currentStep: 'ideas',
      selectedIdeaId: null,
      qualityMode: 'balanced',
      project: null,
      scenes: [],
      transitions: [],
      loading: false,
      error: null,
    }),
}));
