/**
 * Export Packaging Service
 * Handles manifest generation and clean asset packaging.
 * Correctly identifies file types: images = PNG, videos = MP4.
 * Includes full transition mode metadata per-transition.
 */

import { SceneData, TransitionData, ProjectData } from '../store';
import { getProviderCapability, getModeLabel, isEndFrameExact, type TransitionMode } from './provider-capabilities';
import { QualityMode, QUALITY_PRESETS } from '../types';

export interface TransitionExportMeta {
  number: number;
  fromScene: number;
  toScene: number;
  status: string;
  assetPath: string | null;
  assetUrl: string | null;
  assetType: 'video/mp4' | null;
  transitionMode: string;
  endFrameExact: boolean;
  startImageUsed: boolean;
  endImageUsed: boolean;
  videoModel: string | null;
  requestType: string;
  promptType: string;
  continuityProfileUsed: boolean;
  warnings: string[];
}

export interface ExportManifest {
  version: string;
  exportedAt: string;
  project: {
    id: string;
    name: string;
    idea: string;
    style: string;
    mood: string;
    intensity: string;
    summary: string | null;
    qualityMode: QualityMode;
  };
  models: {
    planning: string;
    image: string;
    video: string;
    voice: string;
  };
  renderSettings: {
    aspectRatio: string;
    orientation: string;
    targetPlatform: string;
  };
  provider: {
    name: string;
    model: string;
    transitionMode: string;
    transitionModeLabel: string;
    supportsStartFrame: boolean;
    supportsEndFrame: boolean;
    supportsMultiKeyframe: boolean;
    endFrameExact: boolean;
    notes: string;
    providerNotes: string;
    limitations: string;
  };
  scenes: {
    number: number;
    title: string;
    status: string;
    assetPath: string | null;
    assetUrl: string | null;
    assetType: 'image/png' | null;
  }[];
  transitions: TransitionExportMeta[];
  audio: {
    voiceoverScript: string;
    musicDirection: string;
    sceneNarrations: { sceneNumber: number; text: string; audioUrl: string | null }[];
  };
  folders: string[];
  generatedAt: {
    planTimestamp: string;
    exportTimestamp: string;
  };
}

export function buildManifest(
  project: ProjectData,
  scenes: SceneData[],
  transitions: TransitionData[]
): ExportManifest {
  const videoModel = project.video_model || 'veo-3.0-generate-001';
  const capability = getProviderCapability(videoModel);
  const preset = QUALITY_PRESETS[project.quality_mode || 'balanced'];
  const hasContinuityProfile = !!project.continuity_profile;

  return {
    version: '3.0.0',
    exportedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.project_name,
      idea: project.selected_idea,
      style: project.final_style,
      mood: project.visual_mood,
      intensity: project.construction_intensity,
      summary: project.project_summary,
      qualityMode: project.quality_mode || 'balanced',
    },
    models: {
      planning: project.planning_model || preset.planning,
      image: project.image_model || preset.image,
      video: project.video_model || preset.video,
      voice: project.voice_model || preset.voice,
    },
    renderSettings: {
      aspectRatio: '9:16',
      orientation: 'vertical',
      targetPlatform: 'Shorts / Reels / TikTok',
    },
    provider: {
      name: capability.provider,
      model: capability.model,
      transitionMode: capability.effectiveMode,
      transitionModeLabel: getModeLabel(capability.effectiveMode),
      supportsStartFrame: capability.supportsStartFrame,
      supportsEndFrame: capability.supportsEndFrame,
      supportsMultiKeyframe: capability.supportsMultiKeyframe,
      endFrameExact: capability.supportsEndFrame,
      notes: capability.notes,
      providerNotes: capability.providerNotes,
      limitations: capability.supportsEndFrame
        ? 'None — full dual-frame support.'
        : 'End frame is prompt-guided, not enforced. Final video frame may not exactly match the target scene image. This is a provider limitation, not a bug.',
    },
    scenes: scenes.map((s) => ({
      number: s.scene_number,
      title: s.scene_title,
      status: s.status,
      assetPath: s.output_image_url ? `/scenes/scene_${s.scene_number}.png` : null,
      assetUrl: s.output_image_url,
      assetType: s.output_image_url ? 'image/png' as const : null,
    })),
    transitions: transitions.map((t) => {
      const tMode = (t.provider_mode || capability.effectiveMode) as TransitionMode;
      const tIsExact = isEndFrameExact(tMode);
      const warnings: string[] = [];

      if (!tIsExact && t.end_image_url) {
        warnings.push('End image was available but NOT enforced as a keyframe due to provider limitations.');
      }
      if (!t.start_image_url) {
        warnings.push('Start image was not available — text-only generation used.');
      }

      return {
        number: t.transition_number,
        fromScene: t.from_scene,
        toScene: t.to_scene,
        status: t.status,
        assetPath: t.output_video_url ? `/transitions/transition_${t.transition_number}.mp4` : null,
        assetUrl: t.output_video_url,
        assetType: t.output_video_url ? 'video/mp4' as const : null,
        transitionMode: tMode,
        endFrameExact: tIsExact,
        startImageUsed: !!t.start_image_url,
        endImageUsed: !!t.end_image_url,
        videoModel: t.video_model || null,
        requestType: tIsExact ? 'exact_dual_frame' : 'guided_start_target',
        promptType: tIsExact ? 'exact_dual_frame' : 'guided_start_target',
        continuityProfileUsed: hasContinuityProfile,
        warnings,
      };
    }),
    audio: {
      voiceoverScript: project.voiceover_script || '',
      musicDirection: project.music_direction || '',
      sceneNarrations: scenes.map(s => ({
        sceneNumber: s.scene_number,
        text: s.narration_text || '',
        audioUrl: s.narration_audio_url,
      })),
    },
    folders: ['/scenes', '/transitions', '/audio', '/prompts', '/metadata'],
    generatedAt: {
      planTimestamp: project.created_at,
      exportTimestamp: new Date().toISOString(),
    },
  };
}

export type ExportCategory = 'all' | 'scenes' | 'transitions' | 'audio' | 'prompts' | 'metadata';

export function getExportAssetList(
  scenes: SceneData[],
  transitions: TransitionData[]
): { category: string; filename: string; type: string; ready: boolean }[] {
  const assets: { category: string; filename: string; type: string; ready: boolean }[] = [];

  scenes.forEach(s => {
    assets.push({
      category: 'scenes',
      filename: `scene_${s.scene_number}.png`,
      type: 'image/png',
      ready: !!s.output_image_url,
    });
  });

  transitions.forEach(t => {
    assets.push({
      category: 'transitions',
      filename: `transition_${t.transition_number}.mp4`,
      type: 'video/mp4',
      ready: !!t.output_video_url,
    });
  });

  scenes.forEach(s => {
    if (s.narration_audio_url) {
      assets.push({
        category: 'audio',
        filename: `narration_scene_${s.scene_number}.mp3`,
        type: 'audio/mpeg',
        ready: true,
      });
    }
  });

  assets.push(
    { category: 'prompts', filename: 'image_prompts.txt', type: 'text/plain', ready: true },
    { category: 'prompts', filename: 'animation_prompts.txt', type: 'text/plain', ready: true },
    { category: 'prompts', filename: 'sound_prompts.txt', type: 'text/plain', ready: true },
    { category: 'prompts', filename: 'narration_prompts.txt', type: 'text/plain', ready: true },
    { category: 'prompts', filename: 'project_summary.txt', type: 'text/plain', ready: true },
    { category: 'metadata', filename: 'manifest.json', type: 'application/json', ready: true },
  );

  return assets;
}
