/**
 * Provider Capability Layer
 * Detects and reports what each video generation provider supports.
 * Honest about limitations — never claims features that don't exist.
 */

export type TransitionMode = 
  | 'text_only'              // No image conditioning at all
  | 'start_frame_only'       // Provider only accepts a start image
  | 'guided_start_frame'     // Start frame + strong prompt conditioning toward end frame
  | 'exact_dual_frame'       // Provider supports exact start AND end keyframes
  | 'multi_keyframe';        // Provider supports multiple keyframes

export interface ProviderCapability {
  provider: string;
  model: string;
  supportsStartFrame: boolean;
  supportsEndFrame: boolean;
  supportsMultiKeyframe: boolean;
  supportsNegativePrompt: boolean;
  maxDurationSeconds: number;
  supportedAspectRatios: string[];
  effectiveMode: TransitionMode;
  notes: string;
  providerNotes: string;
  apiEndpoint: string;
  endFrameApiField?: string; // The actual API field name for end frame image, if supported
}

/**
 * Veo 2.0 — Legacy fallback
 * Start-frame only. No end-frame keyframe.
 */
export const VEO_2_CAPABILITY: ProviderCapability = {
  provider: 'Google Cloud',
  model: 'veo-2.0-generate-001',
  supportsStartFrame: true,
  supportsEndFrame: false,
  supportsMultiKeyframe: false,
  supportsNegativePrompt: false,
  maxDurationSeconds: 8,
  supportedAspectRatios: ['9:16', '16:9', '1:1'],
  effectiveMode: 'guided_start_frame',
  notes: 'Veo 2 accepts start-frame image-to-video only. End frame is prompt-guided, not enforced as a keyframe.',
  providerNotes: 'Legacy model. Use Veo 3+ for better quality.',
  apiEndpoint: 'predictLongRunning',
};

/**
 * Veo 3.0 — Balanced mode default
 * Start-frame only. Improved quality over Veo 2.
 */
export const VEO_3_CAPABILITY: ProviderCapability = {
  provider: 'Google Cloud',
  model: 'veo-3.0-generate-001',
  supportsStartFrame: true,
  supportsEndFrame: false,
  supportsMultiKeyframe: false,
  supportsNegativePrompt: false,
  maxDurationSeconds: 8,
  supportedAspectRatios: ['9:16', '16:9', '1:1'],
  effectiveMode: 'guided_start_frame',
  notes: 'Veo 3.0 accepts start-frame image-to-video. End frame is prompt-guided only.',
  providerNotes: 'Higher quality motion than Veo 2, but still cannot enforce exact end frame.',
  apiEndpoint: 'predictLongRunning',
};

/**
 * Veo 3.1 Fast — Fast mode
 */
export const VEO_31_FAST_CAPABILITY: ProviderCapability = {
  provider: 'Google Cloud',
  model: 'veo-3.1-fast-generate-preview',
  supportsStartFrame: true,
  supportsEndFrame: false,
  supportsMultiKeyframe: false,
  supportsNegativePrompt: false,
  maxDurationSeconds: 8,
  supportedAspectRatios: ['9:16', '16:9', '1:1'],
  effectiveMode: 'guided_start_frame',
  notes: 'Veo 3.1 Fast preview. Quick generation with start-frame support. End frame is prompt-guided only.',
  providerNotes: 'Fastest Veo option. No end-frame keyframe support.',
  apiEndpoint: 'predictLongRunning',
};

/**
 * Veo 3.1 Full — Quality mode
 */
export const VEO_31_CAPABILITY: ProviderCapability = {
  provider: 'Google Cloud',
  model: 'veo-3.1-generate-preview',
  supportsStartFrame: true,
  supportsEndFrame: false,
  supportsMultiKeyframe: false,
  supportsNegativePrompt: false,
  maxDurationSeconds: 8,
  supportedAspectRatios: ['9:16', '16:9', '1:1'],
  effectiveMode: 'guided_start_frame',
  notes: 'Veo 3.1 full quality preview. Best motion quality with start-frame support. End frame is prompt-guided only.',
  providerNotes: 'Highest quality Veo model. No end-frame keyframe support yet.',
  apiEndpoint: 'predictLongRunning',
};

