import type { AssetCardData } from '../../lib/canvasTypes';

interface Props {
  data: AssetCardData;
}

export function AssetCardContent({ data }: Props) {
  return (
    <>
      <div className="asset-card-header">
        <span className="icon">&#128444;</span>
        <span className="label">Reference Asset</span>
        <span className="source-badge">{data.source}</span>
      </div>
      {data.image ? (
        <img className="asset-card-image" src={data.image} alt="Reference" draggable={false} />
      ) : (
        <div className="asset-card-image asset-card-placeholder">No image</div>
      )}
      <div className="asset-card-footer">{data.caption}</div>
    </>
  );
}
