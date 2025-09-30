import { EstimateSummary } from '../../components/EstimateSummary';
import { FileDropZone } from '../../components/FileDropZone';
import { ViewerCanvas } from '../../components/ViewerCanvas';

export default function ViewerPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <FileDropZone />
      <ViewerCanvas />
      <EstimateSummary />
    </div>
  );
}
