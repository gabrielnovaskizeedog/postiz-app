'use client';

import React, { FC, useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import dayjs from 'dayjs';
import Link from 'next/link';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { getTimezone } from '@gitroom/frontend/components/layout/set.timezone';
import {
  formatCost,
  fromLocalInput,
  inputClassName,
  toLocalInput,
  useIntegrationsList,
} from '@gitroom/frontend/components/ai-campaigns/ai.campaigns.component';
import { useBrandKit } from '@gitroom/frontend/components/brand-kit/brand.kit.component';

interface Carousel {
  id: string;
  source: 'link' | 'trend';
  sourceUrl: string | null;
  theme: string | null;
  slidesCount: number;
  integrations: string;
  publishDate: string;
  aiModel: 'premium' | 'economy';
  status:
    | 'researching'
    | 'choosing_hook'
    | 'generating'
    | 'pending'
    | 'approving'
    | 'approved'
    | 'rejected'
    | 'failed';
  research: string | null;
  sources: string | null;
  hooks: string | null;
  hook: string | null;
  images: string | null;
  caption: string | null;
  cost: number;
  error: string | null;
  createdAt: string;
}

const WORKING = ['researching', 'generating', 'approving'];

// Measured on real carousels (USD): the research always uses the premium
// model because checking the original source needs it
const ESTIMATE = { premium: 0.13, economy: 0.09 };

const useAiCarousels = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await fetch('/ai-carousels')).json();
  }, []);

  return useSWR<Carousel[]>('ai-carousels', load, {
    revalidateOnFocus: false,
    refreshInterval: (data) =>
      data?.some((c) => WORKING.includes(c.status)) ? 4000 : 0,
  });
};

const parse = <T,>(value: string | null, fallback: T): T => {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch (e) {
    return fallback;
  }
};

