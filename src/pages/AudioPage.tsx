import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Mic, FileText, Music, RefreshCw } from 'lucide-react';

export default function AudioPage() {
  const { project, scenes, setStep, setScenes } = useAppStore();
  const [generatingScript, setGeneratingScript] = useState(false);

  if (!project) return null;

  const handleGenerateScript = async () => {
    setGeneratingScript(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-audio', {
        body: { projectId: project.id, action: 'generate_script' },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Update scenes with narration text
      if (data.scene_narrations) {
        const updatedScenes = scenes.map(s => {
          const narration = data.scene_narrations.find((n: any) => n.scene_number === s.scene_number);
          return narration ? { ...s, narration_text: narration.narration_text } : s;
        });
        setScenes(updatedScenes);
      }

      toast.success('Voiceover script generated');
    } catch (err: any) {
      console.error('Script generation error:', err);
      toast.error(err.message || 'Failed to generate script');
    } finally {
      setGeneratingScript(false);
    }
  };

  const hasNarrations = scenes.some(s => s.narration_text);

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground mb-2">
        AUDIO / VOICEOVER
      </h1>
      <p className="text-sm text-muted-foreground mb-8 font-body">
        Generate voiceover narration and sound design for your transformation video.
      </p>

      {/* Generate Script Button */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
        <button
          onClick={handleGenerateScript}
          disabled={generatingScript}
          className="px-6 py-3 bg-spark text-primary-foreground font-display text-sm tracking-wider rounded-sm hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {generatingScript ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              [ GENERATING SCRIPT :: ... ]
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              {hasNarrations ? '[ REGENERATE VOICEOVER SCRIPT ]' : '[ GENERATE VOICEOVER SCRIPT ]'}
            </>
          )}
        </button>
      </motion.div>

      {/* Overall Script */}
      {project.voiceover_script && (
        <div className="mb-8 p-5 bg-slab border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Mic className="w-4 h-4 text-spark" />
            <span className="text-[10px] font-display tracking-widest text-muted-foreground">FULL VOICEOVER SCRIPT</span>
          </div>
          <p className="text-sm text-foreground font-body leading-relaxed whitespace-pre-wrap">{project.voiceover_script}</p>
        </div>
      )}

      {/* Music Direction */}
      {project.music_direction && (
        <div className="mb-8 p-5 bg-slab border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Music className="w-4 h-4 text-spark" />
            <span className="text-[10px] font-display tracking-widest text-muted-foreground">MUSIC DIRECTION</span>
          </div>
          <p className="text-sm text-muted-foreground font-body leading-relaxed">{project.music_direction}</p>
        </div>
      )}

      {/* Per-Scene Narrations */}
      <div className="space-y-3">
        <p className="text-[10px] font-display tracking-widest text-muted-foreground mb-2">SCENE NARRATIONS</p>
        {scenes.map((scene, i) => (
          <motion.div
            key={scene.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="p-4 bg-slab border border-border rounded-lg"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="font-display text-xs tracking-wider text-spark">SCENE {scene.scene_number}</span>
              <span className="font-display text-sm font-semibold text-foreground">— {scene.scene_title}</span>
            </div>

            <div className="space-y-2">
              {scene.narration_text ? (
                <div className="bg-background border border-border rounded-sm p-3">
                  <span className="text-[10px] font-display tracking-widest text-muted-foreground">NARRATION</span>
                  <p className="text-xs text-foreground font-body mt-1 leading-relaxed">{scene.narration_text}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground font-body italic">No narration text yet. Generate a voiceover script above.</p>
              )}

              {scene.sound_fx_notes && (
                <div className="bg-background border border-border rounded-sm p-3">
                  <span className="text-[10px] font-display tracking-widest text-muted-foreground">SOUND FX</span>
                  <p className="text-xs text-muted-foreground font-body mt-1">{scene.sound_fx_notes}</p>
                </div>
              )}

              {scene.ambience_notes && (
                <div className="bg-background border border-border rounded-sm p-3">
                  <span className="text-[10px] font-display tracking-widest text-muted-foreground">AMBIENCE</span>
                  <p className="text-xs text-muted-foreground font-body mt-1">{scene.ambience_notes}</p>
                </div>
              )}

              <div className="bg-background border border-border rounded-sm p-3">
                <span className="text-[10px] font-display tracking-widest text-muted-foreground">SOUND PROMPT</span>
                <p className="text-xs text-muted-foreground font-body mt-1">{scene.sound_prompt}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* TTS Info */}
      <div className="mt-8 p-4 border border-border rounded-lg bg-slab">
        <p className="text-[10px] font-display tracking-widest text-muted-foreground mb-2">TTS / AUDIO GENERATION</p>
        <p className="text-xs text-muted-foreground font-body leading-relaxed">
          The narration text above is ready for export. For TTS audio generation, connect an external service (e.g., ElevenLabs) or use the exported narration text with your preferred voice synthesis tool.
        </p>
      </div>

      <div className="mt-8">
        <button onClick={() => setStep('export')} className="px-8 py-3 bg-spark text-primary-foreground font-display text-sm tracking-wider rounded-sm hover:brightness-110 transition-all">
          [ PROCEED TO EXPORT ]
        </button>
      </div>
    </div>
  );
}
