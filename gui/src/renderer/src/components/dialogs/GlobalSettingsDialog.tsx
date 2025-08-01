import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Divider
} from '@mui/material'
import {
  Close as CloseIcon,
  Assessment as SystemIcon
} from '@mui/icons-material'
import { SystemStatus } from '../feedback/SystemStatus'

interface GlobalSettingsDialogProps {
  open: boolean
  onClose: () => void
}

export const GlobalSettingsDialog: React.FC<GlobalSettingsDialogProps> = ({
  open,
  onClose
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#2F3136',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 3,
          minHeight: '60vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        pb: 1,
        backgroundColor: '#36393F',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SystemIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#DCDDDE' }}>
            Global Settings
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          sx={{
            color: '#96989D',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#DCDDDE'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="subtitle1" sx={{ 
            mb: 2, 
            fontWeight: 600, 
            color: '#DCDDDE',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <SystemIcon fontSize="small" />
            System & Dependencies
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Monitor system dependencies and requirements for optimal performance
          </Typography>
          
          <Divider sx={{ mb: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
          
          <SystemStatus />
        </Box>
      </DialogContent>

      <DialogActions sx={{ 
        p: 3, 
        pt: 0,
        backgroundColor: '#36393F',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            backgroundColor: 'primary.main',
            color: 'white',
            px: 4,
            '&:hover': {
              backgroundColor: 'primary.dark'
            }
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}