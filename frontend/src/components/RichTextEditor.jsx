import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import CodeIcon from '@mui/icons-material/Code';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';

function ToolbarButton({ icon, label, active, onClick }) {
  return (
    <Tooltip title={label} arrow>
      <IconButton
        size="small"
        onClick={onClick}
        sx={{
          borderRadius: 1,
          color: active ? 'primary.main' : 'text.secondary',
          bgcolor: active ? 'rgba(124, 77, 255, 0.1)' : 'transparent',
          '&:hover': { bgcolor: active ? 'rgba(124, 77, 255, 0.15)' : 'rgba(255,255,255,0.05)' },
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}

export default function RichTextEditor({ content, onChange, placeholder, minHeight = 200, compact = false, debounce = 800 }) {
  const saveTimer = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder || 'Start typing...' }),
      Image.configure({ inline: true, allowBase64: true }),
    ],
    editorProps: {
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find((i) => i.type.startsWith('image/'));
        if (!imageItem) return false;
        event.preventDefault();
        const file = imageItem.getAsFile();
        const reader = new FileReader();
        reader.onload = () => {
          view.dispatch(
            view.state.tr.replaceSelectionWith(
              view.state.schema.nodes.image.create({ src: reader.result })
            )
          );
        };
        reader.readAsDataURL(file);
        return true;
      },
      handleDrop(view, event) {
        const files = Array.from(event.dataTransfer?.files || []);
        const imageFile = files.find((f) => f.type.startsWith('image/'));
        if (!imageFile) return false;
        event.preventDefault();
        const reader = new FileReader();
        reader.onload = () => {
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (pos) {
            view.dispatch(
              view.state.tr.insert(
                pos.pos,
                view.state.schema.nodes.image.create({ src: reader.result })
              )
            );
          }
        };
        reader.readAsDataURL(imageFile);
        return true;
      },
    },
    content: content || '',
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      if (debounce > 0) {
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => onChange(html), debounce);
      } else {
        onChange(html);
      }
    },
  });

  // Sync external content changes (e.g. switching dates)
  const lastExternal = useRef(content);
  useEffect(() => {
    if (editor && content !== lastExternal.current) {
      lastExternal.current = content;
      const currentHtml = editor.getHTML();
      if (content !== currentHtml) {
        editor.commands.setContent(content || '');
      }
    }
  }, [content, editor]);

  // Cleanup timer
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  if (!editor) return null;

  const toolbarSize = compact ? 16 : 18;

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        '&:focus-within': { borderColor: 'primary.main' },
      }}
    >
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          gap: 0.25,
          p: compact ? 0.25 : 0.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexWrap: 'wrap',
        }}
      >
        <ToolbarButton icon={<FormatBoldIcon sx={{ fontSize: toolbarSize }} />} label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarButton icon={<FormatItalicIcon sx={{ fontSize: toolbarSize }} />} label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolbarButton icon={<StrikethroughSIcon sx={{ fontSize: toolbarSize }} />} label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} />
        <ToolbarButton icon={<CodeIcon sx={{ fontSize: toolbarSize }} />} label="Code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} />
        <Box sx={{ width: '1px', bgcolor: 'divider', mx: 0.5, my: 0.25 }} />
        <ToolbarButton icon={<FormatListBulletedIcon sx={{ fontSize: toolbarSize }} />} label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolbarButton icon={<FormatListNumberedIcon sx={{ fontSize: toolbarSize }} />} label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <ToolbarButton icon={<FormatQuoteIcon sx={{ fontSize: toolbarSize }} />} label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <Box sx={{ flex: 1 }} />
        <ToolbarButton icon={<UndoIcon sx={{ fontSize: toolbarSize }} />} label="Undo" onClick={() => editor.chain().focus().undo().run()} />
        <ToolbarButton icon={<RedoIcon sx={{ fontSize: toolbarSize }} />} label="Redo" onClick={() => editor.chain().focus().redo().run()} />
      </Box>

      {/* Editor */}
      <Box
        sx={{
          '& .tiptap': {
            outline: 'none',
            minHeight,
            p: compact ? 1 : 1.5,
            fontSize: compact ? '0.8rem' : '0.9rem',
            lineHeight: 1.7,
            color: 'text.primary',
            '& p': { m: 0, mb: 0.5 },
            '& ul, & ol': { pl: 2.5, mb: 0.5 },
            '& li': { mb: 0.25 },
            '& blockquote': {
              borderLeft: '3px solid',
              borderColor: 'divider',
              pl: 1.5,
              ml: 0,
              color: 'text.secondary',
              fontStyle: 'italic',
            },
            '& code': {
              bgcolor: 'rgba(255,255,255,0.06)',
              px: 0.5,
              borderRadius: 0.5,
              fontFamily: 'monospace',
              fontSize: '0.85em',
            },
            '& img': {
              maxWidth: '100%',
              height: 'auto',
              borderRadius: 4,
              my: 0.5,
            },
            '& pre': {
              bgcolor: 'rgba(255,255,255,0.06)',
              p: 1.5,
              borderRadius: 1,
              overflow: 'auto',
              '& code': { bgcolor: 'transparent', p: 0 },
            },
            '& p.is-editor-empty:first-of-type::before': {
              content: 'attr(data-placeholder)',
              color: 'text.disabled',
              float: 'left',
              height: 0,
              pointerEvents: 'none',
            },
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
