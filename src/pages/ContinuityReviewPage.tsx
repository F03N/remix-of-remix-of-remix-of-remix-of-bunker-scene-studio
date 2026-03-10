import { useAppStore } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useState } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { validateSceneContinuity, type ValidationResult, type ValidationWarning } from '@/lib/services/scene-validation';

export default function ContinuityReviewPage() {
  const { scenes, project, updateScene, setStep } = useAppStore();
  const [repairingScenes, setRepairingScenes] = useState<Set<number>>(new Set());
  const [overridden, setOverridden] = useState(false);
  const [showDetails, setShowDetails] = useState(true);

  const validation = validateSceneContinuity(scenes);
  const allComplete = scenes.every(s => s.status === 'completed');
  const canProceed = (validation.passed && allComplete) || overridden;

  const handleRepairScene = async (sceneNumber: number) => {
    if (!project) return;
    const scene = scenes.find(s => s.scene_number === sceneNumber);
    if (!scene) return;

    // Get previous scene for reference
    const prevScene = scenes.find(s => s.scene_number === sceneNumber - 1);
    if (!prevScene?.output_image_url) {
      toast.error(`Scene ${sceneNumber - 1} must be generated first`);
      return;
    }

    setRepairingScenes(prev => new Set(prev).add(sceneNumber));
    updateScene(scene.id, { status: 'generating' });

    try {
      // Set reference image from previous scene
      updateScene(scene.id, { reference_image_url: prevScene.output_image_url });

      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: { sceneId: scene.id, projectId: project.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      updateScene(scene.id, {
        status: 'completed',
        output_image_url: data.scene?.output_image_url || data.outputImageUrl,
        reference_image_url: prevScene.output_image_url,
      });

      // Update next scene's reference
      const nextScene = scenes.find(s => s.scene_number === sceneNumber + 1);
      if (nextScene) {
        updateScene(nextScene.id, { reference_image_url: data.scene?.output_image_url || data.outputImageUrl });
      }

      toast.success(`Scene ${sceneNumber} repaired with continuity reference`);
    } catch (err: any) {
      updateScene(scene.id, { status: 'failed' });
      toast.error(err.message || `Failed to repair Scene ${sceneNumber}`);
    } finally {
      setRepairingScenes(prev => {
        const next = new Set(prev);
        next.delete(sceneNumber);
        return next;
      });
    }
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-2">
        <Shield className="w-5 h-5 text-spark" />
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          CONTINUITY REVIEW
        </h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 font-body">
        Validate visual continuity across all 9 scenes before generating transition videos.
      </p>

      {/* Validation Summary */}
      <div className={cn(
        "p-4 border rounded-lg mb-6",
        validation.passed ? "border-success/30 bg-success/5" : "border-spark/30 bg-spark/5"
      )}>
        <div className="flex items-center gap-2 mb-2">
          {validation.passed ? (
            <CheckCircle className="w-4 h-4 text-success" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-spark" />
          )}
          <span className="font-display text-sm tracking-wider text-foreground">
            {validation.passed ? 'CONTINUITY CHECK PASSED' : `${validation.warnings.length} ISSUE${validation.warnings.length > 1 ? 'S' : ''} DETECTED`}
          </span>
        </div>
        {!validation.passed && (
          <p className="text-xs text-muted-foreground font-body">
            {validation.critical
              ? 'Critical issues found. Fix them before proceeding to transitions.'
              : 'Warnings found. You can repair scenes or override to proceed.'}
          </p>
        )}
      </div>

      {/* Warnings List */}
      {validation.warnings.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1.5 text-[10px] font-display tracking-wider text-muted-foreground hover:text-foreground mb-2"
          >
            VALIDATION DETAILS
            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                {validation.warnings.map((w, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-3 border rounded-sm text-xs font-body",
                      w.severity === 'critical' ? "border-destructive/30 bg-destructive/5 text-destructive" :
                      w.severity === 'warning' ? "border-spark/30 bg-spark/5 text-spark" :
                      "border-border bg-slab text-muted-foreground"
                    )}
                  >
                    <span className="font-display tracking-wider text-[10px] uppercase">{w.type}</span>
                    {w.sceneNumber > 0 && <span className="ml-2 text-[10px]">SCENE {w.sceneNumber}</span>}
                    <p className="mt-1">{w.message}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Scene Grid */}
      <div className="mb-6">
        <p className="text-[10px] font-display tracking-widest text-muted-foreground mb-3">ALL 9 SCENES — CONTINUITY VIEW</p>
        <div className="grid grid-cols-3 gap-3">
          {scenes.map((scene, i) => {
            const sceneWarnings = validation.warnings.filter(w => w.sceneNumber === scene.scene_number);
            const hasIssue = sceneWarnings.length > 0;
            const isRepairing = repairingScenes.has(scene.scene_number);
            const prevScene = scenes.find(s => s.scene_number === scene.scene_number - 1);
            const hasRef = !!scene.reference_image_url;

            return (
              <motion.div
                key={scene.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "border rounded-lg p-3",
                  hasIssue ? "border-spark/40" : "border-border",
                  "bg-slab"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-[10px] tracking-wider text-spark">
                      {String(scene.scene_number).padStart(2, '0')}
                    </span>
                    <span className="font-display text-xs text-foreground truncate">
                      {scene.scene_title}
                    </span>
                  </div>
                  {hasIssue && <AlertTriangle className="w-3 h-3 text-spark flex-shrink-0" />}
                  {!hasIssue && scene.status === 'completed' && <CheckCircle className="w-3 h-3 text-success flex-shrink-0" />}
                </div>

                <div className="aspect-[9/16] bg-background border border-border rounded-sm overflow-hidden mb-2">
                  {scene.output_image_url ? (
                    <img src={scene.output_image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-[10px] font-display text-muted-foreground">NOT GENERATED</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className={cn(
                    "text-[9px] font-display tracking-wider",
                    hasRef ? "text-success" : scene.scene_number === 1 ? "text-muted-foreground" : "text-spark"
                  )}>
                    {scene.scene_number === 1 ? 'ORIGIN' : hasRef ? 'REF ✓' : 'NO REF ⚠'}
                  </span>

                  {hasIssue && scene.scene_number > 1 && prevScene?.output_image_url && (
                    <button
                      onClick={() => handleRepairScene(scene.scene_number)}
                      disabled={isRepairing}
                      className="text-[9px] font-display tracking-wider text-spark hover:text-foreground transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      {isRepairing ? (
                        <><RefreshCw className="w-2.5 h-2.5 animate-spin" /> REPAIRING</>
                      ) : (
                        'REPAIR'
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => setStep('transitions')}
          disabled={!canProceed}
          className={cn(
            "px-8 py-3 font-display text-sm tracking-wider rounded-sm transition-all",
            canProceed
              ? "bg-spark text-primary-foreground hover:brightness-110"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          [ PROCEED TO TRANSITIONS ]
        </button>

        {!validation.passed && !validation.critical && !overridden && (
          <button
            onClick={() => {
              setOverridden(true);
              toast.info('Continuity warnings overridden. Proceeding may affect transition quality.');
            }}
            className="px-6 py-3 border border-spark/30 text-spark font-display text-xs tracking-wider rounded-sm hover:bg-spark/10 transition-all"
          >
            [ OVERRIDE WARNINGS ]
          </button>
        )}

        <button
          onClick={() => setStep('scenes')}
          className="px-6 py-3 border border-border text-muted-foreground font-display text-xs tracking-wider rounded-sm hover:border-spark/30 hover:text-spark transition-all"
        >
          [ BACK TO SCENES ]
        </button>
      </div>
    </div>
  );
}
