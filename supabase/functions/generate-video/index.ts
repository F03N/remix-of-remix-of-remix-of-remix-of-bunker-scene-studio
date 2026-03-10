import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// ────────────────────────────────────────────────────────────
// PROVIDER CAPABILITY METADATA
// ────────────────────────────────────────────────────────────

interface ProviderCapability {
  supportsStartFrame: boolean;
  supportsEndFrame: boolean;
  supportsMultiKeyframe: boolean;
  effectiveMode: string;
  apiEndpoint: string;
  endFrameApiField?: string;
  providerNotes: string;
}

const PROVIDER_CAPABILITIES: Record<string, ProviderCapability> = {
  "veo-2.0-generate-001": {
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsMultiKeyframe: false,
    effectiveMode: "guided_start_frame",
    apiEndpoint: "predictLongRunning",
    providerNotes: "Legacy model. Start-frame only.",
  },
  "veo-3.0-generate-001": {
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsMultiKeyframe: false,
    effectiveMode: "guided_start_frame",
    apiEndpoint: "predictLongRunning",
    providerNotes: "Balanced quality. Start-frame only.",
  },
  "veo-3.1-fast-generate-preview": {
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsMultiKeyframe: false,
    effectiveMode: "guided_start_frame",
    apiEndpoint: "predictLongRunning",
    providerNotes: "Fastest option. Start-frame only.",
  },
  "veo-3.1-generate-preview": {
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsMultiKeyframe: false,
    effectiveMode: "guided_start_frame",
    apiEndpoint: "predictLongRunning",
    providerNotes: "Highest quality. Start-frame only.",
  },
  // FUTURE: When a provider adds true dual-frame support, add here:
  // "future-dual-frame-v1": {
  //   supportsStartFrame: true,
  //   supportsEndFrame: true,
  //   supportsMultiKeyframe: false,
  //   effectiveMode: "exact_dual_frame",
  //   apiEndpoint: "generateVideo",
  //   endFrameApiField: "lastFrame",
  //   providerNotes: "True dual-frame support.",
  // },
};

function getCapability(model: string): ProviderCapability {
  return PROVIDER_CAPABILITIES[model] || PROVIDER_CAPABILITIES["veo-3.0-generate-001"];
}

// ────────────────────────────────────────────────────────────
// UTILITIES
// ────────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; byteLength: number } | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    return { base64: arrayBufferToBase64(buffer), byteLength: buffer.byteLength };
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// PROMPT BUILDERS — STRICT BUNKER RESTORATION ENGINE
// ────────────────────────────────────────────────────────────

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
  'no object teleportation', 'no instant material change',
  'no color shift outside natural lighting', 'no dramatic camera behavior',
];

const STRICT_IDENTITY_BLOCK = [
  `ABSOLUTE IDENTITY LOCK:`,
  `- SAME bunker structure in every frame`,
  `- SAME camera angle — do NOT rotate, orbit, swing, or reposition the camera`,
  `- SAME framing and composition — do NOT change field of view or crop`,
  `- SAME environment — do NOT change sky, terrain, surroundings, lighting direction`,
  `- SAME architectural layout — do NOT add, remove, or rearrange structural elements`,
  `- Only animate the MINIMAL realistic visual changes needed for this construction phase`,
  `- All motion must be physically believable — like a real construction time-lapse`,
  `- Suppress ALL dramatic, flashy, or cinematic camera movements`,
  `- Suppress ALL morphing, warping, dissolving, or liquid effects`,
].join('\n');

interface PromptParams {
  fromScene: number;
  toScene: number;
  fromSceneTitle?: string;
  toSceneTitle?: string;
  animationPrompt: string;
  toSceneImagePrompt?: string;
  transitionControls?: Record<string, number>;
}

function getSceneStageInstructions(toScene: number): string {
  if (toScene <= 2) return 'SCENE STAGE: Exterior establishing. Almost zero motion. Camera completely static. Only subtle atmospheric changes — faint dust, natural light shift. No workers unless essential.';
  if (toScene <= 4) return 'SCENE STAGE: Exterior repair. Light dust, tiny sparks, almost static camera. Minimal visible construction changes.';
  if (toScene === 5) return 'SCENE STAGE: Underground entry. Very slow controlled descent reveal. Soft light shift. Near-static camera with barely perceptible push.';
  if (toScene <= 7) return 'SCENE STAGE: Interior construction. Tiny localized activity only. Soft interior light shifts. Camera nearly locked.';
  if (toScene === 8) return 'SCENE STAGE: Interior design finishing. Subtle furnishing placement, gentle light adjustments. Camera static.';
  return 'SCENE STAGE: Final reveal. Slightly more polished but still restrained. Gentle light sweep, final details settling. No dramatic camera sweep.';
}

