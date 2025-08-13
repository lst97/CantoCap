import React, { useCallback } from 'react';
import { Box, Typography, IconButton, Stack } from '@mui/material';
import {
  Folder as FolderIcon,
  Clear as ClearIcon,
  AutoAwesome as AutoIcon,
} from '@mui/icons-material';
import { BaseButton, BaseAlert, BaseSelector } from '../elements';
import { useConfigStepContent, useStepActions } from '../../stores/useStepStore';

export const OutputLocationSelector: React.FC = () => {
  const config = useConfigStepContent();
  const { updateStepContent } = useStepActions();

  const handleOutputSelect = useCallback(async () => {
    try {
      const result = await window.cantocapAPI.openFolderDialog();

      if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        const fileName = config.inputFile
          ? config.inputFile
              .split(/[\\/]/)
              .pop()
              ?.replace(/\.[^/.]+$/, '.srt')
          : 'output.srt';
        const outputPath = `${folderPath}/${fileName}`;

        await updateStepContent('config', { outputFile: outputPath });
      }
    } catch (error) {
      console.error('Failed to select output location:', error);
    }
  }, [config.inputFile, updateStepContent]);

  const handleOutputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      try {
        await updateStepContent('config', { outputFile: e.target.value });
      } catch (err) {
        console.error('Failed to update output file configuration:', err);
      }
    },
    [updateStepContent]
  );

  const handleClearOutput = useCallback(async () => {
    try {
      await updateStepContent('config', { outputFile: null });
    } catch (err) {
      console.error('Failed to clear output file configuration:', err);
    }
  }, [updateStepContent]);

  return (
    <Box>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 2, lineHeight: 1.6 }}>
        Choose where to save your generated subtitle file. If not specified, it will be saved next
        to your input file.
      </Typography>

      <Stack spacing={2}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <BaseSelector
            fullWidth
            value={config.outputFile || ''}
            onChange={handleOutputChange}
            placeholder='Auto-generated from input file'
            size='small'
            slotProps={{
              input: {
                endAdornment: config.outputFile && (
                  <IconButton
                    size='small'
                    onClick={handleClearOutput}
                    sx={{
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        backgroundColor: 'rgba(237, 66, 69, 0.1)',
                        color: 'error.main',
                      },
                    }}
                  >
                    <ClearIcon fontSize='small' />
                  </IconButton>
                ),
              },
            }}
          />
          <BaseButton
            variant='outline'
            onClick={handleOutputSelect}
            startIcon={<FolderIcon />}
            size='small'
            sx={{ minWidth: 100 }}
          >
            Browse
          </BaseButton>
        </Box>

        {!config.outputFile && (config.inputFile ?? false) && (
          <BaseAlert icon={<AutoIcon />} severity='info' size='small'>
            <Typography variant='body2' sx={{ fontWeight: 500, mb: 0.5 }}>
              Auto-generated location:
            </Typography>
            <Typography
              variant='body2'
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                p: 1,
                borderRadius: 1,
                wordBreak: 'break-all',
              }}
            >
              {(config.inputFile ?? '').replace(/\.[^/.]+$/, '.srt')}
            </Typography>
          </BaseAlert>
        )}
      </Stack>
    </Box>
  );
};
