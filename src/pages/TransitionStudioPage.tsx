import { useAppStore } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { RefreshCw, Info, AlertTriangle, ChevronDown, ChevronUp, Sliders } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { QUALITY_PRESETS } from '@/lib/types';
import {
  getProviderCapability,
  getModeLabel,
  getModeDescription,
  getHonestyLabel,
  isEndFrameExact,
  getModeBadgeVariant,
  type TransitionMode,
} from '@/lib/services/provider-capabilities';

interface TransitionControls {
  motionStrength: number;
  cameraIntensity: number;
  realismPriority: number;
  morphSuppression: number;
  targetStrictness: number;
  continuityStrictness: number;
}

const DEFAULT_CONTROLS: TransitionControls = {
  motionStrength: 50,
  cameraIntensity: 30,
  realismPriority: 80,
  morphSuppression: 90,
  targetStrictness: 70,
  continuityStrictness: 90,
};

const DEFAULT_EXACT_CONTROLS: TransitionControls = {
  ...DEFAULT_CONTROLS,
  targetStrictness: 95,
  morphSuppression: 95,
};

export default function TransitionStudioPage() {
  const { scenes, transitions, project, qualityMode, updateTransition, setStep } = useAppStore();
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [showProviderInfo, setShowProviderInfo] = useState(false);
  const [expandedControls, setExpandedControls] = useState<Set<string>>(new Set());
  const [transitionControls, setTransitionControls] = useState<Record<string, TransitionControls>>({});

  const preset = QUALITY_PRESETS[qualityMode];
  const capability = getProviderCapability(preset.video);
  const honesty = getHonestyLabel(capability.effectiveMode);
  const modeBadge = getModeBadgeVariant(capability.effectiveMode);
  const allScenesComplete = scenes.every((s) => s.status === 'completed');

  const getControlsForTransition = (transitionId: string): TransitionControls => {
    if (transitionControls[transitionId]) return transitionControls[transitionId];
    return isEndFrameExact(capability.effectiveMode) ? DEFAULT_EXACT_CONTROLS : DEFAULT_CONTROLS;
  };

  const updateControls = (transitionId: string, key: keyof TransitionControls, value: number) => {
    setTransitionControls(prev => ({
      ...prev,
      [transitionId]: {
        ...getControlsForTransition(transitionId),
        [key]: value,
      },
    }));
  };

  const toggleControls = (transitionId: string) => {
    setExpandedControls(prev => {
      const next = new Set(prev);
      if (next.has(transitionId)) next.delete(transitionId);
      else next.add(transitionId);
      return next;
    });
  };

  const handleGenerate = async (transitionId: string) => {
    if (!project) return;

    const t = transitions.find((tr) => tr.id === transitionId);
    if (!t) return;

    const fromScene = scenes.find((s) => s.scene_number === t.from_scene);
    const toScene = scenes.find((s) => s.scene_number === t.to_scene);

    if (!fromScene?.output_image_url) {
      toast.error(`Scene ${t.from_scene} must be generated first`);
      return;
    }
    if (!toScene?.output_image_url) {
      toast.error(`Scene ${t.to_scene} must be generated first`);
      return;
    }

    setGeneratingIds((prev) => new Set(prev).add(transitionId));
    updateTransition(transitionId, { status: 'generating' });

    try {
      const controls = getControlsForTransition(transitionId);
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: { transitionId, projectId: project.id, transitionControls: controls },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      updateTransition(transitionId, {
        status: 'completed',
        output_video_url: data.transition.output_video_url,
        start_image_url: data.transition.start_image_url,
        end_image_url: data.transition.end_image_url,
        provider_mode: data.providerCapability?.effectiveMode || capability.effectiveMode,
        video_model: data.providerCapability?.model || preset.video,
      });

      const modeLabel = getModeLabel(data.providerCapability?.effectiveMode || capability.effectiveMode);
      const exactStr = data.providerCapability?.endFrameExact ? ' [EXACT]' : ' [GUIDED]';
      toast.success(`Transition ${data.transition.transition_number} generated — ${modeLabel}${exactStr}`);
    } catch (err: any) {
      console.error('Transition generation error:', err);
      updateTransition(transitionId, { status: 'failed' });
      toast.error(err.message || 'Failed to generate transition');
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(transitionId);
        return next;
      });
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground mb-2">
        TRANSITION STUDIO
      </h1>
      <p className="text-sm text-muted-foreground mb-4 font-body">
        Generate transition videos between consecutive scenes. Each transition starts from the exact scene image.
      </p>

      {/* Provider capability — honest disclosure */}
      <button
        onClick={() => setShowProviderInfo(!showProviderInfo)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-spark transition-colors mb-4 font-display tracking-wider"
      >
        <Info className="w-3.5 h-3.5" />
        PROVIDER MODE: {getModeLabel(capability.effectiveMode).toUpperCase()}
        <span className={cn("text-[10px] px-2 py-0.5 border rounded-sm font-display tracking-wider", modeBadge.colorClass)}>
          {honesty.badge}
        </span>
        {showProviderInfo ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      <AnimatePresence>
        {showProviderInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-4 bg-slab border border-border rounded-lg overflow-hidden"
          >
            <p className="text-[10px] font-display tracking-widest text-muted-foreground mb-2">PROVIDER CAPABILITIES — HONEST DISCLOSURE</p>
            <div className="space-y-1 text-xs font-body text-muted-foreground">
              <p><span className="text-foreground">Provider:</span> {capability.provider}</p>
              <p><span className="text-foreground">Model:</span> {capability.model}</p>
              <p><span className="text-foreground">Start Frame:</span> {capability.supportsStartFrame ? '✓ Exact — video starts from this image' : '✗ Not supported'}</p>
              <p><span className="text-foreground">End Frame:</span> {capability.supportsEndFrame ? '✓ Exact — video ends on target image (real keyframe)' : '✗ Guided only — end frame is a prompt target, not an exact keyframe'}</p>
              <p><span className="text-foreground">Multi-Keyframe:</span> {capability.supportsMultiKeyframe ? '✓ Supported' : '✗ Not supported'}</p>
              <p><span className="text-foreground">Effective Mode:</span> <span className={honesty.color}>{getModeLabel(capability.effectiveMode)} ({honesty.badge})</span></p>
              {capability.providerNotes && (
                <p><span className="text-foreground">Notes:</span> {capability.providerNotes}</p>
              )}
              <p className="mt-2 text-muted-foreground/80 italic">{getModeDescription(capability.effectiveMode)}</p>

              {capability.supportsEndFrame && (
                <div className="mt-3 p-2 border border-success/20 rounded-sm bg-success/5">
                  <div className="flex items-start gap-2">
                    <span className="text-success mt-0.5 flex-shrink-0">✓</span>
                    <p className="text-[10px] text-success">
                      This provider supports TRUE dual-frame conditioning. Both start and end images are attached as real visual keyframes — the video is guaranteed to start and end on these exact frames.
                    </p>
                  </div>
                </div>
              )}

              {!capability.supportsEndFrame && (
                <div className="mt-3 p-2 border border-spark/20 rounded-sm bg-spark/5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 text-spark mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] text-spark">
                      The end frame target image is referenced in the prompt but NOT enforced as a keyframe. The generated video will transition toward the target but the final frame may not exactly match Scene N+1. This is a provider limitation, not a bug.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!allScenesComplete && (
        <div className="mb-6 p-4 border border-destructive/30 rounded-lg bg-destructive/5">
          <p className="text-xs font-display tracking-wider text-destructive">
            ⚠ GENERATE ALL SCENE IMAGES FIRST
          </p>
          <p className="text-xs text-muted-foreground font-body mt-1">
            All 9 scenes must be completed before generating transition videos.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {transitions.map((t, i) => {
          const fromScene = scenes.find((s) => s.scene_number === t.from_scene);
          const toScene = scenes.find((s) => s.scene_number === t.to_scene);
          const isGenerating = generatingIds.has(t.id) || t.status === 'generating';
          const canGenerate = !!fromScene?.output_image_url && !!toScene?.output_image_url;
          const tMode = (t.provider_mode || capability.effectiveMode) as TransitionMode;
          const tHonesty = getHonestyLabel(tMode);
          const tBadge = getModeBadgeVariant(tMode);
          const isExact = isEndFrameExact(tMode);
          const showControls = expandedControls.has(t.id);
          const controls = getControlsForTransition(t.id);

          return (
            <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="border border-border rounded-lg bg-slab p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="font-display text-xs tracking-wider text-spark">TRANSITION {t.transition_number}</span>
                  <span className={cn("text-[10px] font-display tracking-wider px-2 py-0.5 border rounded-sm", tBadge.colorClass)}>
                    {tBadge.label.toUpperCase()}
                  </span>
                  {t.video_model && (
                    <span className="text-[10px] font-display tracking-wider text-muted-foreground">{t.video_model}</span>
                  )}
                </div>
                <StatusBadge status={t.status} />
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-display tracking-widest text-success">START FRAME (EXACT) — SCENE {t.from_scene}</span>
                  <div className="aspect-[9/16] bg-background border border-success/20 rounded-sm flex items-center justify-center overflow-hidden">
                    {fromScene?.output_image_url ? (
                      <img src={fromScene.output_image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-display text-muted-foreground">{fromScene?.scene_title || 'MISSING'}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center">
                  {t.output_video_url ? (
                    <div className="aspect-[9/16] w-full bg-background border border-success/30 rounded-sm flex items-center justify-center overflow-hidden">
                      <video src={t.output_video_url} controls loop muted playsInline className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <div className="h-px w-8 bg-border" />
                      <span className="text-[10px] font-display tracking-wider">VIDEO</span>
                      <div className="h-px w-8 bg-border" />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <span className={cn("text-[10px] font-display tracking-widest", isExact ? "text-success" : "text-spark")}>
                    END {isExact ? 'FRAME (EXACT)' : 'TARGET (GUIDED)'} — SCENE {t.to_scene}
                  </span>
                  <div className={cn(
                    "aspect-[9/16] bg-background border rounded-sm flex items-center justify-center overflow-hidden",
                    isExact ? "border-success/20" : "border-spark/20"
                  )}>
                    {toScene?.output_image_url ? (
                      <img src={toScene.output_image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-display text-muted-foreground">{toScene?.scene_title || 'MISSING'}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-background border border-border rounded-sm p-3 mb-4">
                <span className="text-[10px] font-display tracking-widest text-muted-foreground">ANIMATION PROMPT</span>
                <p className="text-xs text-muted-foreground font-body mt-1 leading-relaxed">{t.animation_prompt}</p>
              </div>

              {/* Per-transition controls */}
              <button
                onClick={() => toggleControls(t.id)}
                className="flex items-center gap-1.5 text-[10px] font-display tracking-wider text-muted-foreground hover:text-foreground transition-colors mb-3"
              >
                <Sliders className="w-3 h-3" />
                TRANSITION CONTROLS
                {showControls ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <AnimatePresence>
                {showControls && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-background border border-border rounded-sm p-4 mb-4 overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <ControlSlider
                        label="Motion Strength"
                        value={controls.motionStrength}
                        onChange={(v) => updateControls(t.id, 'motionStrength', v)}
                        description={isExact ? "Amount of motion between keyframes" : "Amount of motion toward target"}
                      />
                      <ControlSlider
                        label="Camera Intensity"
                        value={controls.cameraIntensity}
                        onChange={(v) => updateControls(t.id, 'cameraIntensity', v)}
                        description="Camera movement amount (0 = static)"
                      />
                      <ControlSlider
                        label="Realism Priority"
                        value={controls.realismPriority}
                        onChange={(v) => updateControls(t.id, 'realismPriority', v)}
                        description="Prioritize photorealism vs stylistic"
                      />
                      <ControlSlider
                        label="Morph Suppression"
                        value={controls.morphSuppression}
                        onChange={(v) => updateControls(t.id, 'morphSuppression', v)}
                        description="Suppress warping/morphing artifacts"
                      />
                      <ControlSlider
                        label={isExact ? "Frame Match Strictness" : "Target Strictness"}
                        value={controls.targetStrictness}
                        onChange={(v) => updateControls(t.id, 'targetStrictness', v)}
                        description={isExact ? "How strictly to match end keyframe" : "How strongly to guide toward target"}
                      />
                      <ControlSlider
                        label="Continuity Strictness"
                        value={controls.continuityStrictness}
                        onChange={(v) => updateControls(t.id, 'continuityStrictness', v)}
                        description="Architectural/layout consistency"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-2">
                {!isGenerating && (
                  <button
                    onClick={() => handleGenerate(t.id)}
                    disabled={!canGenerate}
                    className={cn(
                      "px-4 py-2 font-display text-xs tracking-wider rounded-sm transition-all",
                      t.status === 'completed'
                        ? "border border-border text-muted-foreground hover:border-spark/30 hover:text-spark"
                        : "bg-spark text-primary-foreground hover:brightness-110",
                      !canGenerate && "opacity-30 cursor-not-allowed"
                    )}
                  >
                    {t.status === 'completed' ? (
                      <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" /> REGENERATE</span>
                    ) : '[ GENERATE VIDEO ]'}
                  </button>
                )}
                {isGenerating && (
                  <div className="px-4 py-2 border border-spark/30 rounded-sm font-display text-xs tracking-wider text-spark animate-pulse-amber">
                    [ RENDERING VIDEO :: ... ]
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-8">
        <button onClick={() => setStep('audio')} className="px-8 py-3 bg-spark text-primary-foreground font-display text-sm tracking-wider rounded-sm hover:brightness-110 transition-all">
          [ PROCEED TO AUDIO / VOICEOVER ]
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { text: string; cls: string }> = {
    pending: { text: 'PENDING', cls: 'text-muted-foreground border-border' },
    generating: { text: 'RENDERING VIDEO', cls: 'text-spark border-spark/30 animate-pulse-amber' },
    completed: { text: 'VIDEO READY', cls: 'text-success border-success/30' },
    failed: { text: 'FAILED', cls: 'text-destructive border-destructive/30' },
  };
  const c = config[status] || config.pending;
  return <span className={cn("status-badge", c.cls)}>[ {c.text} ]</span>;
}

function ControlSlider({ label, value, onChange, description }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-display tracking-wider text-foreground">{label}</span>
        <span className="text-[10px] font-display tracking-wider text-muted-foreground">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 bg-border rounded-sm appearance-none cursor-pointer accent-spark"
      />
      <p className="text-[9px] text-muted-foreground/60 font-body">{description}</p>
    </div>
  );
}