function buildControlLines(controls: Record<string, number> | undefined, isExact: boolean): string[] {
  if (!controls) return [];
  const lines: string[] = [];
  const ms = controls.motionStrength ?? 20;
  const ci = controls.cameraIntensity ?? 5;
  const rp = controls.realismPriority ?? 95;
  const mSup = controls.morphSuppression ?? 98;
  const ts = controls.targetStrictness ?? (isExact ? 95 : 90);
  const cs = controls.continuityStrictness ?? 98;

  if (ms <= 10) lines.push('Near-zero motion. Scene should appear almost completely still.');
  else if (ms <= 25) lines.push('Very subtle, barely perceptible motion. Faint dust, slight shadow shift only.');
  else if (ms <= 40) lines.push('Restrained motion. Small localized construction activity only.');
  else if (ms > 70) lines.push('Moderate construction motion. Still realistic and restrained.');

  if (ci <= 5) lines.push('Camera MUST be completely locked and static. Zero camera movement.');
  else if (ci <= 15) lines.push('Camera essentially static. Barely perceptible extremely slow push-in at most.');
  else if (ci <= 30) lines.push('Camera nearly static. Very subtle slow drift only. No zoom, pan, or rotation.');
  else lines.push('Gentle camera drift only. No orbit, swing, or fast zoom.');

  if (rp > 90) lines.push('MAXIMUM photorealism. Every frame must look like real camera footage.');
  else if (rp > 70) lines.push('High photorealism priority.');

  if (mSup > 95) lines.push('AGGRESSIVELY suppress ALL morphing, warping, dissolving, or liquid effects.');
  else if (mSup > 80) lines.push('Strongly suppress morphing and dissolve effects.');

  if (isExact && ts > 80) lines.push('Final frame MUST closely match the end frame keyframe.');
  else if (!isExact && ts > 85) lines.push('Guide transition very strongly toward the target end state.');
  else if (!isExact && ts > 70) lines.push('Guide transition toward the target end state appearance.');

  if (cs > 95) lines.push('Architectural and structural continuity is ABSOLUTE. No layout drift.');
  else if (cs > 80) lines.push('Architectural continuity is critical.');

  return lines;
}

function buildExactDualFramePrompt(p: PromptParams): string {
  const controlLines = buildControlLines(p.transitionControls, true);
  const stageInstructions = getSceneStageInstructions(p.toScene);
  const parts = [
    `Create a slow, subtle, realistic construction time-lapse transition.`,
    ``,
    `Use the first image as the EXACT start frame.`,
    `Use the second image as the EXACT end frame.`,
    `Both frames are real visual conditioning keyframes.`,
    ``,
    STRICT_IDENTITY_BLOCK,
    ``,
    stageInstructions,
    ``,
    `Transition from Scene ${p.fromScene} ("${p.fromSceneTitle || ''}") to Scene ${p.toScene} ("${p.toSceneTitle || ''}").`,
    `Animate ONLY the minimal, realistic visual construction changes between these two exact frames.`,
    `Motion guidance: ${p.animationPrompt}`,
    ``,
  ];
  if (controlLines.length > 0) {
    parts.push(`STRICT MOTION CONTROLS:`, ...controlLines.map(l => `- ${l}`), ``);
  }
  parts.push(
    `PERMITTED MOTION ONLY: subtle dust, faint light flicker, tiny localized worker activity if strictly required, very slow push-in if controls allow, small debris placement.`,
    ``,
    `FORBIDDEN:`,
    ...NEGATIVE_CONSTRAINTS.map(n => `- ${n}`),
    ``,
    `Photorealistic construction time-lapse. Vertical 9:16 portrait. Every frame = real camera footage.`,
  );
  return parts.join('\n');
}

