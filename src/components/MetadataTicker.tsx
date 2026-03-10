import { useAppStore } from '@/lib/store';
import { QUALITY_PRESETS } from '@/lib/types';

export default function MetadataTicker() {
  const project = useAppStore((s) => s.project);
  const qualityMode = useAppStore((s) => s.qualityMode);
  const preset = QUALITY_PRESETS[qualityMode];

  if (!project) return null;

  return (
    <div className="metadata-ticker border-border">
      <div>
        <span className="label">Project </span>
        <span className="value">{project.project_name}</span>
      </div>
      <div className="h-3 w-px bg-border" />
      <div>
        <span className="label">Mode </span>
        <span className="value">{preset.label}</span>
      </div>
      <div className="h-3 w-px bg-border" />
      <div>
        <span className="label">Style </span>
        <span className="value">{project.final_style}</span>
      </div>
      <div className="h-3 w-px bg-border" />
      <div>
        <span className="label">Mood </span>
        <span className="value">{project.visual_mood}</span>
      </div>
      <div className="h-3 w-px bg-border" />
      <div>
        <span className="label">Format </span>
        <span className="value">9:16</span>
      </div>
    </div>
  );
}
