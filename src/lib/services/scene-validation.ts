/**
 * Scene Validation Gate
 * Validates continuity across scenes before allowing transition generation.
 */

import { SceneData } from '@/lib/store';

export interface ValidationResult {
  passed: boolean;
  warnings: ValidationWarning[];
  critical: boolean;
}

export interface ValidationWarning {
  sceneNumber: number;
  type: 'identity' | 'camera' | 'framing' | 'environment' | 'progression' | 'redesign' | 'drift';
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

const SCENE_STAGES: Record<number, string> = {
  1: 'abandoned_exterior',
  2: 'approach_exterior',
  3: 'exterior_work_start',
  4: 'exterior_near_complete',
  5: 'underground_entry',
  6: 'interior_construction',
  7: 'interior_finalization',
  8: 'interior_design',
  9: 'final_reveal',
};

/**
 * Validate all scenes for continuity before transition generation.
 * This is a heuristic check based on prompt content and scene metadata.
 */
export function validateSceneContinuity(scenes: SceneData[]): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const completedScenes = scenes.filter(s => s.status === 'completed' && s.output_image_url);

  // Check: all scenes must be completed
  if (completedScenes.length < 9) {
    warnings.push({
      sceneNumber: 0,
      type: 'progression',
      severity: 'critical',
      message: `Only ${completedScenes.length}/9 scenes are generated. All scenes must be completed before transitions.`,
    });
  }

  // Check sequential progression
  for (let i = 1; i < completedScenes.length; i++) {
    const prev = completedScenes[i - 1];
    const curr = completedScenes[i];

    // Check: scene should reference previous scene
    if (!curr.reference_image_url && curr.scene_number > 1) {
      warnings.push({
        sceneNumber: curr.scene_number,
        type: 'drift',
        severity: 'warning',
        message: `Scene ${curr.scene_number} was not generated with a reference to Scene ${curr.scene_number - 1}. Visual drift is likely.`,
      });
    }

    // Check: dramatic jumps in stage type
    const prevStage = SCENE_STAGES[prev.scene_number] || '';
    const currStage = SCENE_STAGES[curr.scene_number] || '';
    if (prevStage.includes('exterior') && currStage.includes('interior') && curr.scene_number !== 5) {
      warnings.push({
        sceneNumber: curr.scene_number,
        type: 'environment',
        severity: 'warning',
        message: `Scene ${curr.scene_number} jumps from exterior to interior unexpectedly. Check environment consistency.`,
      });
    }
  }

  // Check for missing reference chain
  const firstWithoutRef = completedScenes.find(s => s.scene_number > 1 && !s.reference_image_url);
  if (firstWithoutRef) {
    warnings.push({
      sceneNumber: firstWithoutRef.scene_number,
      type: 'identity',
      severity: 'warning',
      message: `Reference chain broken at Scene ${firstWithoutRef.scene_number}. Bunker identity may differ.`,
    });
  }

  const critical = warnings.some(w => w.severity === 'critical');
  return {
    passed: !critical,
    warnings,
    critical,
  };
}

/**
 * Check if a single scene has potential continuity issues.
 */
export function checkSceneContinuity(scene: SceneData, prevScene: SceneData | null): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (scene.scene_number > 1 && !scene.reference_image_url) {
    warnings.push({
      sceneNumber: scene.scene_number,
      type: 'drift',
      severity: 'warning',
      message: 'Generated without reference to previous scene.',
    });
  }

  if (prevScene && prevScene.status !== 'completed') {
    warnings.push({
      sceneNumber: scene.scene_number,
      type: 'progression',
      severity: 'warning',
      message: 'Previous scene not completed before this one.',
    });
  }

  return warnings;
}
