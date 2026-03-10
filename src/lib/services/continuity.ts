/**
 * Continuity Manager
 * Maintains visual identity across all scenes in a project.
 * Persisted per-project as a JSONB field.
 */

import { ContinuityProfile } from '../types';

export function buildContinuityProfile(
  selectedIdea: string,
  finalStyle: string,
  visualMood: string,
  constructionIntensity: string,
  notes?: string
): ContinuityProfile {
  return {
    bunkerIdentity: `A ${selectedIdea} bunker. This is the same exact bunker throughout all 9 scenes — do not change the bunker identity, architecture, structural layout, or location at any point.`,
    environmentSummary: `The surrounding environment must remain perfectly consistent. The same geography, terrain, weather conditions, and atmospheric quality. Lighting may shift naturally for time-of-day changes only.`,
    cameraFramingRules: `Maintain an identical camera angle, focal length, perspective, and composition across all scenes. The camera does not jump, teleport, or reset. Slow subtle movement is acceptable if consistent in direction.`,
    architecturalAnchors: `Key architectural features (entrance, blast door, walls, corridors, rooms, structural beams) must remain in the exact same position and proportion. Construction changes are strictly additive — they build on the previous scene and never contradict it.`,
    lightingStyleRules: `Lighting style: "${visualMood}" mood. Exterior scenes use natural environmental lighting. Interior scenes transition from harsh work lights to designed ambient lighting as restoration progresses. No sudden lighting style jumps between consecutive scenes.`,
    materialPalette: `Materials must be consistent with the "${selectedIdea}" setting. Construction materials appear in a believable sequence: demolition debris → structural repair → surface finishing → design elements. No materials that contradict the bunker type or setting.`,
    finalDesignTarget: `The final restored interior uses a "${finalStyle}" design style with a "${visualMood}" mood. Construction intensity is "${constructionIntensity}". ${notes || ''}. The final reveal must feel like a natural culmination of all previous scenes.`,
    visualConstraints: `Every scene must be vertical 9:16 portrait format. Photorealistic, cinematic, high detail. No stylistic changes between scenes. The visual language (color grading, grain, contrast) must remain consistent.`,
    negativeConstraints: `NEVER: change bunker layout, swap to a different location, reset the camera, add random objects not present in the setting, use fantasy/surreal elements, show instant transformation, use morphing effects, change the structural geometry, contradict previous construction progress.`,
  };
}

export function continuityToPromptBlock(profile: ContinuityProfile): string {
  return [
    `CONTINUITY RULES (MANDATORY — VIOLATION = FAILURE):`,
    `- BUNKER IDENTITY: ${profile.bunkerIdentity}`,
    `- ENVIRONMENT: ${profile.environmentSummary}`,
    `- CAMERA: ${profile.cameraFramingRules}`,
    `- ARCHITECTURE: ${profile.architecturalAnchors}`,
    `- LIGHTING: ${profile.lightingStyleRules}`,
    `- MATERIALS: ${profile.materialPalette}`,
    `- DESIGN TARGET: ${profile.finalDesignTarget}`,
    `- VISUAL FORMAT: ${profile.visualConstraints}`,
    `- FORBIDDEN: ${profile.negativeConstraints}`,
  ].join('\n');
}

export { type ContinuityProfile };
