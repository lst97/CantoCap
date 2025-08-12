import React, { useEffect } from 'react';
import { Box } from '@mui/material';
import { useActiveWorkspaceId } from '../../stores/useAppStore';
import { useInputFile, useSubtitles } from '../../stores/useStepStore';
import { 
  useSubtitleWorkspace,
  useSubtitleActions
} from '../../stores/useSubtitleEditStore';
import { VideoPreviewSection } from './ReviewStep/VideoPreviewSection';
import { SubtitleEditor } from './ReviewStep/SubtitleEditor';
import { SubtitleListPanel } from './ReviewStep/SubtitleListPanel';
import { ReviewStepErrorBoundary } from './ReviewStep/ReviewStepErrorBoundary';

const ReviewStepComponent: React.FC = () => {
  const { workspaceId: currentWorkspaceId } = useSubtitleWorkspace();
  const activeWorkspaceId = useActiveWorkspaceId();
  const { loadSubtitlesForWorkspace } = useSubtitleActions();
  const inputFile = useInputFile();
  const stepSubtitles = useSubtitles();

  // Initialize subtitles when workspace or step subtitles change
  useEffect(() => {
    const workspaceId = currentWorkspaceId || activeWorkspaceId;
    if (workspaceId && stepSubtitles && Array.isArray(stepSubtitles) && stepSubtitles.length > 0) {
      const videoPath = inputFile || '';
      
      // Transform step store subtitles to subtitle edit store format
      const transformedSubtitles = stepSubtitles.map((sub, index) => ({
        ...sub,
        index: index + 1,
        duration: sub.endTime - sub.startTime,
        translation: undefined // Optional property
      }));
      
      loadSubtitlesForWorkspace(workspaceId, videoPath, transformedSubtitles);
    }
  }, [currentWorkspaceId, activeWorkspaceId, stepSubtitles, inputFile, loadSubtitlesForWorkspace]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#36393f',
        borderRadius: 2,
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '400px 1fr 400px',
          gridTemplateRows: '1fr',
          height: '100%',
          gap: 2,
          p: 2,
          overflow: 'hidden',
        }}
      >
        {/* Left Panel - Subtitle List */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            gridColumn: '1',
          }}
        >
          <SubtitleListPanel />
        </Box>

        {/* Center Panel - Video Preview */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            gridColumn: '2',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: 1,
            p: 2,
          }}
        >
          <VideoPreviewSection />
        </Box>

        {/* Right Panel - Subtitle Editor */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            gridColumn: '3',
          }}
        >
          <SubtitleEditor />
        </Box>
      </Box>
    </Box>
  );
};

// Export with error boundary wrapper
export const ReviewStep: React.FC = () => (
  <ReviewStepErrorBoundary>
    <ReviewStepComponent />
  </ReviewStepErrorBoundary>
);

export default ReviewStep;