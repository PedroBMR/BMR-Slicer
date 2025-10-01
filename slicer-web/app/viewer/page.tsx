import { EstimateSummary } from '../../components/EstimateSummary';
import { FileDrop } from '../../components/FileDrop';
import { ModelViewer } from '../../components/ModelViewer';

export default function ViewerPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <FileDrop />
      <ModelViewer />
      <EstimateSummary />
    </div>
  );
}
