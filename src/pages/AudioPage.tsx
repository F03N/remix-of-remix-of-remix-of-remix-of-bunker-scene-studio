import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Mic, FileText, Music, RefreshCw, Clock, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const SCENE_TIMING: Record<number, { duration: string; pacing: string }> = {
  1: { duration: '5-6s', pacing: 'Slow, atmospheric. Let the abandoned state sink in.' },
  2: { duration: '4-5s', pacing: 'Measured approach. Build anticipation.' },
  3: { duration: '5-6s', pacing: 'Steady work rhythm. Start the energy.' },
  4: { duration: '5-6s', pacing: 'Increasing confidence. Progress is visible.' },
  5: { duration: '6-7s', pacing: 'Dramatic descent. Slow reveal into darkness.' },
  6: { duration: '5-6s', pacing: 'Active construction energy. Purposeful motion.' },
  7: { duration: '5-6s', pacing: 'Focused finishing. Precision work.' },
  8: { duration: '6-7s', pacing: 'Design transformation. Wow factor building.' },
  9: { duration: '6-8s', pacing: 'Grand reveal. Maximum impact. Let it breathe.' },
};

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
  const totalDuration = scenes.reduce((acc, s) => {
    const timing = SCENE_TIMING[s.scene_number];
    const max = parseInt(timing?.duration.split('-')[1] || '6');
    return acc + max;
  }, 0);

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground mb-2">
        AUDIO / VOICEOVER
      </h1>
      <p className="text-sm text-muted-foreground mb-8 font-body">
        Generate voiceover narration and sound design for your bunker restoration video.
      </p>

      {/* Timing Overview */}
      <div className="mb-6 p-4 bg-slab border border-border rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-spark" />
          <span className="text-[10px] font-display tracking-widest text-muted-foreground">TIMING GUIDANCE</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-xs font-body text-muted-foreground">
          <div>
            <span className="text-foreground font-display text-sm">{totalDuration}s</span>
            <p className="text-[10px]">Est. total duration</p>
          </div>
          <div>
            <span className="text-foreground font-display text-sm">9 scenes</span>
            <p className="text-[10px]">5-8s each segment</p>
          </div>
          <div>
            <span className="text-foreground font-display text-sm">1-2 lines</span>
            <p className="text-[10px]">Narration per scene</p>
          </div>
        </div>
      </div>

      {/* Voiceover Pacing Guide */}
      <div className="mb-6 p-4 bg-slab border border-border rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <Volume2 className="w-4 h-4 text-spark" />
          <span className="text-[10px] font-display tracking-widest text-muted-foreground">VOICEOVER PACING GUIDE</span>
        </div>
        <div className="space-y-1 text-xs font-body text-muted-foreground">
          <p>• <span className="text-foreground">Scenes 1-2:</span> Slow, deliberate. Build atmosphere. Low energy narration.</p>
          <p>• <span className="text-foreground">Scenes 3-4:</span> Increasing energy. Construction rhythm in voice.</p>
          <p>• <span className="text-foreground">Scene 5:</span> Dramatic pause before descent. Lower register.</p>
          <p>• <span className="text-foreground">Scenes 6-7:</span> Steady work energy. Confident tone.</p>
          <p>• <span className="text-foreground">Scenes 8-9:</span> Rising excitement. The reveal. Maximum impact at the end.</p>
        </div>
      </div>

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

      {/* Per-Scene Narrations with Timing */}
      <div className="space-y-3">
        <p className="text-[10px] font-display tracking-widest text-muted-foreground mb-2">SCENE NARRATIONS & TIMING</p>
        {scenes.map((scene, i) => {
          const timing = SCENE_TIMING[scene.scene_number];
          return (
            <motion.div
              key={scene.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="p-4 bg-slab border border-border rounded-lg"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-display text-xs tracking-wider text-spark">SCENE {scene.scene_number}</span>
                  <span className="font-display text-sm font-semibold text-foreground">— {scene.scene_title}</span>
                </div>
                {timing && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-display tracking-wider text-muted-foreground">{timing.duration}</span>
                  </div>
                )}
              </div>

              {timing && (
                <p className="text-[9px] text-muted-foreground/70 font-body mb-2 italic">Pacing: {timing.pacing}</p>
              )}

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
          );
        })}
      </div>

      {/* TTS Info */}
      <div className="mt-8 p-4 border border-border rounded-lg bg-slab">
        <p className="text-[10px] font-display tracking-widest text-muted-foreground mb-2">TTS / AUDIO GENERATION</p>
        <p className="text-xs text-muted-foreground font-body leading-relaxed mb-3">
          The narration text above is ready for export. Use the exported narration prompts with your preferred TTS service (ElevenLabs, Google TTS, etc.).
        </p>
        <div className="space-y-1 text-[10px] text-muted-foreground/70 font-body">
          <p>• <span className="text-foreground">Narration prompts:</span> Exported as narration_prompts.txt in Export Center</p>
          <p>• <span className="text-foreground">Sound prompts:</span> Exported as sound_prompts.txt for sound design reference</p>
          <p>• <span className="text-foreground">Timing data:</span> Included in project manifest.json</p>
          <p>• <span className="text-foreground">TTS placeholder:</span> Ready for future integration with ElevenLabs or similar</p>
        </div>
      </div>

      <div className="mt-8">
        <button onClick={() => setStep('export')} className="px-8 py-3 bg-spark text-primary-foreground font-display text-sm tracking-wider rounded-sm hover:brightness-110 transition-all">
          [ PROCEED TO EXPORT ]
        </button>
      </div>
    </div>
  );
}