const NewCarousel: FC<{ onCreated: () => void; onCancel: () => void }> = ({
  onCreated,
  onCancel,
}) => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { data: integrations } = useIntegrationsList();
  const { data: kit } = useBrandKit();
  const [source, setSource] = useState<'link' | 'trend'>('link');
  const [url, setUrl] = useState('');
  const [theme, setTheme] = useState('');
  const [slides, setSlides] = useState(6);
  const [audience, setAudience] = useState('LinkedIn e Instagram');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [publishDate, setPublishDate] = useState(
    toLocalInput(dayjs().add(1, 'day').hour(10).minute(0).toDate())
  );
  const [aiModel, setAiModel] = useState<'premium' | 'economy'>('premium');
  const [loading, setLoading] = useState(false);

  const active = useMemo(
    () => (integrations || []).filter((p) => !p.disabled && !p.inBetweenSteps),
    [integrations]
  );

  const submit = useCallback(async () => {
    setLoading(true);
    const response = await fetch('/ai-carousels', {
      method: 'POST',
      body: JSON.stringify({
        source,
        ...(source === 'link' ? { url: url.trim() } : { theme: theme.trim() }),
        slides,
        audience: audience || undefined,
        category: category || kit?.category || undefined,
        language: 'Português do Brasil',
        integrations: selected,
        publishDate: fromLocalInput(publishDate),
        aiModel,
      }),
    });
    setLoading(false);
    if (!response.ok) {
      const { message } = await response.json().catch(() => ({}));
      toaster.show(
        Array.isArray(message)
          ? message.join(', ')
          : message || t('carousel_create_failed', 'Could not create the carousel'),
        'warning'
      );
      return;
    }
    toaster.show(
      t('carousel_created', 'The AI is reading the source, you will pick the cover hook next'),
      'success'
    );
    onCreated();
  }, [source, url, theme, slides, audience, category, selected, publishDate, aiModel, kit]);

  const canSubmit =
    (source === 'link' ? /^https?:\/\/\S+$/.test(url.trim()) : theme.trim().length > 2) &&
    selected.length > 0;

  return (
    <div className="flex flex-col gap-[16px] text-[14px]">
      {!kit?.handle && (
        <div className="p-[12px] rounded-[8px] border border-[#E3A512] bg-[#E3A512]/10">
          {t('carousel_brand_missing', 'Set up your brand first (name, @, photos):')}{' '}
          <Link href="/marca" className="underline">{t('brand_kit', 'My brand')}</Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-[8px]">
        {(['link', 'trend'] as const).map((value) => (
          <div
            key={value}
            onClick={() => setSource(value)}
            className={clsx(
              'flex flex-col gap-[2px] px-[12px] py-[10px] rounded-[8px] border cursor-pointer',
              source === value ? 'border-[#612BD3] bg-[#612BD3]/10' : 'border-newBorder opacity-60'
            )}
          >
            <div className="font-[600]">
              {value === 'link' ? t('carousel_from_link', 'From a link') : t('carousel_from_trend', 'Trending topic')}
            </div>
            <div className="text-[12px] opacity-80">
              {value === 'link'
                ? t('carousel_from_link_description', 'Paste an article, the AI checks the original source')
                : t('carousel_from_trend_description', 'The AI finds the strongest story of the moment')}
            </div>
          </div>
        ))}
      </div>

      {source === 'link' ? (
        <input className={inputClassName} value={url} placeholder="https://..." onChange={(e) => setUrl(e.target.value)} />
      ) : (
        <input className={inputClassName} value={theme} placeholder={t('carousel_theme_placeholder', 'Theme, e.g. AI in small businesses')} onChange={(e) => setTheme(e.target.value)} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-[12px]">
        <label className="flex flex-col gap-[6px]">
          {t('carousel_slides', 'Slides')}
          <input type="number" min={4} max={10} className={inputClassName} value={slides} onChange={(e) => setSlides(+e.target.value)} />
        </label>
        <label className="flex flex-col gap-[6px]">
          {t('carousel_audience', 'Audience')}
          <input className={inputClassName} value={audience} onChange={(e) => setAudience(e.target.value)} />
        </label>
        <label className="flex flex-col gap-[6px]">
          {t('carousel_category', 'Category (top of the slides)')}
          <input className={inputClassName} value={category} placeholder={kit?.category || ''} onChange={(e) => setCategory(e.target.value)} />
        </label>
      </div>

      <div className="flex flex-col gap-[6px]">
        <div>{t('carousel_channels', 'Publish on')}</div>
        <div className="flex flex-wrap gap-[8px]">
          {active.map((integration) => (
            <div
              key={integration.id}
              onClick={() =>
                setSelected((current) =>
                  current.includes(integration.id)
                    ? current.filter((p) => p !== integration.id)
                    : [...current, integration.id]
                )
              }
              className={clsx(
                'flex items-center gap-[8px] px-[10px] py-[6px] rounded-[8px] border cursor-pointer',
                selected.includes(integration.id) ? 'border-[#612BD3] bg-[#612BD3]/10' : 'border-newBorder opacity-60'
              )}
            >
              <div className="relative">
                <img src={integration.picture} className="w-[24px] h-[24px] rounded-full" alt={integration.name} />
                <img src={`/icons/platforms/${integration.identifier}.png`} className="w-[12px] h-[12px] rounded-full absolute -bottom-[2px] -end-[2px]" alt="" />
              </div>
              {integration.name}
            </div>
          ))}
        </div>
        <div className="text-[12px] opacity-60">
          {t('carousel_channels_note', 'Instagram gets a swipeable carousel, LinkedIn a swipeable document (PDF).')}
        </div>
      </div>

      <label className="flex flex-col gap-[6px]">
        {t('ai_campaign_publish_date', 'Publish date')}
        <input type="datetime-local" className={inputClassName} value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
      </label>

      <div className="flex flex-col gap-[6px]">
        <div>{t('ai_campaign_ai_model', 'AI model')}</div>
        <div className="grid grid-cols-2 gap-[8px]">
          {(['premium', 'economy'] as const).map((model) => (
            <div
              key={model}
              onClick={() => setAiModel(model)}
              className={clsx(
                'flex flex-col gap-[2px] px-[12px] py-[10px] rounded-[8px] border cursor-pointer',
                aiModel === model ? 'border-[#612BD3] bg-[#612BD3]/10' : 'border-newBorder opacity-60'
              )}
            >
              <div className="font-[600]">
                {model === 'premium' ? t('ai_campaign_model_premium', 'Premium (current)') : t('ai_campaign_model_economy', 'Economy')}
              </div>
              <div className="text-[12px] opacity-80">
                {model === 'premium' ? 'GPT-4.1' : 'GPT-4.1 mini'} · ≈ {formatCost(ESTIMATE[model])}{' '}
                {t('carousel_per_carousel', 'per carousel')}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-[8px] justify-end">
        <Button secondary onClick={onCancel}>{t('cancel', 'Cancel')}</Button>
        <Button disabled={!canSubmit} loading={loading} onClick={submit}>
          {t('carousel_generate', 'Read and suggest hooks')}
        </Button>
      </div>
    </div>
  );
};

const CarouselCard: FC<{ carousel: Carousel; onChange: () => void }> = ({ carousel, onChange }) => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const [caption, setCaption] = useState(carousel.caption || '');
  const [publishDate, setPublishDate] = useState(toLocalInput(carousel.publishDate));
  const [instruction, setInstruction] = useState('');
  const [customHook, setCustomHook] = useState('');
  const [showResearch, setShowResearch] = useState(false);
  const [loading, setLoading] = useState('');

  const images = parse<Array<{ path: string }>>(carousel.images, []);
  const hooks = parse<string[]>(carousel.hooks, []);
  const sources = parse<string[]>(carousel.sources, []);

  const call = useCallback(
    async (action: string, path: string, init?: RequestInit) => {
      setLoading(action);
      const response = await fetch(path, { method: 'POST', ...init });
      setLoading('');
      if (!response.ok) {
        const { message } = await response.json().catch(() => ({}));
        toaster.show(message || t('ai_campaign_action_failed', 'Something went wrong'), 'warning');
        return false;
      }
      onChange();
      return true;
    },
    [onChange]
  );

  const chooseHook = (hook: string) =>
    call('hook', `/ai-carousels/${carousel.id}/hook`, { body: JSON.stringify({ hook }) });

  const approve = useCallback(async () => {
    const changed = caption !== (carousel.caption || '') || publishDate !== toLocalInput(carousel.publishDate);
    if (changed) {
      const ok = await call('save', `/ai-carousels/${carousel.id}`, {
        method: 'PUT',
        body: JSON.stringify({ caption, publishDate: fromLocalInput(publishDate) }),
      });
      if (!ok) return;
    }
    if (await call('approve', `/ai-carousels/${carousel.id}/approve`)) {
      toaster.show(t('carousel_approved', 'Carousel approved and scheduled'), 'success');
    }
  }, [caption, publishDate, carousel]);

  const remove = useCallback(async () => {
    if (await deleteDialog(t('carousel_delete_confirm', 'Delete this carousel? A scheduled post stays in the calendar.'))) {
      await fetch(`/ai-carousels/${carousel.id}`, { method: 'DELETE' });
      onChange();
    }
  }, [carousel.id]);

  const status = {
    researching: t('carousel_status_researching', 'Reading the source and checking the numbers...'),
    choosing_hook: t('carousel_status_hook', 'Pick the cover hook'),
    generating: t('carousel_status_generating', 'Building the slides...'),
    pending: t('carousel_status_pending', 'Waiting for approval'),
    approving: t('carousel_status_approving', 'Scheduling...'),
    approved: t('carousel_status_approved', 'Approved and scheduled'),
    rejected: t('ai_campaign_status_rejected', 'Discarded'),
    failed: t('ai_campaign_status_failed', 'Failed'),
  }[carousel.status];

  return (
    <div className={clsx('flex flex-col gap-[14px] p-[18px] rounded-[12px] border border-newBorder', carousel.status === 'rejected' && 'opacity-50')}>
      <div className="flex justify-between items-start gap-[12px]">
        <div className="flex flex-col gap-[4px] min-w-0">
          <div className="text-[17px] font-[600] break-words">
            {carousel.hook || carousel.theme || carousel.sourceUrl}
          </div>
          <div className="text-[12px] opacity-70 flex flex-wrap gap-[6px]">
            <span className={clsx(WORKING.includes(carousel.status) && 'animate-pulse', carousel.status === 'failed' && 'text-red-500', carousel.status === 'approved' && 'text-green-500')}>
              {status}
            </span>
            <span>·</span>
            <span>{carousel.slidesCount} slides</span>
            <span>·</span>
            <span>{carousel.aiModel === 'economy' ? t('ai_campaign_model_economy', 'Economy') : 'Premium'}</span>
            {carousel.cost > 0 && (
              <>
                <span>·</span>
                <span>{t('ai_campaign_real_cost', 'AI cost')}: {formatCost(carousel.cost)}</span>
              </>
            )}
          </div>
        </div>
        <Button secondary className="text-[12px] shrink-0" onClick={remove}>{t('delete', 'Delete')}</Button>
      </div>

      {carousel.error && <div className="text-[13px] text-red-500">{carousel.error}</div>}

      {WORKING.includes(carousel.status) && (
        <div className="flex gap-[8px] overflow-hidden">
          {Array.from({ length: Math.min(carousel.slidesCount, 4) }).map((_, i) => (
            <div key={i} className="w-[180px] aspect-[4/5] shrink-0 rounded-[8px] bg-newSep animate-pulse" />
          ))}
        </div>
      )}

      {(carousel.status === 'choosing_hook' || (carousel.status === 'failed' && hooks.length > 0 && !images.length)) && (
        <div className="flex flex-col gap-[8px]">
          <div className="text-[13px] opacity-80">
            {t('carousel_pick_hook', 'Pick the hook that would make you stop scrolling (from the safest to the boldest):')}
          </div>
          {hooks.map((hook, index) => (
            <div
              key={hook}
              onClick={() => !loading && chooseHook(hook)}
              className="px-[14px] py-[10px] rounded-[8px] border border-newBorder cursor-pointer hover:border-[#612BD3] hover:bg-[#612BD3]/10"
            >
              <span className="opacity-50 me-[8px]">{index + 1}.</span>
              {hook}
            </div>
          ))}
          <div className="flex gap-[8px]">
            <input className={inputClassName} value={customHook} placeholder={t('carousel_custom_hook', 'Or write your own hook')} onChange={(e) => setCustomHook(e.target.value)} />
            <Button disabled={!customHook.trim()} loading={loading === 'hook'} onClick={() => chooseHook(customHook.trim())}>
              {t('carousel_use_hook', 'Use')}
            </Button>
          </div>
        </div>
      )}

      {images.length > 0 && (
        <div className="flex gap-[10px] overflow-x-auto snap-x snap-mandatory pb-[6px]">
          {images.map((image, index) => (
            <a key={image.path} href={image.path} target="_blank" rel="noreferrer" className="shrink-0 snap-start">
              <img src={image.path} alt={`slide ${index + 1}`} className="w-[240px] aspect-[4/5] rounded-[8px] border border-newBorder object-cover" />
            </a>
          ))}
        </div>
      )}

      {(carousel.status === 'pending' || (carousel.status === 'failed' && images.length > 0)) && (
        <div className="flex flex-col gap-[10px]">
          <label className="flex flex-col gap-[6px] text-[13px]">
            {t('carousel_caption', 'Caption')}
            <textarea className={clsx(inputClassName, 'h-[220px] py-[10px] resize-y')} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </label>
          <label className="flex flex-col gap-[6px] text-[13px]">
            {t('ai_campaign_publish_date', 'Publish date')}
            <input type="datetime-local" className={inputClassName} value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
          </label>
          <div className="flex gap-[8px]">
            <input className={inputClassName} value={instruction} placeholder={t('carousel_revise_placeholder', 'Ask for a change, e.g. "cut slide 3 in half"')} onChange={(e) => setInstruction(e.target.value)} />
            <Button secondary disabled={!instruction.trim()} loading={loading === 'revise'} onClick={async () => {
              if (await call('revise', `/ai-carousels/${carousel.id}/revise`, { body: JSON.stringify({ instruction }) })) setInstruction('');
            }}>
              {t('carousel_revise', 'Adjust')}
            </Button>
          </div>
          <div className="flex gap-[8px] justify-end">
            <Button secondary loading={loading === 'reject'} onClick={() => call('reject', `/ai-carousels/${carousel.id}/reject`)}>
              {t('ai_campaign_discard', 'Discard')}
            </Button>
            <Button loading={loading === 'approve' || loading === 'save'} disabled={!caption.trim()} onClick={approve}>
              {t('ai_campaign_approve', 'Approve and schedule')}
            </Button>
          </div>
        </div>
      )}

      {carousel.status === 'approved' && (
        <div className="text-[13px] opacity-80">
          {t('carousel_scheduled_for', 'Scheduled for')}{' '}
          {dayjs.utc(carousel.publishDate).tz(getTimezone()).format('DD/MM/YYYY HH:mm')}
        </div>
      )}

      {(sources.length > 0 || carousel.research) && (
        <div className="flex flex-col gap-[4px] text-[12px]">
          {sources.length > 0 && (
            <div className="flex flex-col gap-[2px] opacity-70">
              <div>{t('ai_campaign_sources', 'Sources')}</div>
              {sources.map((source) => (
                <a key={source} href={source} target="_blank" rel="noreferrer" className="underline truncate">{source}</a>
              ))}
            </div>
          )}
          {carousel.research && (
            <div>
              <span className="underline cursor-pointer opacity-70" onClick={() => setShowResearch(!showResearch)}>
                {showResearch ? t('carousel_hide_research', 'Hide the research') : t('carousel_show_research', 'Check the research (facts, divergences, limitations)')}
              </span>
              {showResearch && (
                <pre className="whitespace-pre-wrap mt-[6px] p-[10px] rounded-[8px] bg-newBgColor border border-newBorder font-[inherit]">
                  {carousel.research}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const AiCarouselsComponent: FC = () => {
  const t = useT();
  const modals = useModals();
  const { data: carousels, isLoading, mutate } = useAiCarousels();

  const newCarousel = useCallback(() => {
    modals.openModal({
      title: t('carousel_new', 'New AI carousel'),
      closeOnClickOutside: false,
      classNames: { modal: 'w-[100%] max-w-[760px] text-textColor' },
      children: (close) => (
        <NewCarousel onCancel={close} onCreated={() => { close(); mutate(); }} />
      ),
    });
  }, [mutate]);

  return (
    <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[20px] transition-all">
      <div className="flex justify-between items-center gap-[12px] flex-wrap">
        <div className="flex flex-col gap-[4px]">
          <div className="text-[24px] font-[600]">{t('ai_carousels', 'AI Carousels')}</div>
          <div className="text-[14px] opacity-70">
            {t('ai_carousels_description', 'From a link or a trending topic: the AI checks the original source, suggests 5 hooks, builds the slides in your brand and writes the caption. Nothing is published before you approve it.')}
          </div>
        </div>
        <div className="flex gap-[8px]">
          <Link href="/marca" className="px-[16px] h-[40px] flex items-center bg-third">{t('brand_kit', 'My brand')}</Link>
          <button onClick={newCarousel} className="px-[24px] h-[40px] bg-forth text-white">{t('carousel_new', 'New AI carousel')}</button>
        </div>
      </div>

      {!isLoading && !carousels?.length && (
        <div className="text-center opacity-70 py-[80px]">{t('carousels_empty', 'You have no AI carousels yet')}</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-[16px]">
        {carousels?.map((carousel) => (
          <CarouselCard
            key={`${carousel.id}-${carousel.status}-${carousel.images?.length}-${carousel.caption?.length}`}
            carousel={carousel}
            onChange={() => mutate()}
          />
        ))}
      </div>
    </div>
  );
};
