import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SCENE_SEQUENCE = [
  { number: 1, title: "Before", purpose: "Establish the bunker in its original abandoned/ruined state" },
  { number: 2, title: "Arrival", purpose: "Show the first human approach to the bunker" },
  { number: 3, title: "Exterior Work Start", purpose: "Begin visible exterior restoration work" },
  { number: 4, title: "Exterior Near Completion", purpose: "Show exterior nearly finished" },
  { number: 5, title: "Entering Underground", purpose: "First descent into interior spaces" },
  { number: 6, title: "Interior Work In Progress", purpose: "Active interior construction phase" },
  { number: 7, title: "Interior Finalization", purpose: "Structural interior work finishing up" },
  { number: 8, title: "Interior Design Transformation", purpose: "Install design elements and furnishings" },
  { number: 9, title: "Final Reveal", purpose: "The dramatic completed reveal" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { projectName, selectedIdea, finalStyle, visualMood, constructionIntensity, notes, qualityMode = 'balanced' } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Model routing based on quality mode
    const MODEL_MAP: Record<string, string> = {
      fast: "google/gemini-2.5-flash",
      balanced: "google/gemini-2.5-pro",
      quality: "google/gemini-2.5-pro",
    };
    const IMAGE_MODEL_MAP: Record<string, string> = {
      fast: "google/gemini-2.5-flash-image",
      balanced: "google/gemini-2.5-flash-image",
      quality: "google/gemini-3.1-flash-image-preview",
    };
    const VIDEO_MODEL_MAP: Record<string, string> = {
      fast: "veo-3.1-fast-generate-preview",
      balanced: "veo-3.0-generate-001",
      quality: "veo-3.1-generate-preview",
    };
    const VOICE_MODEL_MAP: Record<string, string> = {
      fast: "gemini-2.5-flash-preview-tts",
      balanced: "gemini-2.5-pro-preview-tts",
      quality: "gemini-2.5-pro-preview-tts",
    };

    const planningModel = MODEL_MAP[qualityMode] || MODEL_MAP.balanced;
    const imageModel = IMAGE_MODEL_MAP[qualityMode] || IMAGE_MODEL_MAP.balanced;
    const videoModel = VIDEO_MODEL_MAP[qualityMode] || VIDEO_MODEL_MAP.balanced;
    const voiceModel = VOICE_MODEL_MAP[qualityMode] || VOICE_MODEL_MAP.balanced;

    console.log(`Planning with model: ${planningModel}, quality: ${qualityMode}`);

    // Build full continuity profile
    const continuityProfile = {
      bunkerIdentity: `A ${selectedIdea} bunker. Same exact bunker in every scene — never change identity, architecture, or location.`,
      environmentSummary: `Same geography, terrain, weather. Lighting may shift for time-of-day only.`,
      cameraFramingRules: `Same camera angle, focal length, perspective, composition. No jumps or resets.`,
      architecturalAnchors: `Key features stay in same position. Changes are additive only — never contradict previous scenes.`,
      lightingStyleRules: `"${visualMood}" mood. Exterior: natural light. Interior: work lights → ambient lighting progression.`,
      materialPalette: `Materials consistent with "${selectedIdea}". Demolition → repair → finishing → design elements.`,
      finalDesignTarget: `Final style: "${finalStyle}", mood: "${visualMood}", intensity: "${constructionIntensity}". ${notes || ''}`,
      visualConstraints: `Vertical 9:16. Photorealistic, cinematic. Consistent color grading across all scenes.`,
      negativeConstraints: `NEVER: change layout, swap location, reset camera, add random objects, fantasy, instant transformation, morphing, geometry changes.`,
    };

    const continuityBlock = Object.entries(continuityProfile)
      .map(([k, v]) => `- ${k.replace(/([A-Z])/g, ' $1').toUpperCase()}: ${v}`)
      .join('\n');

    const sceneListDescription = SCENE_SEQUENCE.map(s =>
      `Scene ${s.number} - ${s.title}: ${s.purpose}`
    ).join('\n');

    const prompt = `You are a cinematic bunker transformation planner for vertical short-form video content (TikTok, Reels, YouTube Shorts).

Create a detailed 9-scene transformation plan for:
- Bunker Idea: ${selectedIdea}
- Interior Style: ${finalStyle}
- Visual Mood: ${visualMood}
- Construction Intensity: ${constructionIntensity}
- Project Name: ${projectName}
${notes ? `- Notes: ${notes}` : ''}

CONTINUITY RULES (MANDATORY):
${continuityBlock}

The 9 scenes MUST follow this EXACT sequence:
${sceneListDescription}

CRITICAL:
- ALL prompts target VERTICAL 9:16 portrait for Shorts/Reels/TikTok
- Each scene shows realistic, gradual, incremental progress from the previous
- Same bunker, environment, camera angle throughout
- Construction changes are additive only
- No scene contradicts a previous scene
- NEGATIVE: no random objects, no layout drift, no camera reset, no fantasy, no morphing, no instant transformation

For each scene provide detailed structured output including narration text and continuity notes.
Also provide a voiceover_script and music_direction for the overall video.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: planningModel,
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "create_project_plan",
            description: "Create a structured 9-scene vertical transformation plan with narration and continuity notes",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "2-3 sentence project summary mentioning vertical 9:16 format" },
                voiceover_script: { type: "string", description: "Full voiceover narration script for the entire video, 45-60 seconds" },
                music_direction: { type: "string", description: "Background music style and progression description" },
                scenes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      scene_number: { type: "integer" },
                      scene_title: { type: "string" },
                      scene_purpose: { type: "string", description: "Why this scene exists in the narrative" },
                      image_prompt: { type: "string", description: "Detailed text-to-image prompt, photorealistic cinematic VERTICAL 9:16 portrait" },
                      animation_prompt: { type: "string", description: "Camera movement + realistic construction motion for 5-sec transition video" },
                      sound_prompt: { type: "string", description: "Environmental and ambient audio description" },
                      narration_text: { type: "string", description: "1-2 sentence voiceover narration for this scene" },
                      continuity_notes: { type: "string", description: "What changed from previous scene, what must stay the same" },
                      expected_visual_difference: { type: "string", description: "Brief description of visible progress from previous scene" },
                      sound_fx_notes: { type: "string", description: "Specific sound effects for this scene" },
                      ambience_notes: { type: "string", description: "Ambient atmosphere and background sounds" },
                    },
                    required: ["scene_number", "scene_title", "image_prompt", "animation_prompt", "sound_prompt", "narration_text"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["summary", "scenes", "voiceover_script", "music_direction"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_project_plan" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured output from AI");

    const plan = JSON.parse(toolCall.function.arguments);

    // Enforce scene titles match our sequence
    const scenes = plan.scenes.map((s: any, i: number) => ({
      ...s,
      scene_number: i + 1,
      scene_title: SCENE_SEQUENCE[i]?.title || s.scene_title,
    }));

    // Create project
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .insert({
        project_name: projectName,
        selected_idea: selectedIdea,
        final_style: finalStyle,
        visual_mood: visualMood,
        construction_intensity: constructionIntensity,
        notes: notes || "",
        project_summary: plan.summary,
        quality_mode: qualityMode,
        continuity_profile: continuityProfile,
        voiceover_script: plan.voiceover_script || "",
        music_direction: plan.music_direction || "",
        planning_model: planningModel,
        image_model: imageModel,
        video_model: videoModel,
        voice_model: voiceModel,
      })
      .select()
      .single();

    if (projErr) throw projErr;

    // Insert scenes with narration data
    const scenesData = scenes.map((s: any) => ({
      project_id: project.id,
      scene_number: s.scene_number,
      scene_title: s.scene_title,
      image_prompt: s.image_prompt,
      animation_prompt: s.animation_prompt,
      sound_prompt: s.sound_prompt,
      narration_text: s.narration_text || "",
      sound_fx_notes: s.sound_fx_notes || "",
      ambience_notes: s.ambience_notes || "",
      status: "pending",
    }));

    const { data: dbScenes, error: scenesErr } = await supabase
      .from("scenes")
      .insert(scenesData)
      .select();

    if (scenesErr) throw scenesErr;

    // Insert transitions
    const transitionsData = Array.from({ length: 8 }, (_, i) => ({
      project_id: project.id,
      transition_number: i + 1,
      from_scene: i + 1,
      to_scene: i + 2,
      animation_prompt: scenes[i]?.animation_prompt || "",
      status: "pending",
      provider_mode: "guided_start_frame",
      video_model: videoModel,
    }));

    const { data: dbTransitions, error: transErr } = await supabase
      .from("transitions")
      .insert(transitionsData)
      .select();

    if (transErr) throw transErr;

    console.log(`Plan generated: ${project.id}, ${dbScenes.length} scenes, ${dbTransitions.length} transitions, mode: ${qualityMode}`);

    return new Response(JSON.stringify({ project, scenes: dbScenes, transitions: dbTransitions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
