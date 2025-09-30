import { EstimateSummary } from '../../components/EstimateSummary';
import { FileDropZone } from '../../components/FileDropZone';
import { ModelViewer } from '../../components/ModelViewer';

export default function ViewerPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <FileDropZone />
      <ModelViewer />
      <EstimateSummary />
    </div>
  );
}
