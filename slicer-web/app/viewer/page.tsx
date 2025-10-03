import { EstimateSummary } from '../../components/EstimateSummary';
import { FileDrop } from '../../components/FileDrop';
import { ModelViewer } from '../../components/ModelViewer';
import { ViewerErrorBoundary } from '../../components/ViewerErrorBoundary';

export default function ViewerPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <FileDrop />
      <ViewerErrorBoundary>
        <ModelViewer />
      </ViewerErrorBoundary>
      <EstimateSummary />
    </div>
  );
}
