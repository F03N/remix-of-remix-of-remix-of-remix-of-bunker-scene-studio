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
import {
  MOTION_PRESETS,
  getDefaultPreset,
  getRecommendedPresetForTransition,
  type MotionPreset,
} from '@/lib/services/motion-presets';
import { validateSceneContinuity } from '@/lib/services/scene-validation';

interface TransitionControls {
  motionStrength: number;
  cameraIntensity: number;
  realismPriority: number;
  morphSuppression: number;
  targetStrictness: number;
  continuityStrictness: number;
}

// Strict defaults per master prompt
const DEFAULT_CONTROLS: TransitionControls = {
  motionStrength: 20,
  cameraIntensity: 5,
  realismPriority: 95,
  morphSuppression: 98,
  targetStrictness: 90,
  continuityStrictness: 98,
};

const DEFAULT_EXACT_CONTROLS: TransitionControls = {
  ...DEFAULT_CONTROLS,
  targetStrictness: 95,
  morphSuppression: 99,
};

export default function TransitionStudioPage() {
  const { scenes, transitions, project, qualityMode, updateTransition, setStep } = useAppStore();
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [showProviderInfo, setShowProviderInfo] = useState(false);
  const [expandedControls, setExpandedControls] = useState<Set<string>>(new Set());
  const [transitionControls, setTransitionControls] = useState<Record<string, TransitionControls>>({});
  const [selectedPresets, setSelectedPresets] = useState<Record<string, string>>({});

  const preset = QUALITY_PRESETS[qualityMode];
  const capability = getProviderCapability(preset.video);
  const honesty = getHonestyLabel(capability.effectiveMode);
  const modeBadge = getModeBadgeVariant(capability.effectiveMode);
  const allScenesComplete = scenes.every((s) => s.status === 'completed');

  // Validation gate
  const validation = validateSceneContinuity(scenes);

  const getControlsForTransition = (transitionId: string, t?: { from_scene: number; to_scene: number }): TransitionControls => {
    if (transitionControls[transitionId]) return transitionControls[transitionId];
    // Use scene-aware recommended preset
    if (t) {
      const recommended = getRecommendedPresetForTransition(t.from_scene, t.to_scene);
      return recommended.controls;
    }
    return isEndFrameExact(capability.effectiveMode) ? DEFAULT_EXACT_CONTROLS : DEFAULT_CONTROLS;
  };

  const applyPreset = (transitionId: string, presetId: string) => {
    const motionPreset = MOTION_PRESETS.find(p => p.id === presetId);
    if (!motionPreset) return;
    setSelectedPresets(prev => ({ ...prev, [transitionId]: presetId }));
    setTransitionControls(prev => ({
      ...prev,
      [transitionId]: { ...motionPreset.controls },
    }));
  };

  const updateControls = (transitionId: string, key: keyof TransitionControls, value: number, t?: { from_scene: number; to_scene: number }) => {
    setSelectedPresets(prev => ({ ...prev, [transitionId]: 'custom' }));
    setTransitionControls(prev => ({
      ...prev,
      [transitionId]: {
        ...getControlsForTransition(transitionId, t),
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
      const controls = getControlsForTransition(transitionId, { from_scene: t.from_scene, to_scene: t.to_scene });
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

  const getSelectedPresetLabel = (transitionId: string, t: { from_scene: number; to_scene: number }): string => {
    const selected = selectedPresets[transitionId];
    if (selected === 'custom') return 'Custom';
    if (selected) return MOTION_PRESETS.find(p => p.id === selected)?.label || 'Custom';
    return getRecommendedPresetForTransition(t.from_scene, t.to_scene).label + ' (auto)';
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground mb-2">
        TRANSITION STUDIO
      </h1>
      <p className="text-sm text-muted-foreground mb-4 font-body">
        Generate restrained, realistic bunker restoration timelapse transitions. Same bunker, same camera, gradual progress only.
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
              <p><span className="text-foreground">Effective Mode:</span> <span className={honesty.color}>{getModeLabel(capability.effectiveMode)} ({honesty.badge})</span></p>
              {capability.providerNotes && (
                <p><span className="text-foreground">Notes:</span> {capability.providerNotes}</p>
              )}
              <p className="mt-2 text-muted-foreground/80 italic">{getModeDescription(capability.effectiveMode)}</p>

              {!capability.supportsEndFrame && (
                <div className="mt-3 p-2 border border-spark/20 rounded-sm bg-spark/5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 text-spark mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] text-spark">
                      The end frame target image is referenced in the prompt but NOT enforced as a keyframe. This is a provider limitation, not a bug.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Validation gate warning */}
      {!validation.passed && (
        <div className="mb-6 p-4 border border-spark/30 rounded-lg bg-spark/5">
          <p className="text-xs font-display tracking-wider text-spark">
            ⚠ CONTINUITY ISSUES DETECTED — {validation.warnings.length} warning(s)
          </p>
          <p className="text-xs text-muted-foreground font-body mt-1">
            Go back to Continuity Review to repair scenes or override warnings.
          </p>
          <button
            onClick={() => setStep('continuity')}
            className="mt-2 text-[10px] font-display tracking-wider text-spark hover:text-foreground transition-colors"
          >
            → OPEN CONTINUITY REVIEW
          </button>
        </div>
      )}

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
          const controls = getControlsForTransition(t.id, { from_scene: t.from_scene, to_scene: t.to_scene });
          const presetLabel = getSelectedPresetLabel(t.id, { from_scene: t.from_scene, to_scene: t.to_scene });

          return (
            <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="border border-border rounded-lg bg-slab p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="font-display text-xs tracking-wider text-spark">TRANSITION {t.transition_number}</span>
                  <span className={cn("text-[10px] font-display tracking-wider px-2 py-0.5 border rounded-sm", tBadge.colorClass)}>
                    {tBadge.label.toUpperCase()}
                  </span>
                  <span className="text-[10px] font-display tracking-wider text-muted-foreground">
                    {presetLabel}
                  </span>
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

              {/* Per-transition controls with motion presets */}
              <button
                onClick={() => toggleControls(t.id)}
                className="flex items-center gap-1.5 text-[10px] font-display tracking-wider text-muted-foreground hover:text-foreground transition-colors mb-3"
              >
                <Sliders className="w-3 h-3" />
                MOTION CONTROLS
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
                    {/* Motion Presets */}
                    <div className="mb-4">
                      <span className="text-[10px] font-display tracking-widest text-muted-foreground mb-2 block">MOTION PRESET</span>
                      <div className="flex flex-wrap gap-2">
                        {MOTION_PRESETS.map(mp => (
                          <button
                            key={mp.id}
                            onClick={() => applyPreset(t.id, mp.id)}
                            className={cn(
                              "px-3 py-1.5 text-[10px] font-display tracking-wider border rounded-sm transition-all",
                              (selectedPresets[t.id] === mp.id || (!selectedPresets[t.id] && mp.id === getRecommendedPresetForTransition(t.from_scene, t.to_scene).id))
                                ? "border-spark text-spark bg-spark/10"
                                : "border-border text-muted-foreground hover:border-spark/30 hover:text-spark"
                            )}
                          >
                            {mp.label.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <p className="text-[9px] text-muted-foreground/60 font-body mt-1">
                        {MOTION_PRESETS.find(p => p.id === (selectedPresets[t.id] || getRecommendedPresetForTransition(t.from_scene, t.to_scene).id))?.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <ControlSlider
                        label="Motion Strength"
                        value={controls.motionStrength}
                        onChange={(v) => updateControls(t.id, 'motionStrength', v, { from_scene: t.from_scene, to_scene: t.to_scene })}
                        description="Amount of visible change (lower = more static)"
                      />
                      <ControlSlider
                        label="Camera Intensity"
                        value={controls.cameraIntensity}
                        onChange={(v) => updateControls(t.id, 'cameraIntensity', v, { from_scene: t.from_scene, to_scene: t.to_scene })}
                        description="Camera movement (0 = locked, 5 = barely perceptible push)"
                      />
                      <ControlSlider
                        label="Realism Priority"
                        value={controls.realismPriority}
                        onChange={(v) => updateControls(t.id, 'realismPriority', v, { from_scene: t.from_scene, to_scene: t.to_scene })}
                        description="Photorealism enforcement (95+ recommended)"
                      />
                      <ControlSlider
                        label="Morph Suppression"
                        value={controls.morphSuppression}
                        onChange={(v) => updateControls(t.id, 'morphSuppression', v, { from_scene: t.from_scene, to_scene: t.to_scene })}
                        description="Suppress warping/morphing (98+ recommended)"
                      />
                      <ControlSlider
                        label={isExact ? "Frame Match Strictness" : "Target Strictness"}
                        value={controls.targetStrictness}
                        onChange={(v) => updateControls(t.id, 'targetStrictness', v, { from_scene: t.from_scene, to_scene: t.to_scene })}
                        description={isExact ? "How strictly to match end keyframe" : "How strongly to guide toward target (90+ recommended)"}
                      />
                      <ControlSlider
                        label="Continuity Strictness"
                        value={controls.continuityStrictness}
                        onChange={(v) => updateControls(t.id, 'continuityStrictness', v, { from_scene: t.from_scene, to_scene: t.to_scene })}
                        description="Architecture/layout lock (98+ recommended)"
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
