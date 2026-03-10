import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { projectId, sceneId, action } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: project } = await supabase
      .from("projects").select("*").eq("id", projectId).single();
    if (!project) throw new Error("Project not found");

    // Generate voiceover script for entire project
    if (action === "generate_script") {
      const { data: scenes } = await supabase
        .from("scenes").select("scene_number, scene_title, narration_text, image_prompt")
        .eq("project_id", projectId).order("scene_number");

      const sceneList = (scenes || []).map((s: any) =>
        `Scene ${s.scene_number} — ${s.scene_title}: ${s.narration_text || s.image_prompt?.substring(0, 100) || ''}`
      ).join('\n');

      const prompt = `Write a compelling voiceover script for a vertical short-form video (TikTok/Reels/Shorts) about restoring a ${project.selected_idea}.

The video has 9 scenes:
${sceneList}

Requirements:
- Dramatic, engaging narration with personality
- Short punchy sentences
- Build tension toward the final reveal
- Total duration: approximately 45-60 seconds
- Each scene: 1-2 sentences, 5-7 seconds spoken
- End with a satisfying reveal moment
- Also suggest music_direction for background music`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: project.voice_model?.replace('gemini-', 'google/gemini-') || "google/gemini-2.5-pro",
          messages: [{ role: "user", content: prompt }],
          tools: [{
            type: "function",
            function: {
              name: "create_voiceover",
              description: "Create voiceover script with per-scene narration",
              parameters: {
                type: "object",
                properties: {
                  voiceover_script: { type: "string", description: "Full voiceover script" },
                  music_direction: { type: "string", description: "Background music style description" },
                  scene_narrations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        scene_number: { type: "integer" },
                        narration_text: { type: "string" },
                      },
                      required: ["scene_number", "narration_text"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["voiceover_script", "music_direction", "scene_narrations"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "create_voiceover" } },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI error: ${response.status} ${errText}`);
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("No structured output");

      const result = JSON.parse(toolCall.function.arguments);

      // Update project
      await supabase.from("projects").update({
        voiceover_script: result.voiceover_script,
        music_direction: result.music_direction,
      }).eq("id", projectId);

      // Update scene narrations
      for (const sn of result.scene_narrations || []) {
        await supabase.from("scenes").update({
          narration_text: sn.narration_text,
        }).eq("project_id", projectId).eq("scene_number", sn.scene_number);
      }

      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate TTS audio for a specific scene
    if (action === "generate_tts" && sceneId) {
      const { data: scene } = await supabase
        .from("scenes").select("*").eq("id", sceneId).single();
      if (!scene || !scene.narration_text) {
        throw new Error("Scene not found or has no narration text");
      }

      // Use Lovable AI for TTS-capable model
      // Note: TTS via Gemini models may not be available through the gateway yet
      // For now, we store the narration text and mark it for external TTS processing
      console.log(`TTS requested for scene ${scene.scene_number}: "${scene.narration_text.substring(0, 50)}..."`);

      return new Response(JSON.stringify({
        success: true,
        message: "Narration text stored. TTS audio generation requires an external TTS service (e.g., ElevenLabs). The narration text is available for export.",
        narration_text: scene.narration_text,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action. Use 'generate_script' or 'generate_tts'");
  } catch (e) {
    console.error("generate-audio error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