// ────────────────────────────────────────────────────────────
// FUTURE: When a provider adds true dual-frame support, add it here.
// Example (not yet real):
//
// export const FUTURE_DUAL_FRAME_CAPABILITY: ProviderCapability = {
//   provider: 'FutureProvider',
//   model: 'future-dual-frame-v1',
//   supportsStartFrame: true,
//   supportsEndFrame: true,         // TRUE dual-frame
//   supportsMultiKeyframe: false,
//   supportsNegativePrompt: false,
//   maxDurationSeconds: 10,
//   supportedAspectRatios: ['9:16', '16:9', '1:1'],
//   effectiveMode: 'exact_dual_frame',
//   notes: 'Supports exact start AND end frame keyframes.',
//   providerNotes: 'Both frames are enforced as exact visual conditioning inputs.',
//   apiEndpoint: 'generateVideo',
//   endFrameApiField: 'lastFrame',
// };
// ────────────────────────────────────────────────────────────

const MODEL_CAPABILITY_MAP: Record<string, ProviderCapability> = {
  'veo-2.0-generate-001': VEO_2_CAPABILITY,
  'veo-3.0-generate-001': VEO_3_CAPABILITY,
  'veo-3.1-fast-generate-preview': VEO_31_FAST_CAPABILITY,
  'veo-3.1-generate-preview': VEO_31_CAPABILITY,
};

export function getProviderCapability(model?: string): ProviderCapability {
  if (model && MODEL_CAPABILITY_MAP[model]) {
    return MODEL_CAPABILITY_MAP[model];
  }
  return VEO_3_CAPABILITY; // Default balanced
}

export function getAllProviderCapabilities(): ProviderCapability[] {
  return Object.values(MODEL_CAPABILITY_MAP);
}

export function getModeLabel(mode: TransitionMode): string {
  switch (mode) {
    case 'exact_dual_frame': return 'Exact Dual-Frame';
    case 'start_frame_only': return 'Start Frame Only';
    case 'guided_start_frame': return 'Guided (Start Frame + Prompt)';
    case 'multi_keyframe': return 'Multi-Keyframe';
    case 'text_only': return 'Text Only';
  }
}

export function getModeDescription(mode: TransitionMode): string {
  switch (mode) {
    case 'exact_dual_frame':
      return 'Both start and end frames are enforced as exact keyframes via real API conditioning. The provider guarantees the video starts and ends on these exact images.';
    case 'guided_start_frame':
      return 'The start frame is used as the exact source image. The end frame is strongly referenced in the text prompt but NOT enforced as a keyframe — the provider generates a guided transition toward the target, but the final frame may not exactly match.';
    case 'start_frame_only':
      return 'Only the start frame is used as a visual anchor. The animation is driven entirely by the text prompt.';
    case 'multi_keyframe':
      return 'Multiple keyframes are supported at different timestamps in the video.';
    case 'text_only':
      return 'No image conditioning. The entire video is generated from text only.';
  }
}

export function isEndFrameExact(mode: TransitionMode): boolean {
  return mode === 'exact_dual_frame' || mode === 'multi_keyframe';
}

export function getHonestyLabel(mode: TransitionMode): { badge: string; color: string } {
  if (isEndFrameExact(mode)) {
    return { badge: 'EXACT', color: 'text-success' };
  }
  return { badge: 'GUIDED', color: 'text-spark' };
}

export function getModeBadgeVariant(mode: TransitionMode): { label: string; colorClass: string; description: string } {
  switch (mode) {
    case 'exact_dual_frame':
      return { label: 'Exact Dual-Frame', colorClass: 'text-success border-success/30 bg-success/5', description: 'Both start and end frames are real keyframes' };
    case 'guided_start_frame':
      return { label: 'Guided End Target', colorClass: 'text-spark border-spark/30 bg-spark/5', description: 'End frame is prompt-guided, not exact' };
    case 'start_frame_only':
      return { label: 'Start Frame Only', colorClass: 'text-muted-foreground border-border bg-muted/5', description: 'Only start frame is used' };
    case 'multi_keyframe':
      return { label: 'Multi-Keyframe', colorClass: 'text-success border-success/30 bg-success/5', description: 'Multiple keyframes at different timestamps' };
    case 'text_only':
      return { label: 'Text Only', colorClass: 'text-muted-foreground border-border bg-muted/5', description: 'No image conditioning' };
  }
}
