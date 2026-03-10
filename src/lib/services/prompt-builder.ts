/**
 * Prompt Builder Service
 * Constructs prompts for planning, scene images, transitions, audio, and voiceover.
 * All defaults target vertical 9:16 for Shorts/Reels/TikTok.
 * Shares a consistent internal language across all prompt types.
 * 
 * Transition prompts are split into two builders:
 * - buildExactDualFramePrompt: for providers with true start+end keyframe support
 * - buildGuidedStartTargetPrompt: for providers with start-frame only (end = prompt guidance)
 */

export const ASPECT_RATIO = '9:16';
export const ASPECT_LABEL = 'vertical 9:16 (Shorts/Reels/TikTok)';

export const SCENE_SEQUENCE = [
  { number: 1, title: 'Before', purpose: 'Establish the bunker in its original abandoned/ruined state', description: 'The bunker in its original abandoned/ruined state' },
  { number: 2, title: 'Arrival', purpose: 'Show the first human approach to the bunker', description: 'Approaching the bunker for the first time' },
  { number: 3, title: 'Exterior Work Start', purpose: 'Begin visible exterior restoration work', description: 'Beginning exterior restoration and cleanup' },
  { number: 4, title: 'Exterior Near Completion', purpose: 'Show exterior nearly finished', description: 'Exterior restoration nearly finished' },
  { number: 5, title: 'Entering Underground', purpose: 'First descent into interior spaces', description: 'First descent into the interior spaces' },
  { number: 6, title: 'Interior Work In Progress', purpose: 'Active interior construction phase', description: 'Active interior construction and renovation' },
  { number: 7, title: 'Interior Finalization', purpose: 'Structural interior work finishing up', description: 'Finishing structural interior work' },
  { number: 8, title: 'Interior Design Transformation', purpose: 'Install design elements and furnishings', description: 'Installing furnishings, lighting, and design elements' },
  { number: 9, title: 'Final Reveal', purpose: 'The dramatic completed reveal', description: 'The completed, fully restored bunker' },
] as const;

const SHARED_STYLE_RULES = [
  'Hyper-realistic photographic quality.',
  'Cinematic composition and color grading.',
  'Vertical 9:16 portrait aspect ratio.',
  'Same bunker identity throughout.',
  'Same environment and geography.',
  'Same camera angle and framing.',
  'Realistic construction progression only.',
  'No fantasy, no instant transformation.',
  'No dramatic motion or flashy animation.',
  'No camera orbit, swing, or fast zoom.',
  'No heavy morphing or surreal effects.',
];

const NEGATIVE_CONSTRAINTS = [
  'no random objects', 'no new location', 'no layout drift',
  'no camera reset', 'no structure redesign', 'no unrealistic morphing',
  'no sudden full completion', 'no surreal effects', 'no cartoon style',
  'no different bunker', 'no teleportation', 'no liquid dissolve',
  'no dramatic motion', 'no flashy animation', 'no orbit',
  'no whip movement', 'no fast zoom', 'no camera swing',
  'no heavy morphing', 'no extra workers unless strictly necessary',
  'no environment change', 'no unrealistic construction motion',
  'no exaggerated scene changes', 'no scene redesign',
  'no dramatic camera behavior', 'no instant material change',
];

export function buildPlanningPrompt(params: {
  selectedIdea: string;
  finalStyle: string;
  visualMood: string;
  constructionIntensity: string;
  projectName: string;
  notes?: string;
  continuityBlock: string;
}): string {
  const sceneListDescription = SCENE_SEQUENCE.map(s =>
    `Scene ${s.number} - ${s.title}: ${s.description} (Purpose: ${s.purpose})`
  ).join('\n');

  return `You are a cinematic bunker transformation planner for vertical short-form video content (TikTok, Reels, YouTube Shorts).

Create a detailed 9-scene transformation plan for:
- Bunker Idea: ${params.selectedIdea}
- Interior Style: ${params.finalStyle}
- Visual Mood: ${params.visualMood}
- Construction Intensity: ${params.constructionIntensity}
- Project Name: ${params.projectName}
${params.notes ? `- Additional Notes: ${params.notes}` : ''}

${params.continuityBlock}

The 9 scenes MUST follow this EXACT sequence:
${sceneListDescription}

CRITICAL REQUIREMENTS:
${SHARED_STYLE_RULES.map(r => `- ${r}`).join('\n')}

NEGATIVE CONSTRAINTS (never include):
${NEGATIVE_CONSTRAINTS.map(n => `- ${n}`).join('\n')}

For each scene provide:
1. scene_title: matching the sequence above
2. scene_purpose: why this scene exists in the narrative
3. image_prompt: detailed text-to-image prompt (photorealistic, cinematic, VERTICAL 9:16 portrait)
4. animation_prompt: camera movement + realistic construction motion for 5-second transition video
5. sound_prompt: environmental and ambient audio description
6. continuity_notes: what changed from the previous scene and what must remain the same
7. expected_visual_difference: brief description of the visible progress from the previous scene
8. narration_text: 1-2 sentence voiceover narration for this scene

Also provide:
- A voiceover_script: full narration script for the entire video
- music_direction: description of the ideal background music style and progression`;
}

