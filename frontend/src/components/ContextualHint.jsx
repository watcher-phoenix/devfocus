import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { useSettings, useUpdateSettings } from '../api/settings';

export default function ContextualHint({ hintId, children }) {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [localDismissed, setLocalDismissed] = useState(false);

  const dismissed = localDismissed || (settings?.dismissedHints || []).includes(hintId);

  const handleDismiss = () => {
    setLocalDismissed(true);
    const current = settings?.dismissedHints || [];
    if (!current.includes(hintId)) {
      updateSettings.mutate({ dismissedHints: [...current, hintId] });
    }
  };

  return (
    <Collapse in={!dismissed}>
      <Alert
        severity="info"
        sx={{ mb: 2 }}
        action={
          <IconButton size="small" onClick={handleDismiss}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      >
        {children}
      </Alert>
    </Collapse>
  );
}
