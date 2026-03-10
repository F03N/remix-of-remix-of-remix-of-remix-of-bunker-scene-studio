import { useAppStore } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, FileImage, Film, FileText, Database, Music } from 'lucide-react';
import { toast } from 'sonner';
import { buildManifest, getExportAssetList } from '@/lib/services/export-service';
import { getProviderCapability, getModeLabel, getHonestyLabel } from '@/lib/services/provider-capabilities';
import { QUALITY_PRESETS } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function ExportPage() {
  const { project, scenes, transitions, qualityMode } = useAppStore();
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);

  const preset = QUALITY_PRESETS[qualityMode];
  const capability = getProviderCapability(preset.video);
  const honesty = getHonestyLabel(capability.effectiveMode);

  const completedScenes = scenes.filter((s) => s.status === 'completed').length;
  const completedTransitions = transitions.filter((t) => t.status === 'completed').length;
  const hasNarrations = scenes.some(s => s.narration_text);

  const assetList = project ? getExportAssetList(scenes, transitions) : [];

  const handleExport = async () => {
    if (!project) return;
    setExporting(true);
    try {
      const manifest = buildManifest(project, scenes, transitions);
      const manifestJson = JSON.stringify(manifest, null, 2);

      const imagePrompts = scenes.map((s) => `Scene ${s.scene_number} - ${s.scene_title}\n${s.image_prompt}\n`).join('\n');
      const animPrompts = scenes.map((s) => `Scene ${s.scene_number} - ${s.scene_title}\n${s.animation_prompt}\n`).join('\n');
      const soundPrompts = scenes.map((s) => `Scene ${s.scene_number} - ${s.scene_title}\n${s.sound_prompt}\n`).join('\n');
      const narrationPrompts = scenes.map((s) => `Scene ${s.scene_number} - ${s.scene_title}\n${s.narration_text || '(no narration)'}\n`).join('\n');
      const summary = `Project: ${project.project_name}\nIdea: ${project.selected_idea}\nStyle: ${project.final_style}\nMood: ${project.visual_mood}\nIntensity: ${project.construction_intensity}\nMode: ${preset.label}\nFormat: Vertical 9:16 (Shorts/Reels/TikTok)\nVideo Provider: ${capability.model} (${getModeLabel(capability.effectiveMode)})\n\n${project.project_summary}\n\nVoiceover Script:\n${project.voiceover_script || '(not generated)'}\n\nMusic Direction:\n${project.music_direction || '(not specified)'}`;

      const encoder = new TextEncoder();

      await Promise.all([
        supabase.storage.from('project-assets').upload(
          `${project.id}/prompts/image_prompts.txt`, encoder.encode(imagePrompts),
          { contentType: 'text/plain', upsert: true }
        ),
        supabase.storage.from('project-assets').upload(
          `${project.id}/prompts/animation_prompts.txt`, encoder.encode(animPrompts),
          { contentType: 'text/plain', upsert: true }
        ),
        supabase.storage.from('project-assets').upload(
          `${project.id}/prompts/sound_prompts.txt`, encoder.encode(soundPrompts),
          { contentType: 'text/plain', upsert: true }
        ),
        supabase.storage.from('project-assets').upload(
          `${project.id}/prompts/narration_prompts.txt`, encoder.encode(narrationPrompts),
          { contentType: 'text/plain', upsert: true }
        ),
        supabase.storage.from('project-assets').upload(
          `${project.id}/prompts/project_summary.txt`, encoder.encode(summary),
          { contentType: 'text/plain', upsert: true }
        ),
        supabase.storage.from('project-assets').upload(
          `${project.id}/metadata/manifest.json`, encoder.encode(manifestJson),
          { contentType: 'application/json', upsert: true }
        ),
      ]);

      await supabase.from('exports').insert({
        project_id: project.id,
        exported_images: completedScenes,
        exported_videos: completedTransitions,
        exported_prompts: 5,
      });

      setDone(true);
      toast.success('Export complete — all assets packaged');
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownload = (category: 'all' | 'scenes' | 'transitions' | 'prompts') => {
    if (!project) return;

    if (category === 'all' || category === 'scenes') {
      scenes.forEach((s) => {
        if (s.output_image_url) downloadFile(s.output_image_url, `scene_${s.scene_number}.png`);
      });
    }

    if (category === 'all' || category === 'transitions') {
      transitions.forEach((t) => {
        if (t.output_video_url) downloadFile(t.output_video_url, `transition_${t.transition_number}.mp4`);
      });
    }

    if (category === 'all' || category === 'prompts') {
      const files = [
        'prompts/image_prompts.txt', 'prompts/animation_prompts.txt',
        'prompts/sound_prompts.txt', 'prompts/narration_prompts.txt',
        'prompts/project_summary.txt', 'metadata/manifest.json',
      ];
      files.forEach((p) => {
        const { data } = supabase.storage.from('project-assets').getPublicUrl(`${project.id}/${p}`);
        downloadFile(data.publicUrl, p.split('/').pop()!);
      });
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground mb-2">EXPORT CENTER</h1>
      <p className="text-sm text-muted-foreground mb-2 font-body">Download all generated assets for final editing or direct delivery.</p>
      <div className="flex items-center gap-4 mb-8">
        <span className="text-[10px] font-display tracking-wider text-spark">
          FORMAT: VERTICAL 9:16
        </span>
        <span className={cn("text-[10px] font-display tracking-wider px-2 py-0.5 border rounded-sm", honesty.color, "border-current/30")}>
          VIDEO: {getModeLabel(capability.effectiveMode).toUpperCase()} ({honesty.badge})
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        <StatCard label="SCENE IMAGES" value={`${completedScenes}/9`} detail="PNG" icon={<FileImage className="w-4 h-4" />} />
        <StatCard label="TRANSITIONS" value={`${completedTransitions}/8`} detail="MP4" icon={<Film className="w-4 h-4" />} />
        <StatCard label="PROMPTS" value="6" detail="TXT / JSON" icon={<FileText className="w-4 h-4" />} />
        <StatCard label="NARRATIONS" value={hasNarrations ? '✓' : '—'} detail="TEXT" icon={<Music className="w-4 h-4" />} />
      </div>

      {/* Asset list */}
      <div className="bg-slab border border-border rounded-lg p-5 mb-8 font-mono text-xs text-muted-foreground">
        <p className="text-foreground mb-3 text-sm font-display tracking-wider">EXPORT PACKAGE</p>
        <div className="space-y-1 pl-2">
          <p className="text-foreground">/scenes</p>
          {scenes.map((s) => (
            <p key={s.id} className={`pl-4 ${s.output_image_url ? 'text-success' : ''}`}>
              scene_{s.scene_number}.png {s.output_image_url ? '✓' : '—'} <span className="text-muted-foreground/50">image/png</span>
            </p>
          ))}
          <p className="mt-2 text-foreground">/transitions</p>
          {transitions.map((t) => (
            <p key={t.id} className={`pl-4 ${t.output_video_url ? 'text-success' : ''}`}>
              transition_{t.transition_number}.mp4 {t.output_video_url ? '✓' : '—'} <span className="text-muted-foreground/50">video/mp4</span>
            </p>
          ))}
          <p className="mt-2 text-foreground">/prompts</p>
          <p className="pl-4">image_prompts.txt</p>
          <p className="pl-4">animation_prompts.txt</p>
          <p className="pl-4">sound_prompts.txt</p>
          <p className="pl-4">narration_prompts.txt</p>
          <p className="pl-4">project_summary.txt</p>
          <p className="mt-2 text-foreground">/metadata</p>
          <p className="pl-4">manifest.json</p>
        </div>
      </div>

      {/* Provider limitations disclosure */}
      {!capability.supportsEndFrame && (
        <div className="mb-8 p-4 border border-spark/20 rounded-lg bg-spark/5">
          <p className="text-[10px] font-display tracking-widest text-spark mb-1">PROVIDER LIMITATION NOTE</p>
          <p className="text-xs text-muted-foreground font-body leading-relaxed">
            Transition videos use <strong>{getModeLabel(capability.effectiveMode)}</strong> mode. The start frame is exact, but the end frame is a prompt-guided target — not an enforced keyframe. The final video frame may not exactly match the next scene image. This is documented in manifest.json.
          </p>
        </div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
        {!done ? (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full py-4 bg-spark text-primary-foreground font-display text-sm tracking-wider rounded-sm hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {exporting ? '[ PACKAGING ASSETS :: ... ]' : <><Download className="w-4 h-4" /> [ EXPORT PROJECT ]</>}
          </button>
        ) : (
          <>
            <div className="w-full py-4 border border-success/30 rounded-sm text-center">
              <p className="font-display text-sm tracking-wider text-success">[ EXPORT COMPLETE ]</p>
              <p className="text-xs text-muted-foreground mt-2 font-body">
                {completedScenes} images (PNG) · {completedTransitions} videos (MP4) · 6 prompt/metadata files
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleDownload('all')} className="py-3 border border-spark/30 text-spark font-display text-xs tracking-wider rounded-sm hover:bg-spark/10 transition-all flex items-center justify-center gap-2">
                <Download className="w-3 h-3" /> DOWNLOAD ALL
              </button>
              <button onClick={() => handleDownload('scenes')} className="py-3 border border-border text-muted-foreground font-display text-xs tracking-wider rounded-sm hover:border-spark/30 hover:text-spark transition-all flex items-center justify-center gap-2">
                <FileImage className="w-3 h-3" /> SCENES ONLY
              </button>
              <button onClick={() => handleDownload('transitions')} className="py-3 border border-border text-muted-foreground font-display text-xs tracking-wider rounded-sm hover:border-spark/30 hover:text-spark transition-all flex items-center justify-center gap-2">
                <Film className="w-3 h-3" /> TRANSITIONS ONLY
              </button>
              <button onClick={() => handleDownload('prompts')} className="py-3 border border-border text-muted-foreground font-display text-xs tracking-wider rounded-sm hover:border-spark/30 hover:text-spark transition-all flex items-center justify-center gap-2">
                <FileText className="w-3 h-3" /> PROMPTS + METADATA
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

function StatCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return (
    <div className="bg-slab border border-border rounded-lg p-4 text-center">
      <div className="flex justify-center mb-2 text-muted-foreground">{icon}</div>
      <p className="text-[10px] font-display tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-display font-bold text-foreground">{value}</p>
      <p className="text-[10px] font-display tracking-wider text-muted-foreground mt-1">{detail}</p>
    </div>
  );
}
