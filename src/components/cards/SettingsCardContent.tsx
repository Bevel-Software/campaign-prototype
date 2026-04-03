import type { SettingsCardData } from '../../lib/canvasTypes';
import { normalizeChannelList, normalizeObjectiveList } from '../../lib/settingsData';
import { InlineEditable } from './InlineEditable';

interface Props {
  data: SettingsCardData;
  onFieldChange?: (field: string, value: string) => void;
}

export function SettingsCardContent({ data, onFieldChange }: Props) {
  const empty = <span style={{ color: 'var(--gray-300)', fontStyle: 'italic' }}>—</span>;
  const objectives = normalizeObjectiveList(data.objectives);
  const channels = normalizeChannelList(data.channels);
  const hasBadges = objectives.length > 0 || channels.length > 0;

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
        {hasBadges && (
          <div className="settings-card-badges">
            {objectives.map((o, i) => (
              <span key={i} className={`settings-card-badge ${o.type}`}>
                {o.label}
              </span>
            ))}
            {channels.map((c, i) => (
              <span key={`ch-${i}`} className="settings-card-badge channel">
                {c.label}
              </span>
            ))}
          </div>
        )}
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
            <div className="field-label">Budget</div>
            {data.budget && onFieldChange ? (
              <InlineEditable className="field-value" value={data.budget} onChange={(v) => onFieldChange('budget', v)} />
            ) : (
              <div className="field-value">{data.budget || empty}</div>
            )}
          </div>
          <div className="settings-card-field">
            <div className="field-label">Split</div>
            <div className="field-value">{data.split || empty}</div>
          </div>
        </div>
        <div className="settings-card-row">
          <div className="settings-card-field">
            <div className="field-label">Timeline</div>
            {data.timeline && onFieldChange ? (
              <InlineEditable className="field-value" value={data.timeline} onChange={(v) => onFieldChange('timeline', v)} />
            ) : (
              <div className="field-value">{data.timeline || empty}</div>
            )}
          </div>
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