function buildGuidedStartTargetPrompt(p: PromptParams): string {
  const controlLines = buildControlLines(p.transitionControls, false);
  const stageInstructions = getSceneStageInstructions(p.toScene);
  const parts = [
    `Create a slow, subtle, realistic construction time-lapse transition.`,
    `Keep the EXACT same bunker, camera angle, framing, composition, structure, and environment.`,
    `Only animate the minimal visual changes needed to move from the start image toward the target scene.`,
    `Use only subtle dust, slight light flicker, tiny localized worker motion if necessary, and a very slow push-in only when appropriate.`,
    `Suppress dramatic motion, morphing, redesign, random objects, and exaggerated scene changes.`,
    ``,
    `Use the provided image as the EXACT start frame.`,
    ``,
    STRICT_IDENTITY_BLOCK,
    ``,
    stageInstructions,
    ``,
  ];
  if (p.toSceneImagePrompt) {
    parts.push(
      `TARGET END STATE: Scene ${p.toScene} ("${p.toSceneTitle || ''}"): ${p.toSceneImagePrompt.substring(0, 300)}`,
      `Guide transition TOWARD this visual state. Final frame should approach this appearance.`,
      ``
    );
  } else {
    parts.push(`Target: Scene ${p.toScene} ("${p.toSceneTitle || ''}"). Animate gradual realistic construction progress.`, ``);
  }
  parts.push(`Motion guidance: ${p.animationPrompt}`, ``);
  if (controlLines.length > 0) {
    parts.push(`STRICT MOTION CONTROLS:`, ...controlLines.map(l => `- ${l}`), ``);
  }
  parts.push(
    `PERMITTED MOTION ONLY: subtle dust, faint light flicker, tiny localized worker activity if strictly required, very slow push-in if controls allow, small debris placement.`,
    ``,
    `FORBIDDEN:`,
    ...NEGATIVE_CONSTRAINTS.map(n => `- ${n}`),
    ``,
    `Photorealistic construction time-lapse. Vertical 9:16 portrait. Every frame = real camera footage.`,
  );
  return parts.join('\n');
}

// ────────────────────────────────────────────────────────────
// REQUEST BUILDERS
// ────────────────────────────────────────────────────────────

function buildExactDualFrameVideoRequest(
  prompt: string,
  startImageBase64: string,
  endImageBase64: string,
  capability: ProviderCapability
): Record<string, any> {
  const body: Record<string, any> = {
    instances: [{
      prompt,
      image: { bytesBase64Encoded: startImageBase64, mimeType: "image/png" },
    }],
    parameters: {
      aspectRatio: "9:16",
      sampleCount: 1,
      durationSeconds: 8,
      personGeneration: "allow_adult",
    },
  };

  if (capability.endFrameApiField) {
    body.instances[0][capability.endFrameApiField] = { bytesBase64Encoded: endImageBase64, mimeType: "image/png" };
  } else {
    body.instances[0].lastFrame = { bytesBase64Encoded: endImageBase64, mimeType: "image/png" };
  }

  return body;
}

function buildGuidedStartTargetVideoRequest(
  prompt: string,
  startImageBase64: string | null
): Record<string, any> {
  const body: Record<string, any> = {
    instances: [{ prompt }],
    parameters: {
      aspectRatio: "9:16",
      sampleCount: 1,
      durationSeconds: 8,
      personGeneration: "allow_adult",
    },
  };

  if (startImageBase64) {
    body.instances[0].image = { bytesBase64Encoded: startImageBase64, mimeType: "image/png" };
  }

  return body;
}

