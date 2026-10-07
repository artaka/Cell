import React, { useState } from 'react';
import { useUI } from '../../context/UIContext';
import { useChat } from '../../context/ChatContext';
import { filesApi } from '../../api/files';
import { formatMessageWithMedia } from '../../utils/mediaParser';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { UploadCloud, Image, Video, Send, Loader2 } from 'lucide-react';

export const MediaPickerModal: React.FC = () => {
  const { isMediaPickerOpen, closeMediaPicker, showToast } = useUI();
  const { sendMessage } = useChat();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        showToast('Файл превышает лимит 50 МБ', 'error');
        return;
      }

      setSelectedFile(file);
      const isVid = file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name);
      setFileType(isVid ? 'video' : 'image');

      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSend = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      // 1. Upload to S3/MinIO via backend API: POST /api/v1/files/messages/
      const uploadRes = await filesApi.uploadMessageMedia(selectedFile);

      // Determine uploaded media type from server or fallback
      const finalType = uploadRes.media_type === 'video' ? 'video' : 'image';
      const uploadedUrl = uploadRes.media_url;

      // 2. Format message with user caption and special tag {{media:url type:type}}
      const finalMessage = formatMessageWithMedia(caption, [
        { url: uploadedUrl, type: finalType },
      ]);

      // 3. Send via active chat WebSocket
      sendMessage(finalMessage);
      showToast('Вложение успешно отправлено', 'success');

      closeMediaPicker();
      setSelectedFile(null);
      setPreviewUrl(null);
      setCaption('');
    } catch (err: any) {
      console.error('[MediaUpload] Failed:', err);
      showToast(err.message || 'Ошибка загрузки медиафайла на сервер', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (isUploading) return;
    closeMediaPicker();
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption('');
  };

  return (
    <Modal
      isOpen={isMediaPickerOpen}
      onClose={handleClose}
      title="Прикрепить фото или видео"
      description="Файл будет загружен в защищенное хранилище S3"
    >
      <div className="flex flex-col gap-4">
        {/* Upload Dropzone */}
        {!selectedFile ? (
          <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition bg-slate-50/50 dark:bg-[#182229]/50">
            <UploadCloud size={40} className="text-slate-400 dark:text-slate-500 mb-2" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Нажмите для выбора фото или видео
            </span>
            <span className="text-xs text-slate-400 mt-1 text-center">
              JPG, PNG, WEBP, GIF, MP4, WEBM, MOV (до 50 МБ)
            </span>
            <input
              type="file"
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,video/mp4,video/webm,video/quicktime"
            />
          </label>
        ) : (
          <div className="flex flex-col gap-3">
            {fileType === 'video' ? (
              <div className="relative rounded-xl overflow-hidden max-h-60 bg-black flex items-center justify-center">
                <video
                  src={previewUrl || undefined}
                  controls
                  className="max-h-60 object-contain w-full"
                />
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden max-h-60 bg-slate-900 flex items-center justify-center">
                <img
                  src={previewUrl || undefined}
                  alt="Предпросмотр"
                  className="max-h-60 object-contain"
                />
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
              <span className="truncate max-w-[200px] font-medium">{selectedFile.name}</span>
              <span>{(selectedFile.size / (1024 * 1024)).toFixed(1)} МБ</span>
            </div>

            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Добавить подпись к медиа..."
              disabled={isUploading}
              className="w-full py-2 px-3 text-xs rounded-lg bg-slate-50 dark:bg-[#182229] border border-slate-200 dark:border-[#222e35] text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 disabled:opacity-60"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={isUploading}
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
              >
                Выбрать другой
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isUploading}
                onClick={handleSend}
              >
                {isUploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Загрузка на S3...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Отправить в чат</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
