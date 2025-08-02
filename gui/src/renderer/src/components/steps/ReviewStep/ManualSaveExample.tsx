/**
 * Manual Save Implementation Example
 * 
 * This demonstrates the manual save functionality implemented in the subtitle editing system.
 */

import React from 'react';
import { useSubtitleEditStore } from '../../../stores/subtitle-edit-store';
import { Button, Box, Typography, Alert, CircularProgress } from '@mui/material';

export const ManualSaveExample: React.FC = () => {
  const { 
    manualSaveToIndexedDB, 
    isSaving, 
    saveError, 
    clearSaveError,
    session 
  } = useSubtitleEditStore();

  const handleManualSave = async () => {
    console.log('🔄 Manual save triggered');
    const success = await manualSaveToIndexedDB();
    console.log(success ? '✅ Save successful' : '❌ Save failed');
  };

  return (
    <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
      <Typography variant="h6" gutterBottom>
        Manual Save System Demo
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Session: {session?.sessionId || 'None'} | 
        Dirty: {session?.isDirty ? 'Yes' : 'No'} | 
        Subtitles: {session?.currentSubtitles?.length || 0}
      </Typography>

      <Button
        variant="contained"
        onClick={handleManualSave}
        disabled={isSaving || !session?.isDirty}
        startIcon={isSaving ? <CircularProgress size={16} /> : undefined}
        sx={{ mr: 1 }}
      >
        {isSaving ? 'Saving...' : 'Manual Save'}
      </Button>

      {saveError && (
        <Alert 
          severity="error" 
          onClose={clearSaveError}
          sx={{ mt: 2 }}
        >
          {saveError}
        </Alert>
      )}

      <Typography variant="caption" display="block" sx={{ mt: 2, color: 'text.secondary' }}>
        Manual save will only execute if session.isDirty is true
      </Typography>
    </Box>
  );
};