/**
 * Motion Presets for Bunker Restoration Transitions
 * Each preset defines strict control values and scene-type overrides.
 */

export interface MotionPreset {
  id: string;
  label: string;
  description: string;
  controls: {
    motionStrength: number;
    cameraIntensity: number;
    realismPriority: number;
    morphSuppression: number;
    targetStrictness: number;
    continuityStrictness: number;
  };
}

export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: 'static_realism',
    label: 'Static Realism',
    description: 'Almost no motion. Camera locked. Maximum realism. Best for exterior establishing shots.',
    controls: {
      motionStrength: 5,
      cameraIntensity: 0,
      realismPriority: 99,
      morphSuppression: 99,
      targetStrictness: 95,
      continuityStrictness: 99,
    },
  },
  {
    id: 'minimal_motion',
    label: 'Minimal Motion',
    description: 'Default. Very subtle dust, light flicker, tiny localized changes. Near-static camera.',
    controls: {
      motionStrength: 20,
      cameraIntensity: 5,
      realismPriority: 95,
      morphSuppression: 98,
      targetStrictness: 90,
      continuityStrictness: 98,
    },
  },
  {
    id: 'soft_construction',
    label: 'Soft Construction',
    description: 'Subtle construction activity. Slight dust, small debris movement, very slow camera drift.',
    controls: {
      motionStrength: 30,
      cameraIntensity: 10,
      realismPriority: 92,
      morphSuppression: 95,
      targetStrictness: 85,
      continuityStrictness: 96,
    },
  },
  {
    id: 'controlled_interior',
    label: 'Controlled Interior',
    description: 'Tiny localized interior activity. Soft light shifts. Near-static camera with minimal reveal.',
    controls: {
      motionStrength: 25,
      cameraIntensity: 8,
      realismPriority: 93,
      morphSuppression: 96,
      targetStrictness: 88,
      continuityStrictness: 97,
    },
  },
  {
    id: 'final_reveal_polish',
    label: 'Final Reveal Polish',
    description: 'Slightly more polished motion for the final reveal. Still restrained and realistic.',
    controls: {
      motionStrength: 35,
      cameraIntensity: 12,
      realismPriority: 90,
      morphSuppression: 94,
      targetStrictness: 85,
      continuityStrictness: 95,
    },
  },
];

export const DEFAULT_PRESET_ID = 'minimal_motion';

export function getDefaultPreset(): MotionPreset {
  return MOTION_PRESETS.find(p => p.id === DEFAULT_PRESET_ID)!;
}

export function getPresetById(id: string): MotionPreset | undefined {
  return MOTION_PRESETS.find(p => p.id === id);
}

/**
 * Get the recommended preset based on scene stage.
 * Scenes 1-4: exterior work → static_realism or minimal_motion
 * Scene 5: underground reveal → controlled_interior
 * Scenes 6-8: interior work → controlled_interior
 * Scene 8-9: final reveal → final_reveal_polish
 */
export function getRecommendedPresetForTransition(fromScene: number, toScene: number): MotionPreset {
  if (toScene <= 2) return MOTION_PRESETS.find(p => p.id === 'static_realism')!;
  if (toScene <= 4) return MOTION_PRESETS.find(p => p.id === 'minimal_motion')!;
  if (toScene === 5) return MOTION_PRESETS.find(p => p.id === 'controlled_interior')!;
  if (toScene <= 7) return MOTION_PRESETS.find(p => p.id === 'soft_construction')!;
  if (toScene === 8) return MOTION_PRESETS.find(p => p.id === 'controlled_interior')!;
  return MOTION_PRESETS.find(p => p.id === 'final_reveal_polish')!;
}
