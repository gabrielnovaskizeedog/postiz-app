'use client';

import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { inputClassName } from '@gitroom/frontend/components/ai-campaigns/ai.campaigns.component';

export interface BrandPhoto {
  id: string;
  path: string;
  emotion: string;
  cutout: boolean;
}

export interface BrandKit {
  identity: string;
  name: string;
  handle: string;
  bio: string;
  category: string;
  avatarPath: string | null;
  captionSize: string;
  captionTone: string;
  captionEmojis: number;
  captionHashtags: number;
  photos: BrandPhoto[];
}

// Same three identities as the carousel studio
const IDENTITIES = [
  { value: 'editorial', name: 'Editorial', fonts: 'Archivo · DM Sans', colors: ['#F3F1EA', '#111111', '#E3A512'] },
  { value: 'noturno', name: 'Noturno', fonts: 'Space Grotesk · Inter', colors: ['#0C0D10', '#F2F3F5', '#B8FF3A'] },
  { value: 'coral', name: 'Coral', fonts: 'Bricolage · Manrope', colors: ['#FAF8F5', '#17153B', '#FF5B3A'] },
];

export const EMOTIONS = [
  'confiante',
  'sorrindo',
  'explicando',
  'pensando',
  'ideia',
  'surpreso',
  'duvida',
  'apontando',
  'rindo',
  'telefone',
  'trabalhando',
];

export const useBrandKit = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await fetch('/brand-kit')).json();
  }, []);

  return useSWR<BrandKit>('brand-kit', load, { revalidateOnFocus: false });
};

const useUpload = () => {
  const fetch = useFetch();
  return useCallback(async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const response = await fetch('/media/upload-server', {
      method: 'POST',
      body: form,
    });
    if (!response.ok) {
      throw new Error('upload failed');
    }
    return (await response.json()).path as string;
  }, []);
};

const PhotoCard: FC<{ photo: BrandPhoto; onChange: () => void }> = ({
  photo,
  onChange,
}) => {
  const t = useT();
  const fetch = useFetch();

  const setEmotion = useCallback(
    async (emotion: string) => {
      await fetch(`/brand-kit/photos/${photo.id}`, {
        method: 'PUT',
        body: JSON.stringify({ emotion }),
      });
      onChange();
    },
    [photo.id]
  );

  const remove = useCallback(async () => {
    if (await deleteDialog(t('brand_photo_delete', 'Remove this photo?'))) {
      await fetch(`/brand-kit/photos/${photo.id}`, { method: 'DELETE' });
      onChange();
    }
  }, [photo.id]);

  return (
    <div className="flex flex-col gap-[8px] p-[8px] rounded-[12px] border border-newBorder">
      <div
        className={clsx(
          'aspect-[3/4] rounded-[8px] overflow-hidden flex items-end justify-center',
          photo.cutout ? 'bg-[#612BD3]/30' : 'bg-newBgColor'
        )}
      >
        <img
          src={photo.path}
          alt={photo.emotion}
          className={clsx(
            'max-h-full',
            photo.cutout ? 'object-contain' : 'w-full h-full object-cover'
          )}
        />
      </div>
      <select
        className={clsx(inputClassName, '!h-[36px] !px-[8px] capitalize')}
        value={photo.emotion}
        onChange={(e) => setEmotion(e.target.value)}
      >
        {[...new Set([photo.emotion, ...EMOTIONS])].map((emotion) => (
          <option key={emotion} value={emotion}>
            {emotion}
          </option>
        ))}
      </select>
      <div className="flex justify-between items-center text-[11px] opacity-70">
        <span>
          {photo.cutout
            ? t('brand_photo_cutout', 'Without background')
            : t('brand_photo_framed', 'In a frame')}
        </span>
        <span className="cursor-pointer underline" onClick={remove}>
          {t('delete', 'Delete')}
        </span>
      </div>
    </div>
  );
};

