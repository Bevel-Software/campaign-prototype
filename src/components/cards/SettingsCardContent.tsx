import type { SettingsCardData, CampaignObjective } from '../../lib/canvasTypes';
import { InlineEditable } from './InlineEditable';

interface Props {
  data: SettingsCardData;
  onFieldChange?: (field: string, value: string) => void;
}

const OBJECTIVE_OPTIONS: { value: CampaignObjective; label: string }[] = [
  { value: 'tofu', label: 'TOFU' },
  { value: 'mofu', label: 'MOFU' },
  { value: 'bofu', label: 'BOFU' },
];

export function SettingsCardContent({ data, onFieldChange }: Props) {
  const empty = <span style={{ color: 'var(--gray-300)', fontStyle: 'italic' }}>—</span>;

  return (
    <>
      <div className="settings-card-header">
        <div className="icon">&#9881;</div>
        <div>
          <div className="title">{data.name}</div>
          <div className="subtitle">Campaign Settings</div>
        </div>
      </div>
      <div className="settings-card-body">
        <div className="settings-card-row">
          <div className="settings-card-field">
            <div className="field-label">Objective</div>
            <div className="settings-card-badges selectable" onPointerDown={(e) => e.stopPropagation()}>
              {OBJECTIVE_OPTIONS.map((opt) => (
                <span
                  key={opt.value}
                  className={`settings-card-badge objective ${data.campaignObjective === opt.value ? 'active' : ''}`}
                  onClick={onFieldChange ? () => onFieldChange('campaignObjective', opt.value) : undefined}
                  style={onFieldChange ? { cursor: 'pointer' } : undefined}
                >
                  {opt.label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="settings-card-row">
          <div className="settings-card-field">
            <div className="field-label">Market</div>
            {data.market && onFieldChange ? (
              <InlineEditable className="field-value" value={data.market} onChange={(v) => onFieldChange('market', v)} />
            ) : (
              <div className="field-value">{data.market || empty}</div>
            )}
          </div>
        </div>
        <div className="settings-card-row">
          <div className="settings-card-field">
            <div className="field-label">Positioning</div>
            {data.positioning && onFieldChange ? (
              <InlineEditable className="field-value" value={data.positioning} onChange={(v) => onFieldChange('positioning', v)} />
            ) : (
              <div className="field-value">{data.positioning || empty}</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