export function buildSceneImagePrompt(
  sceneTitle: string,
  sceneNumber: number,
  imagePrompt: string,
  continuityBlock: string,
  projectContext: { selectedIdea: string; finalStyle: string; visualMood: string },
  hasPreviousScene: boolean,
  previousSceneTitle?: string
): string {
  const base = [
    imagePrompt,
    '',
    continuityBlock,
    '',
    `Scene ${sceneNumber} of 9 — "${sceneTitle}".`,
    `Project: ${projectContext.selectedIdea}, Style: ${projectContext.finalStyle}, Mood: ${projectContext.visualMood}.`,
    `Aspect ratio: ${ASPECT_RATIO} (vertical portrait). Photorealistic, cinematic, high detail.`,
    '',
    `NEGATIVE CONSTRAINTS: ${NEGATIVE_CONSTRAINTS.join(', ')}.`,
  ];

  if (hasPreviousScene) {
    base.unshift(
      `CRITICAL: This scene continues directly from Scene ${sceneNumber - 1} ("${previousSceneTitle || 'previous'}"). Use the provided reference image as the visual starting point. Show ONLY the realistic incremental progress from that state. Do NOT change the bunker, environment, or camera angle. The only visible changes should be the specific construction/restoration work for this phase.`
    );
  }

  return base.join('\n');
}

// ────────────────────────────────────────────────────────────
// TRANSITION PROMPT BUILDERS — EXACT vs GUIDED
// ────────────────────────────────────────────────────────────

export interface TransitionPromptParams {
  fromSceneTitle: string;
  toSceneTitle: string;
  fromSceneNumber: number;
  toSceneNumber: number;
  animationPrompt: string;
  toSceneImagePrompt?: string;
  motionStrength?: number;      // 0-100
  cameraIntensity?: number;     // 0-100
  realismPriority?: number;     // 0-100
  morphSuppression?: number;    // 0-100
  targetStrictness?: number;    // 0-100
  continuityStrictness?: number; // 0-100
}

function buildControlModifiers(params: TransitionPromptParams, isExact: boolean): string[] {
  const parts: string[] = [];
  
  const motionStrength = params.motionStrength ?? 50;
  const cameraIntensity = params.cameraIntensity ?? 30;
  const realismPriority = params.realismPriority ?? 80;
  const morphSuppression = params.morphSuppression ?? 90;
  const targetStrictness = params.targetStrictness ?? (isExact ? 95 : 70);
  const continuityStrictness = params.continuityStrictness ?? 90;

  if (motionStrength < 30) parts.push('Use very subtle, minimal motion.');
  else if (motionStrength > 70) parts.push('Use noticeable, dynamic construction motion.');
  
  if (cameraIntensity < 20) parts.push('Keep the camera completely static.');
  else if (cameraIntensity > 60) parts.push('Allow gentle camera drift or slow zoom.');
  
  if (realismPriority > 80) parts.push('Prioritize maximum photorealism over stylistic effects.');
  
  if (morphSuppression > 70) parts.push('Strongly suppress any morphing, warping, or liquid dissolve effects.');
  
  if (isExact && targetStrictness > 80) {
    parts.push('The final frame MUST closely match the end frame keyframe.');
  } else if (!isExact && targetStrictness > 70) {
    parts.push('Guide the transition strongly toward the target end state appearance.');
  }
  
  if (continuityStrictness > 80) {
    parts.push('Architectural continuity is critical — no structural changes beyond what the transition requires.');
  }

  return parts;
}

/**
 * Exact Dual-Frame Prompt
 * Used ONLY when the provider truly supports both start AND end frame as real keyframes.
 */
