import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { BUNKER_IDEAS, INTERIOR_STYLES, VISUAL_MOODS, CONSTRUCTION_INTENSITIES } from '@/lib/demo-data';
import { QUALITY_PRESETS, QualityMode } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Zap, Scale, Star } from 'lucide-react';

const MODE_ICONS: Record<QualityMode, typeof Zap> = { fast: Zap, balanced: Scale, quality: Star };

export default function ProjectCreatePage() {
  const { selectedIdeaId, qualityMode, setQualityMode, setProject, setScenes, setTransitions, setStep } = useAppStore();
  const idea = BUNKER_IDEAS.find((i) => i.id === selectedIdeaId);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    projectName: idea ? `${idea.title} Restoration` : '',
    finalStyle: INTERIOR_STYLES[0],
    visualMood: VISUAL_MOODS[0],
    constructionIntensity: CONSTRUCTION_INTENSITIES[1],
    notes: '',
  });

  const handleSubmit = async () => {
    if (!idea) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-plan', {
        body: {
          projectName: form.projectName,
          selectedIdea: idea.title,
          finalStyle: form.finalStyle,
          visualMood: form.visualMood,
          constructionIntensity: form.constructionIntensity,
          notes: form.notes,
          qualityMode,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setProject(data.project);
      setScenes(data.scenes.sort((a: any, b: any) => a.scene_number - b.scene_number));
      setTransitions(data.transitions.sort((a: any, b: any) => a.transition_number - b.transition_number));
      setStep('plan');
      toast.success('Project plan generated successfully');
    } catch (err: any) {
      console.error('Plan generation error:', err);
      toast.error(err.message || 'Failed to generate plan');
    } finally {
      setLoading(false);
    }
  };

  const selectClasses = "w-full bg-slab border border-border rounded-sm px-4 py-3 text-sm text-foreground font-body focus:outline-none focus:border-spark appearance-none";
  const labelClasses = "font-display text-[10px] tracking-widest text-muted-foreground uppercase mb-2 block";

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground mb-2">
        CREATE PROJECT
      </h1>
      <p className="text-sm text-muted-foreground mb-8 font-body">
        Configure your transformation parameters. AI will generate a complete 9-scene plan.
      </p>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="p-4 bg-slab border border-border rounded-lg">
          <span className="text-[10px] font-display tracking-widest text-muted-foreground">SELECTED IDEA</span>
          <p className="text-sm font-display text-foreground mt-1">{idea?.title}</p>
        </div>

        {/* Quality Mode Selector */}
        <div>
          <label className={labelClasses}>Generation Mode</label>
          <div className="grid grid-cols-3 gap-3">
            {(Object.entries(QUALITY_PRESETS) as [QualityMode, typeof QUALITY_PRESETS.fast][]).map(([key, preset]) => {
              const Icon = MODE_ICONS[key];
              return (
                <button
                  key={key}
                  onClick={() => setQualityMode(key)}
                  className={cn(
                    "p-4 border rounded-lg text-left transition-all",
                    qualityMode === key
                      ? "border-spark bg-spark/10"
                      : "border-border bg-slab hover:border-muted-foreground/30"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={cn("w-4 h-4", qualityMode === key ? "text-spark" : "text-muted-foreground")} />
                    <span className={cn("font-display text-xs tracking-wider", qualityMode === key ? "text-spark" : "text-foreground")}>
                      {preset.label.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-body leading-relaxed">{preset.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={labelClasses}>Project Name</label>
          <input
            value={form.projectName}
            onChange={(e) => setForm({ ...form, projectName: e.target.value })}
            className="w-full bg-slab border border-border rounded-sm px-4 py-3 text-sm text-foreground font-body focus:outline-none focus:border-spark"
          />
        </div>

        <div>
          <label className={labelClasses}>Interior Style</label>
          <select value={form.finalStyle} onChange={(e) => setForm({ ...form, finalStyle: e.target.value })} className={selectClasses}>
            {INTERIOR_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className={labelClasses}>Visual Mood</label>
          <select value={form.visualMood} onChange={(e) => setForm({ ...form, visualMood: e.target.value })} className={selectClasses}>
            {VISUAL_MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className={labelClasses}>Construction Intensity</label>
          <select value={form.constructionIntensity} onChange={(e) => setForm({ ...form, constructionIntensity: e.target.value })} className={selectClasses}>
            {CONSTRUCTION_INTENSITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className={labelClasses}>Notes (Optional)</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="w-full bg-slab border border-border rounded-sm px-4 py-3 text-sm text-foreground font-body focus:outline-none focus:border-spark resize-none"
          />
        </div>

        {/* Model routing summary */}
        <div className="p-3 bg-background border border-border rounded-sm">
          <p className="text-[10px] font-display tracking-widest text-muted-foreground mb-2">MODEL ROUTING — {QUALITY_PRESETS[qualityMode].label.toUpperCase()}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-body text-muted-foreground">
            <span>Planning:</span><span className="text-foreground">{QUALITY_PRESETS[qualityMode].planning}</span>
            <span>Images:</span><span className="text-foreground">{QUALITY_PRESETS[qualityMode].image}</span>
            <span>Video:</span><span className="text-foreground">{QUALITY_PRESETS[qualityMode].video}</span>
            <span>Voice:</span><span className="text-foreground">{QUALITY_PRESETS[qualityMode].voice}</span>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !form.projectName}
          className="px-8 py-3 bg-spark text-primary-foreground font-display text-sm tracking-wider rounded-sm hover:brightness-110 transition-all disabled:opacity-50"
        >
          {loading ? '[ GENERATING PLAN :: ... ]' : '[ EXECUTE ]'}
        </button>
      </motion.div>
    </div>
  );
}