// ────────────────────────────────────────────────────────────
// MAIN HANDLER
// ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transitionId, projectId, transitionControls } = await req.json();

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_CLOUD_API_KEY");
    if (!GOOGLE_API_KEY) throw new Error("GOOGLE_CLOUD_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get transition
    const { data: transition, error: tErr } = await supabase
      .from("transitions").select("*").eq("id", transitionId).single();
    if (tErr || !transition) throw new Error("Transition not found");

    // Get project for model info
    const { data: project } = await supabase
      .from("projects").select("video_model, quality_mode, continuity_profile").eq("id", projectId).single();

    const videoModel = transition.video_model || project?.video_model || "veo-3.0-generate-001";
    const capability = getCapability(videoModel);

    await supabase.from("transitions").update({ status: "generating" }).eq("id", transitionId);

    // Get scene data
    const { data: fromScene } = await supabase
      .from("scenes")
      .select("output_image_url, scene_title, image_prompt")
      .eq("project_id", projectId)
      .eq("scene_number", transition.from_scene)
      .single();

    const { data: toScene } = await supabase
      .from("scenes")
      .select("output_image_url, scene_title, image_prompt")
      .eq("project_id", projectId)
      .eq("scene_number", transition.to_scene)
      .single();

    if (!fromScene?.output_image_url) {
      await supabase.from("transitions").update({ status: "failed" }).eq("id", transitionId);
      throw new Error(`Scene ${transition.from_scene} has no generated image. Generate all scene images first.`);
    }

    // Determine transition mode
    const useExactDualFrame = capability.supportsStartFrame && capability.supportsEndFrame && !!toScene?.output_image_url;
    const actualMode = useExactDualFrame ? "exact_dual_frame" : capability.effectiveMode;

    // Log generation metadata
    const genLog = {
      transitionId,
      transitionNumber: transition.transition_number,
      fromScene: transition.from_scene,
      toScene: transition.to_scene,
      videoModel,
      actualMode,
      startImageAttached: !!fromScene.output_image_url,
      endImageAvailable: !!toScene?.output_image_url,
      endImageEnforced: useExactDualFrame,
      providerSupportsEndFrame: capability.supportsEndFrame,
      providerSupportsMultiKeyframe: capability.supportsMultiKeyframe,
      providerMode: capability.effectiveMode,
      requestBuilder: useExactDualFrame ? "buildExactDualFrameVideoRequest" : "buildGuidedStartTargetVideoRequest",
      promptBuilder: useExactDualFrame ? "buildExactDualFramePrompt" : "buildGuidedStartTargetPrompt",
      providerNotes: capability.providerNotes,
      fallbackReason: !useExactDualFrame && toScene?.output_image_url
        ? `Provider ${videoModel} does not support true end-frame conditioning. Using guided mode.`
        : undefined,
    };
    console.log("Transition generation metadata:", JSON.stringify(genLog));

    // Build prompt
    const promptParams: PromptParams = {
      fromScene: transition.from_scene,
      toScene: transition.to_scene,
      fromSceneTitle: fromScene.scene_title,
      toSceneTitle: toScene?.scene_title,
      animationPrompt: transition.animation_prompt,
      toSceneImagePrompt: toScene?.image_prompt,
      transitionControls,
    };

    const prompt = useExactDualFrame
      ? buildExactDualFramePrompt(promptParams)
      : buildGuidedStartTargetPrompt(promptParams);

    // Fetch start image
    const startImage = await fetchImageAsBase64(fromScene.output_image_url);
    if (startImage) {
      console.log(`Start image attached, size: ${startImage.byteLength} bytes`);
    } else {
      console.warn("Could not fetch start image, falling back to text-only prompt");
    }

    // Fetch end image (for exact mode or logging)
    let endImage: { base64: string; byteLength: number } | null = null;
    if (toScene?.output_image_url) {
      endImage = await fetchImageAsBase64(toScene.output_image_url);
      if (endImage) {
        console.log(`End image fetched, size: ${endImage.byteLength} bytes`);
      }
    }

    // Build request body
    let requestBody: Record<string, any>;

    if (useExactDualFrame && startImage && endImage) {
      console.log(`Using EXACT DUAL-FRAME request builder. Both images attached as real keyframes.`);
      requestBody = buildExactDualFrameVideoRequest(prompt, startImage.base64, endImage.base64, capability);
    } else {
      if (toScene?.output_image_url && !capability.supportsEndFrame) {
        console.log(`End image available but NOT attached as keyframe (provider limitation: ${capability.effectiveMode}). Referenced in prompt only.`);
      }
      requestBody = buildGuidedStartTargetVideoRequest(prompt, startImage?.base64 || null);
    }

    console.log(`Submitting video generation to ${videoModel} (mode: ${actualMode})...`);

    const generateResponse = await fetch(
      `${BASE_URL}/models/${videoModel}:${capability.apiEndpoint}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GOOGLE_API_KEY,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!generateResponse.ok) {
      const errText = await generateResponse.text();
      console.error("Veo API error:", generateResponse.status, errText);
      await supabase.from("transitions").update({ status: "failed" }).eq("id", transitionId);

      if (generateResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (generateResponse.status === 403) {
        return new Response(JSON.stringify({ error: "API access denied. Ensure the Generative AI API is enabled in your Google Cloud project." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Veo API failed: ${generateResponse.status} - ${errText}`);
    }

    const operationData = await generateResponse.json();
    const operationName = operationData.name;

    if (!operationName) {
      console.log("No operation name, response:", JSON.stringify(operationData).substring(0, 500));
      await supabase.from("transitions").update({ status: "failed" }).eq("id", transitionId);
      throw new Error("Unexpected response format from video API");
    }

    console.log("Operation started:", operationName);

    // Poll for completion (max ~4 minutes)
    let result = null;
    const maxAttempts = 48;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const pollResponse = await fetch(`${BASE_URL}/${operationName}`, {
        method: "GET",
        headers: { "x-goog-api-key": GOOGLE_API_KEY },
      });

      if (!pollResponse.ok) { console.warn(`Poll ${i + 1} failed: ${pollResponse.status}`); continue; }

      const pollData = await pollResponse.json();
      console.log(`Poll ${i + 1}: done=${pollData.done === true}`);

      if (pollData.done) {
        if (pollData.error) {
          console.error("Operation failed:", JSON.stringify(pollData.error));
          await supabase.from("transitions").update({ status: "failed" }).eq("id", transitionId);
          throw new Error(`Video generation failed: ${pollData.error.message || JSON.stringify(pollData.error)}`);
        }
        result = pollData.response || pollData.result || pollData;
        break;
      }
    }

    if (!result) {
      await supabase.from("transitions").update({ status: "failed" }).eq("id", transitionId);
      throw new Error("Video generation timed out after 4 minutes");
    }

    console.log("Generation complete, extracting video...");

    // Extract video data
    const videoResponse = result.generateVideoResponse || result;
    const generatedVideos = videoResponse.generatedSamples || result.generatedSamples || result.videos || result.predictions || [];
    let videoBytes: Uint8Array | null = null;

    if (generatedVideos.length > 0) {
      const video = generatedVideos[0];
      if (video.video?.bytesBase64Encoded) {
        videoBytes = Uint8Array.from(atob(video.video.bytesBase64Encoded), (c) => c.charCodeAt(0));
      } else if (video.video?.uri) {
        let downloadUrl = video.video.uri;
        if (!downloadUrl.includes("key=")) downloadUrl += `${downloadUrl.includes("?") ? "&" : "?"}key=${GOOGLE_API_KEY}`;
        const dlResp = await fetch(downloadUrl, { headers: { "x-goog-api-key": GOOGLE_API_KEY } });
        if (dlResp.ok) videoBytes = new Uint8Array(await dlResp.arrayBuffer());
      } else if (video.bytesBase64Encoded) {
        videoBytes = Uint8Array.from(atob(video.bytesBase64Encoded), (c) => c.charCodeAt(0));
      } else if (video.uri) {
        let downloadUrl = video.uri;
        if (!downloadUrl.includes("key=")) downloadUrl += `${downloadUrl.includes("?") ? "&" : "?"}key=${GOOGLE_API_KEY}`;
        const dlResp = await fetch(downloadUrl, { headers: { "x-goog-api-key": GOOGLE_API_KEY } });
        if (dlResp.ok) videoBytes = new Uint8Array(await dlResp.arrayBuffer());
      }
    }

    if (!videoBytes) {
      console.error("Could not extract video. Result:", JSON.stringify(result).substring(0, 1000));
      await supabase.from("transitions").update({ status: "failed" }).eq("id", transitionId);
      throw new Error("No video data in generation result");
    }

    // Upload as MP4
    const filePath = `${projectId}/transitions/transition_${transition.transition_number}.mp4`;
    const { error: uploadErr } = await supabase.storage
      .from("project-assets")
      .upload(filePath, videoBytes, { contentType: "video/mp4", upsert: true });

    if (uploadErr) {
      await supabase.from("transitions").update({ status: "failed" }).eq("id", transitionId);
      throw uploadErr;
    }

    const { data: publicUrl } = supabase.storage.from("project-assets").getPublicUrl(filePath);

    const { data: updated, error: updateErr } = await supabase
      .from("transitions")
      .update({
        output_video_url: publicUrl.publicUrl,
        start_image_url: fromScene.output_image_url,
        end_image_url: toScene?.output_image_url || null,
        status: "completed",
        provider_mode: actualMode,
        video_model: videoModel,
      })
      .eq("id", transitionId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    console.log(`Transition ${transition.transition_number} completed. Model: ${videoModel}, Mode: ${actualMode}, EndFrameExact: ${useExactDualFrame}`);

    return new Response(JSON.stringify({
      transition: updated,
      providerCapability: {
        model: videoModel,
        effectiveMode: actualMode,
        supportsStartFrame: capability.supportsStartFrame,
        supportsEndFrame: capability.supportsEndFrame,
        supportsMultiKeyframe: capability.supportsMultiKeyframe,
        endFrameExact: useExactDualFrame,
        requestBuilder: useExactDualFrame ? "exact_dual_frame" : "guided_start_target",
        promptBuilder: useExactDualFrame ? "exact_dual_frame" : "guided_start_target",
        providerNotes: capability.providerNotes,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-video error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