export function buildExactDualFramePrompt(params: TransitionPromptParams): string {
  const controlMods = buildControlModifiers(params, true);
  
  const parts = [
    `Use the first image as the EXACT start frame — the video MUST begin from this precise image.`,
    `Use the second image as the EXACT end frame — the video MUST end on this precise image.`,
    `Both frames are real visual conditioning keyframes enforced by the provider.`,
    ``,
    `Generate a realistic cinematic transition from Scene ${params.fromSceneNumber} ("${params.fromSceneTitle}") to Scene ${params.toSceneNumber} ("${params.toSceneTitle}").`,
    `Animate ONLY the realistic visual construction/restoration changes needed between these two exact frames.`,
    `Motion direction: ${params.animationPrompt}`,
    ``,
  ];

  if (controlMods.length > 0) {
    parts.push(`TRANSITION CONTROLS:`, ...controlMods.map(m => `- ${m}`), ``);
  }

  parts.push(
    `STRICT RULES:`,
    `- Maintain the SAME bunker, SAME camera angle, SAME framing, SAME composition, SAME environment.`,
    `- Do NOT redesign the bunker layout.`,
    `- Do NOT change the camera position or angle.`,
    `- Do NOT add random objects or elements not present in either frame.`,
    `- Do NOT use heavy morphing, liquid effects, or surreal distortions.`,
    `- Do NOT reset or jump the camera.`,
    `- Keep the transition physically believable — like a construction time-lapse.`,
    `- Maintain architectural continuity between start and end frames.`,
    `- The start and end frames are EXACT — do not deviate from them.`,
    ``,
    `NEGATIVE: ${NEGATIVE_CONSTRAINTS.join(', ')}.`,
    ``,
    `Photorealistic, cinematic, vertical 9:16 aspect ratio, smooth time-lapse construction motion.`,
  );

  return parts.join('\n');
}

/**
 * Guided Start-to-Target Prompt
 * Used when the provider supports only start frame. End frame is prompt guidance only.
 */
export function buildGuidedStartTargetPrompt(params: TransitionPromptParams): string {
  const controlMods = buildControlModifiers(params, false);
  
  const parts = [
    `Use the first image as the EXACT start frame — the video MUST begin from this precise image.`,
    `The end target is Scene ${params.toSceneNumber} ("${params.toSceneTitle}") — guide the transition TOWARD this visual outcome.`,
    `The end frame is a TARGET REFERENCE only — not an enforced keyframe. The final frame should closely resemble the target but exact match is not guaranteed.`,
    ``,
    `Transition from Scene ${params.fromSceneNumber} ("${params.fromSceneTitle}") to Scene ${params.toSceneNumber} ("${params.toSceneTitle}").`,
    `Animate ONLY the realistic visual construction/restoration changes needed for this transition.`,
    `Motion direction: ${params.animationPrompt}`,
  ];

  if (params.toSceneImagePrompt) {
    parts.push(
      ``,
      `TARGET END STATE DESCRIPTION: ${params.toSceneImagePrompt.substring(0, 300)}`
    );
  }

  parts.push(``);

  if (controlMods.length > 0) {
    parts.push(`TRANSITION CONTROLS:`, ...controlMods.map(m => `- ${m}`), ``);
  }

  parts.push(
    `STRICT RULES:`,
    `- Maintain the SAME bunker, SAME camera angle, SAME framing, SAME composition, SAME environment.`,
    `- Do NOT redesign the bunker layout.`,
    `- Do NOT change the camera position or angle.`,
    `- Do NOT add random objects or elements not present in either frame.`,
    `- Do NOT use heavy morphing, liquid effects, or surreal distortions.`,
    `- Do NOT reset or jump the camera.`,
    `- Keep the transition physically believable — like a construction time-lapse.`,
    `- Maintain architectural continuity between start and end frames.`,
    ``,
    `NEGATIVE: ${NEGATIVE_CONSTRAINTS.join(', ')}.`,
    ``,
    `Photorealistic, cinematic, vertical 9:16 aspect ratio, smooth time-lapse construction motion.`,
  );

  return parts.join('\n');
}

/**
 * Legacy wrapper — delegates to the correct builder based on endFrameIsExact.
 */
export function buildTransitionPrompt(
  fromSceneTitle: string,
  toSceneTitle: string,
  fromSceneNumber: number,
  toSceneNumber: number,
  animationPrompt: string,
  endFrameIsExact: boolean,
  toSceneImagePrompt?: string
): string {
  const params: TransitionPromptParams = {
    fromSceneTitle,
    toSceneTitle,
    fromSceneNumber,
    toSceneNumber,
    animationPrompt,
    toSceneImagePrompt,
  };

  if (endFrameIsExact) {
    return buildExactDualFramePrompt(params);
  }
  return buildGuidedStartTargetPrompt(params);
}

export function buildVoiceoverPrompt(
  selectedIdea: string,
  scenes: { sceneNumber: number; sceneTitle: string; narrationText: string }[]
): string {
  const sceneNarrations = scenes.map(s =>
    `Scene ${s.sceneNumber} — ${s.sceneTitle}: ${s.narrationText || '(no narration yet)'}`
  ).join('\n');

  return `Write a compelling voiceover script for a vertical short-form video (TikTok/Reels/Shorts) about restoring a ${selectedIdea}.

The video has 9 scenes:
${sceneNarrations}

Requirements:
- Dramatic, engaging narration
- Short punchy sentences
- Build tension and reveal
- Total duration: approximately 45-60 seconds
- Each scene narration should be 1-2 sentences, 5-7 seconds spoken
- End with a satisfying reveal moment`;
}

export const TRANSITION_NEGATIVE_PROMPT = NEGATIVE_CONSTRAINTS.join(', ');
