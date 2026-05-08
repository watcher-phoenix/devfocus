import { useState, lazy, Suspense } from 'react';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

export default function EmojiButton({ onSelect, size = 'small' }) {
  const [anchorEl, setAnchorEl] = useState(null);

  return (
    <>
      <Tooltip title="Add emoji">
        <IconButton size={size} onClick={(e) => setAnchorEl(e.currentTarget)}>
          <EmojiEmotionsIcon sx={{ fontSize: size === 'small' ? 20 : 24 }} />
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Suspense fallback={null}>
          <EmojiPicker
            theme="dark"
            width={320}
            height={400}
            onEmojiClick={(emojiData) => {
              onSelect(emojiData.emoji);
              setAnchorEl(null);
            }}
            searchPlaceholder="Search emoji..."
            previewConfig={{ showPreview: false }}
          />
        </Suspense>
      </Popover>
    </>
  );
}