export const BrandKitComponent: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const upload = useUpload();
  const { data: kit, mutate } = useBrandKit();
  const [form, setForm] = useState<Omit<BrandKit, 'photos'> | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [emotion, setEmotionToAdd] = useState('confiante');
  const photosInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (kit && !form) {
      const { photos, ...rest } = kit;
      setForm(rest);
    }
  }, [kit]);

  const set = useCallback(
    (key: keyof Omit<BrandKit, 'photos'>) => (value: string | number | null) =>
      setForm((current) => (current ? { ...current, [key]: value } : current)),
    []
  );

  const save = useCallback(async () => {
    if (!form) return;
    setSaving(true);
    const response = await fetch('/brand-kit', {
      method: 'PUT',
      body: JSON.stringify({
        identity: form.identity,
        name: form.name,
        handle: form.handle,
        bio: form.bio || undefined,
        category: form.category || undefined,
        avatarPath: form.avatarPath || undefined,
        captionSize: form.captionSize,
        captionTone: form.captionTone,
        captionEmojis: +form.captionEmojis,
        captionHashtags: +form.captionHashtags,
      }),
    });
    setSaving(false);
    if (!response.ok) {
      const { message } = await response.json().catch(() => ({}));
      toaster.show(
        Array.isArray(message) ? message.join(', ') : message || t('brand_save_failed', 'Could not save'),
        'warning'
      );
      return;
    }
    toaster.show(t('brand_saved', 'Brand saved'), 'success');
    mutate();
  }, [form]);

  const uploadAvatar = useCallback(async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      set('avatarPath')(await upload(file));
    } catch (e) {
      toaster.show(t('brand_upload_failed', 'Could not upload the picture'), 'warning');
    }
    setUploading(false);
  }, []);

  const uploadPhotos = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setUploading(true);
      for (const file of Array.from(files)) {
        try {
          const path = await upload(file);
          await fetch('/brand-kit/photos', {
            method: 'POST',
            body: JSON.stringify({ path, emotion }),
          });
        } catch (e) {
          toaster.show(`${file.name}: ${t('brand_upload_failed', 'Could not upload the picture')}`, 'warning');
        }
      }
      setUploading(false);
      mutate();
    },
    [emotion]
  );

  if (!kit || !form) {
    return <div className="h-[300px] rounded-[12px] bg-newSep animate-pulse" />;
  }

  return (
    <div className="flex flex-col gap-[24px] text-[14px] max-w-[1100px]">
      <div className="flex flex-col gap-[4px]">
        <div className="text-[24px] font-[600]">{t('brand_kit', 'My brand')}</div>
        <div className="opacity-70">
          {t(
            'brand_kit_description',
            'The visual identity, photos and voice used in your AI carousels.'
          )}
        </div>
      </div>

      <div className="flex flex-col gap-[8px]">
        <div className="font-[600]">{t('brand_identity', 'Visual identity')}</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[10px]">
          {IDENTITIES.map((identity) => (
            <div
              key={identity.value}
              onClick={() => set('identity')(identity.value)}
              className={clsx(
                'flex flex-col gap-[10px] p-[14px] rounded-[12px] border cursor-pointer',
                form.identity === identity.value
                  ? 'border-[#612BD3] bg-[#612BD3]/10'
                  : 'border-newBorder opacity-70'
              )}
            >
              <div className="flex gap-[6px]">
                {identity.colors.map((color) => (
                  <div
                    key={color}
                    className="w-[34px] h-[34px] rounded-full border border-newBorder"
                    style={{ background: color }}
                  />
                ))}
              </div>
              <div className="font-[600]">{identity.name}</div>
              <div className="text-[12px] opacity-70">{identity.fonts}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-[16px] items-start">
        <div className="flex flex-col items-center gap-[8px]">
          <div
            className="w-[110px] h-[110px] rounded-full border-[4px] border-newBorder bg-newBgColor bg-cover bg-center"
            style={form.avatarPath ? { backgroundImage: `url("${form.avatarPath}")` } : {}}
          />
          <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
          <span className="text-[12px] underline cursor-pointer" onClick={() => avatarInput.current?.click()}>
            {t('brand_avatar', 'Profile photo')}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
          <label className="flex flex-col gap-[6px]">
            {t('brand_name', 'Name on the slides')}
            <input className={inputClassName} value={form.name} onChange={(e) => set('name')(e.target.value)} />
          </label>
          <label className="flex flex-col gap-[6px]">
            {t('brand_handle', '@ to follow')}
            <input className={inputClassName} value={form.handle} placeholder="@seuperfil" onChange={(e) => set('handle')(e.target.value)} />
          </label>
          <label className="flex flex-col gap-[6px]">
            {t('brand_bio', 'Bio (closing slide)')}
            <input className={inputClassName} value={form.bio || ''} onChange={(e) => set('bio')(e.target.value)} />
          </label>
          <label className="flex flex-col gap-[6px]">
            {t('brand_category', 'Default category (top of the slides)')}
            <input className={inputClassName} value={form.category || ''} placeholder="IA no trabalho" onChange={(e) => set('category')(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-[8px]">
        <div className="font-[600]">{t('brand_caption', 'Caption standard')}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[12px]">
          <label className="flex flex-col gap-[6px]">
            {t('brand_caption_size', 'Size')}
            <select className={inputClassName} value={form.captionSize} onChange={(e) => set('captionSize')(e.target.value)}>
              <option value="curta">{t('brand_caption_short', 'Short')}</option>
              <option value="media">{t('brand_caption_medium', 'Medium')}</option>
              <option value="longa">{t('brand_caption_long', 'Long')}</option>
            </select>
          </label>
          <label className="flex flex-col gap-[6px]">
            {t('brand_caption_tone', 'Tone')}
            <input className={inputClassName} value={form.captionTone} onChange={(e) => set('captionTone')(e.target.value)} />
          </label>
          <label className="flex flex-col gap-[6px]">
            {t('brand_caption_emojis', 'Max. emojis')}
            <input type="number" min={0} max={5} className={inputClassName} value={form.captionEmojis} onChange={(e) => set('captionEmojis')(+e.target.value)} />
          </label>
          <label className="flex flex-col gap-[6px]">
            {t('brand_caption_hashtags', 'Hashtags')}
            <input type="number" min={0} max={10} className={inputClassName} value={form.captionHashtags} onChange={(e) => set('captionHashtags')(+e.target.value)} />
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <Button loading={saving} disabled={!form.name.trim() || !form.handle.trim()} onClick={save}>
          {t('brand_save', 'Save brand')}
        </Button>
      </div>

      <div className="flex flex-col gap-[10px]">
        <div className="flex flex-wrap justify-between items-end gap-[10px]">
          <div className="flex flex-col gap-[4px]">
            <div className="font-[600]">
              {t('brand_photos', 'Photos with expressions')} ({kit.photos.length})
            </div>
            <div className="text-[12px] opacity-70">
              {t(
                'brand_photos_description',
                'Upload 6 to 10 photos with different expressions. A PNG without background is placed as a cut-out, any other photo goes in a frame.'
              )}
            </div>
          </div>
          <div className="flex gap-[8px] items-center">
            <select className={clsx(inputClassName, '!w-[160px] capitalize')} value={emotion} onChange={(e) => setEmotionToAdd(e.target.value)}>
              {EMOTIONS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <input ref={photosInput} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => uploadPhotos(e.target.files)} />
            <Button loading={uploading} onClick={() => photosInput.current?.click()}>
              {t('brand_add_photos', 'Add photos')}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-[10px]">
          {kit.photos.map((photo) => (
            <PhotoCard key={photo.id} photo={photo} onChange={() => mutate()} />
          ))}
        </div>
      </div>
    </div>
  );
};
