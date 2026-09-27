'use client';

import React, { FC, useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { getTimezone } from '@gitroom/frontend/components/layout/set.timezone';

interface IntegrationItem {
  id: string;
  name: string;
  picture: string;
  identifier: string;
  disabled: boolean;
  inBetweenSteps: boolean;
}

interface CampaignPost {
  id: string;
  theme: string;
  trend?: string;
  sources?: string;
  content?: string;
  imagePath?: string;
  imagePrompt?: string;
  publishDate: string;
  status: 'generating' | 'pending' | 'approved' | 'rejected' | 'failed';
  error?: string;
  cost: number;
}

interface Campaign {
  id: string;
  themes: string;
  quantity: number;
  integrations: string;
  language: string;
  instagramFormat: 'post' | 'story';
  aiModel: AiModel;
  status: string;
  createdAt: string;
  posts: CampaignPost[];
}

const INSTAGRAM_PROVIDERS = ['instagram', 'instagram-standalone'];

type AiModel = 'premium' | 'economy';

// Estimates measured on real campaigns (USD per post): web search + writing,
// and one picture (square feed post or vertical story)
const AI_MODELS: Record<
  AiModel,
  { text: string; image: string; textCost: number; post: number; story: number }
> = {
  premium: {
    text: 'GPT-4.1',
    image: 'ChatGPT Image (high)',
    textCost: 0.04,
    post: 0.15,
    story: 0.2,
  },
  economy: {
    text: 'GPT-4.1 mini',
    image: 'GPT Image 1 mini (medium)',
    textCost: 0.016,
    post: 0.0095,
    story: 0.0125,
  },
};

const formatCost = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 0.1 ? 3 : 2,
  });

const estimatePostCost = (
  model: AiModel,
  generateImages: boolean,
  isStory: boolean
) =>
  AI_MODELS[model].textCost +
  (generateImages ? AI_MODELS[model][isStory ? 'story' : 'post'] : 0);

const inputClassName =
  'w-full h-[44px] px-[14px] rounded-[8px] bg-newBgColorInner border border-newColColor text-[14px] outline-none focus:border-[#612BD3]';

const toLocalInput = (date: string | Date) =>
  dayjs.utc(date).tz(getTimezone()).format('YYYY-MM-DDTHH:mm');

const fromLocalInput = (value: string) =>
  dayjs.tz(value, getTimezone()).utc().format();

const useIntegrationsList = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await (await fetch('/integrations/list')).json()).integrations;
  }, []);

  return useSWR<IntegrationItem[]>('/integrations/list', load, {
    revalidateOnFocus: false,
    fallbackData: [],
  });
};

const useAiCampaigns = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await fetch('/ai-campaigns')).json();
  }, []);

  // Keeps polling while the AI is still writing posts or drawing images
  return useSWR<Campaign[]>('ai-campaigns', load, {
    revalidateOnFocus: false,
    refreshInterval: (data) =>
      data?.some(
        (c) =>
          c.status === 'generating' ||
          c.posts.some((p) => p.status === 'generating')
      )
        ? 5000
        : 0,
  });
};

const NewCampaign: FC<{ onCreated: () => void; onCancel: () => void }> = ({
  onCreated,
  onCancel,
}) => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { data: integrations } = useIntegrationsList();
  const [themeInput, setThemeInput] = useState('');
  const [themes, setThemes] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(5);
  const [selected, setSelected] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(
    toLocalInput(dayjs().add(1, 'day').hour(10).minute(0).toDate())
  );
  const [intervalDays, setIntervalDays] = useState(1);
  const [language, setLanguage] = useState('Português do Brasil');
  const [tone, setTone] = useState('');
  const [instructions, setInstructions] = useState('');
  const [generateImages, setGenerateImages] = useState(true);
  const [instagramFormat, setInstagramFormat] = useState<'post' | 'story'>(
    'post'
  );
  const [aiModel, setAiModel] = useState<AiModel>('premium');
  const [loading, setLoading] = useState(false);

  const activeIntegrations = useMemo(
    () => (integrations || []).filter((p) => !p.disabled && !p.inBetweenSteps),
    [integrations]
  );

  const hasInstagram = useMemo(
    () =>
      activeIntegrations.some(
        (p) =>
          selected.includes(p.id) && INSTAGRAM_PROVIDERS.includes(p.identifier)
      ),
    [activeIntegrations, selected]
  );
  const isStory = hasInstagram && instagramFormat === 'story';

  const addTheme = useCallback(() => {
    const value = themeInput.trim();
    if (value && !themes.includes(value) && themes.length < 10) {
      setThemes([...themes, value]);
    }
    setThemeInput('');
  }, [themeInput, themes]);

  const toggleIntegration = useCallback(
    (id: string) => () => {
      setSelected((current) =>
        current.includes(id)
          ? current.filter((p) => p !== id)
          : [...current, id]
      );
    },
    []
  );

  const submit = useCallback(async () => {
    setLoading(true);
    const response = await fetch('/ai-campaigns', {
      method: 'POST',
      body: JSON.stringify({
        themes,
        quantity,
        integrations: selected,
        startDate: fromLocalInput(startDate),
        intervalDays,
        language,
        tone: tone || undefined,
        instructions: instructions || undefined,
        generateImages: isStory || generateImages,
        instagramFormat: hasInstagram ? instagramFormat : 'post',
        aiModel,
      }),
    });
    setLoading(false);

    if (!response.ok) {
      const { message } = await response.json().catch(() => ({}));
      toaster.show(
        Array.isArray(message)
          ? message.join(', ')
          : message ||
              t('ai_campaign_create_failed', 'Could not create the campaign'),
        'warning'
      );
      return;
    }

    toaster.show(
      t(
        'ai_campaign_created',
        'Campaign created, the AI is researching the trends and writing your posts'
      ),
      'success'
    );
    onCreated();
  }, [
    themes,
    quantity,
    selected,
    startDate,
    intervalDays,
    language,
    tone,
    instructions,
    generateImages,
    isStory,
    hasInstagram,
    instagramFormat,
    aiModel,
  ]);

  const canSubmit =
    themes.length > 0 && selected.length > 0 && quantity > 0 && !!startDate;

  return (
    <div className="flex flex-col gap-[16px] text-[14px]">
      <div className="flex flex-col gap-[6px]">
        <div>{t('ai_campaign_themes', 'Themes')}</div>
        <div className="flex gap-[8px]">
          <input
            className={inputClassName}
            value={themeInput}
            placeholder={t(
              'ai_campaign_themes_placeholder',
              'Type a theme and press Enter, e.g. Artificial intelligence'
            )}
            onChange={(e) => setThemeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTheme();
              }
            }}
          />
          <Button secondary onClick={addTheme}>
            {t('add', 'Add')}
          </Button>
        </div>
        <div className="flex flex-wrap gap-[8px]">
          {themes.map((theme) => (
            <div
              key={theme}
              className="flex items-center gap-[6px] px-[10px] py-[4px] rounded-[6px] bg-newBgColor border border-newBorder"
            >
              {theme}
              <span
                className="cursor-pointer opacity-60 hover:opacity-100"
                onClick={() => setThemes(themes.filter((p) => p !== theme))}
              >
                ✕
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-[6px]">
        <div>{t('ai_campaign_channels', 'Channels')}</div>
        {!activeIntegrations.length && (
          <div className="opacity-60">
            {t(
              'ai_campaign_no_channels',
              'Connect a channel in the calendar first'
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-[8px]">
          {activeIntegrations.map((integration) => (
            <div
              key={integration.id}
              onClick={toggleIntegration(integration.id)}
              className={clsx(
                'flex items-center gap-[8px] px-[10px] py-[6px] rounded-[8px] border cursor-pointer',
                selected.includes(integration.id)
                  ? 'border-[#612BD3] bg-[#612BD3]/10'
                  : 'border-newBorder opacity-60'
              )}
            >
              <div className="relative">
                <img
                  src={integration.picture}
                  className="w-[24px] h-[24px] rounded-full"
                  alt={integration.name}
                />
                <img
                  src={`/icons/platforms/${integration.identifier}.png`}
                  className="w-[12px] h-[12px] rounded-full absolute -bottom-[2px] -end-[2px]"
                  alt={integration.identifier}
                />
              </div>
              {integration.name}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-[12px]">
        <div className="flex flex-col gap-[6px]">
          <div>{t('ai_campaign_quantity', 'Number of posts')}</div>
          <input
            type="number"
            min={1}
            max={30}
            className={inputClassName}
            value={quantity}
            onChange={(e) => setQuantity(+e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-[6px]">
          <div>{t('ai_campaign_start', 'First post')}</div>
          <input
            type="datetime-local"
            className={inputClassName}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-[6px]">
          <div>{t('ai_campaign_interval', 'Days between posts')}</div>
          <input
            type="number"
            min={1}
            max={30}
            className={inputClassName}
            value={intervalDays}
            onChange={(e) => setIntervalDays(+e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
        <div className="flex flex-col gap-[6px]">
          <div>{t('ai_campaign_language', 'Language')}</div>
          <input
            className={inputClassName}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-[6px]">
          <div>{t('ai_campaign_tone', 'Tone of voice (optional)')}</div>
          <input
            className={inputClassName}
            value={tone}
            placeholder={t(
              'ai_campaign_tone_placeholder',
              'e.g. professional and inspiring'
            )}
            onChange={(e) => setTone(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-[6px]">
        <div>
          {t('ai_campaign_instructions', 'Extra instructions (optional)')}
        </div>
        <textarea
          className={clsx(inputClassName, 'h-[80px] py-[10px] resize-none')}
          value={instructions}
          placeholder={t(
            'ai_campaign_instructions_placeholder',
            'e.g. mention that we are a consulting company, end with a question'
          )}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>

      {hasInstagram && (
        <div className="flex flex-col gap-[6px]">
          <div>{t('ai_campaign_instagram_format', 'Instagram format')}</div>
          <div className="grid grid-cols-2 gap-[8px]">
            {(['post', 'story'] as const).map((format) => (
              <div
                key={format}
                onClick={() => setInstagramFormat(format)}
                className={clsx(
                  'flex flex-col gap-[2px] px-[12px] py-[10px] rounded-[8px] border cursor-pointer',
                  instagramFormat === format
                    ? 'border-[#612BD3] bg-[#612BD3]/10'
                    : 'border-newBorder opacity-60'
                )}
              >
                <div className="font-[600]">
                  {format === 'post'
                    ? t('ai_campaign_format_post', 'Feed post')
                    : t('ai_campaign_format_story', 'Story')}
                </div>
                <div className="text-[12px] opacity-80">
                  {format === 'post'
                    ? t(
                        'ai_campaign_format_post_description',
                        'Square photo, the text goes in the caption'
                      )
                    : t(
                        'ai_campaign_format_story_description',
                        'Vertical photo with the hook written on it, stories have no caption'
                      )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <label
        className={clsx(
          'flex items-center gap-[8px]',
          isStory ? 'opacity-60' : 'cursor-pointer'
        )}
      >
        <input
          type="checkbox"
          disabled={isStory}
          checked={isStory || generateImages}
          onChange={(e) => setGenerateImages(e.target.checked)}
        />
        {t('ai_campaign_generate_images', 'Generate an AI image for every post')}
        {isStory && (
          <span className="text-[12px]">
            ({t('ai_campaign_story_needs_image', 'required for stories')})
          </span>
        )}
      </label>

      <div className="flex flex-col gap-[6px]">
        <div>{t('ai_campaign_ai_model', 'AI model')}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[8px]">
          {(['premium', 'economy'] as const).map((model) => {
            const perPost = estimatePostCost(
              model,
              isStory || generateImages,
              isStory
            );
            return (
              <div
                key={model}
                onClick={() => setAiModel(model)}
                className={clsx(
                  'flex flex-col gap-[4px] px-[12px] py-[10px] rounded-[8px] border cursor-pointer',
                  aiModel === model
                    ? 'border-[#612BD3] bg-[#612BD3]/10'
                    : 'border-newBorder opacity-60'
                )}
              >
                <div className="font-[600]">
                  {model === 'premium'
                    ? t('ai_campaign_model_premium', 'Premium (current)')
                    : t('ai_campaign_model_economy', 'Economy')}
                </div>
                <div className="text-[12px] opacity-80">
                  {t('ai_campaign_model_text', 'Text')}:{' '}
                  {AI_MODELS[model].text} ·{' '}
                  {t('ai_campaign_model_image', 'Image')}:{' '}
                  {AI_MODELS[model].image}
                </div>
                <div className="text-[13px]">
                  ≈ {formatCost(perPost)}{' '}
                  {t('ai_campaign_per_post', 'per post')} ·{' '}
                  <span className="font-[600]">
                    ≈ {formatCost(perPost * Math.max(quantity || 0, 0))}{' '}
                    {t('ai_campaign_for_campaign', 'for this campaign')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-[12px] opacity-60">
          {t(
            'ai_campaign_cost_note',
            'Estimates in US dollars charged by OpenAI. The real cost of every post is shown after it is generated.'
          )}
        </div>
      </div>

      <div className="flex gap-[8px] justify-end">
        <Button secondary onClick={onCancel}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button disabled={!canSubmit} loading={loading} onClick={submit}>
          {t('ai_campaign_generate', 'Generate posts')}
        </Button>
      </div>
    </div>
  );
};

const PostCard: FC<{
  post: CampaignPost;
  isStory: boolean;
  onChange: () => void;
}> = ({ post, isStory, onChange }) => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const [content, setContent] = useState(post.content || '');
  const [publishDate, setPublishDate] = useState(
    toLocalInput(post.publishDate)
  );
  const [loading, setLoading] = useState('');

  const editable = post.status === 'pending' || post.status === 'failed';
  const sources: string[] = useMemo(() => {
    try {
      return JSON.parse(post.sources || '[]');
    } catch (e) {
      return [];
    }
  }, [post.sources]);

  const call = useCallback(
    (action: string, path: string, init?: RequestInit) => async () => {
      setLoading(action);
      const response = await fetch(path, { method: 'POST', ...init });
      setLoading('');
      if (!response.ok) {
        const { message } = await response.json().catch(() => ({}));
        toaster.show(
          message || t('ai_campaign_action_failed', 'Something went wrong'),
          'warning'
        );
        return false;
      }
      onChange();
      return true;
    },
    [onChange]
  );

  const save = useCallback(async () => {
    const changed =
      content !== (post.content || '') ||
      publishDate !== toLocalInput(post.publishDate);
    if (!changed) {
      return true;
    }
    return call('save', `/ai-campaigns/posts/${post.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        content,
        publishDate: fromLocalInput(publishDate),
      }),
    })();
  }, [content, publishDate, post]);

  const approve = useCallback(async () => {
    if (!(await save())) {
      return;
    }
    if (await call('approve', `/ai-campaigns/posts/${post.id}/approve`)()) {
      toaster.show(
        t('ai_campaign_approved', 'Post approved and scheduled'),
        'success'
      );
    }
  }, [save, post.id]);

  const reject = useCallback(async () => {
    if (
      await deleteDialog(
        t('ai_campaign_reject_confirm', 'Discard this post?'),
        t('ai_campaign_discard', 'Discard')
      )
    ) {
      await call('reject', `/ai-campaigns/posts/${post.id}/reject`)();
    }
  }, [post.id]);

  const statusLabel = {
    generating: t('ai_campaign_status_generating', 'Generating...'),
    pending: t('ai_campaign_status_pending', 'Waiting for approval'),
    approved: t('ai_campaign_status_approved', 'Approved and scheduled'),
    rejected: t('ai_campaign_status_rejected', 'Discarded'),
    failed: t('ai_campaign_status_failed', 'Failed'),
  }[post.status];

  return (
    <div
      className={clsx(
        'flex flex-col gap-[10px] p-[14px] rounded-[12px] border border-newBorder bg-newBgColor text-[14px]',
        post.status === 'rejected' && 'opacity-50'
      )}
    >
      <div className="flex justify-between items-center gap-[8px]">
        <div className="flex items-center gap-[6px] min-w-0">
          <div className="text-[12px] px-[8px] py-[2px] rounded-[6px] bg-newBgColorInner border border-newBorder truncate">
            {post.theme}
          </div>
          {isStory && (
            <div className="text-[12px] px-[8px] py-[2px] rounded-[6px] bg-[#612BD3] text-white whitespace-nowrap">
              {t('ai_campaign_format_story', 'Story')}
            </div>
          )}
        </div>
        <div
          className={clsx(
            'text-[12px] whitespace-nowrap',
            post.status === 'approved' && 'text-green-500',
            post.status === 'failed' && 'text-red-500',
            post.status === 'generating' && 'animate-pulse'
          )}
        >
          {statusLabel}
        </div>
      </div>

      {post.status === 'generating' ? (
        <div className="flex flex-col gap-[8px]">
          <div
            className={clsx(
              'w-full bg-newSep rounded-[8px] animate-pulse',
              isStory ? 'aspect-[2/3]' : 'aspect-square'
            )}
          />
          <div className="h-[80px] bg-newSep rounded-[8px] animate-pulse" />
        </div>
      ) : (
        <>
          {post.imagePath && (
            <img
              src={post.imagePath}
              className={clsx(
                'w-full object-cover rounded-[8px]',
                isStory ? 'aspect-[2/3]' : 'aspect-square'
              )}
              alt={post.trend || post.theme}
            />
          )}
          {post.trend && <div className="font-[600]">{post.trend}</div>}
          {editable ? (
            <textarea
              className={clsx(
                inputClassName,
                'h-[220px] py-[10px] resize-y whitespace-pre-wrap'
              )}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          ) : (
            <div className="whitespace-pre-wrap">{post.content}</div>
          )}
          {!!sources.length && (
            <div className="flex flex-col gap-[2px] text-[12px] opacity-70">
              <div>{t('ai_campaign_sources', 'Sources')}</div>
              {sources.map((source) => (
                <a
                  key={source}
                  href={source}
                  target="_blank"
                  rel="noreferrer"
                  className="underline truncate"
                >
                  {source}
                </a>
              ))}
            </div>
          )}
          {post.error && (
            <div className="text-[12px] text-red-500">{post.error}</div>
          )}
          {post.cost > 0 && (
            <div className="text-[12px] opacity-60">
              {t('ai_campaign_real_cost', 'AI cost')}: {formatCost(post.cost)}
            </div>
          )}
          <div className="flex flex-col gap-[4px]">
            <div className="text-[12px] opacity-70">
              {t('ai_campaign_publish_date', 'Publish date')}
            </div>
            {editable ? (
              <input
                type="datetime-local"
                className={inputClassName}
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
              />
            ) : (
              <div>
                {dayjs
                  .utc(post.publishDate)
                  .tz(getTimezone())
                  .format('DD/MM/YYYY HH:mm')}
              </div>
            )}
          </div>
        </>
      )}

      {editable && (
        <div className="flex flex-col gap-[8px]">
          <Button
            loading={loading === 'approve' || loading === 'save'}
            disabled={!content.trim()}
            onClick={approve}
          >
            {t('ai_campaign_approve', 'Approve and schedule')}
          </Button>
          <div className="grid grid-cols-2 gap-[8px]">
            <Button
              secondary
              className="!px-[8px] text-[12px]"
              loading={loading === 'text'}
              onClick={call('text', `/ai-campaigns/posts/${post.id}/regenerate-text`)}
            >
              {t('ai_campaign_new_text', 'New text')}
            </Button>
            <Button
              secondary
              className="!px-[8px] text-[12px]"
              disabled={!post.imagePrompt}
              loading={loading === 'image'}
              onClick={call(
                'image',
                `/ai-campaigns/posts/${post.id}/regenerate-image`
              )}
            >
              {t('ai_campaign_new_image', 'New image')}
            </Button>
          </div>
          <Button
            secondary
            className="text-[12px]"
            loading={loading === 'reject'}
            onClick={reject}
          >
            {t('ai_campaign_discard', 'Discard')}
          </Button>
        </div>
      )}
    </div>
  );
};

const CampaignCard: FC<{
  campaign: Campaign;
  integrations: IntegrationItem[];
  onChange: () => void;
}> = ({ campaign, integrations, onChange }) => {
  const t = useT();
  const fetch = useFetch();
  const themes: string[] = JSON.parse(campaign.themes);
  const channels = integrations.filter((p) =>
    (JSON.parse(campaign.integrations) as string[]).includes(p.id)
  );
  const count = (status: CampaignPost['status']) =>
    campaign.posts.filter((p) => p.status === status).length;
  const totalCost = campaign.posts.reduce((all, p) => all + (p.cost || 0), 0);

  const remove = useCallback(async () => {
    if (
      await deleteDialog(
        t(
          'ai_campaign_delete_confirm',
          'Delete this campaign? Posts already scheduled stay in the calendar.'
        )
      )
    ) {
      await fetch(`/ai-campaigns/${campaign.id}`, { method: 'DELETE' });
      onChange();
    }
  }, [campaign.id]);

  return (
    <div className="flex flex-col gap-[14px] p-[20px] rounded-[12px] border border-newBorder">
      <div className="flex justify-between items-start gap-[12px]">
        <div className="flex flex-col gap-[6px]">
          <div className="text-[18px] font-[600]">{themes.join(' · ')}</div>
          <div className="flex items-center gap-[8px] text-[13px] opacity-70 flex-wrap">
            <span>
              {dayjs.utc(campaign.createdAt).tz(getTimezone()).format('DD/MM/YYYY')}
            </span>
            <span>·</span>
            <span>
              {campaign.quantity} {t('ai_campaign_posts', 'posts')}
            </span>
            <span>·</span>
            <span>
              {count('pending')} {t('ai_campaign_waiting', 'waiting')},{' '}
              {count('approved')} {t('ai_campaign_scheduled', 'scheduled')}
              {count('generating') > 0 &&
                `, ${count('generating')} ${t(
                  'ai_campaign_generating',
                  'generating'
                )}`}
            </span>
            <span>·</span>
            <span>
              {campaign.aiModel === 'economy'
                ? t('ai_campaign_model_economy', 'Economy')
                : t('ai_campaign_model_premium', 'Premium (current)')}
              {totalCost > 0 &&
                ` · ${t('ai_campaign_real_cost', 'AI cost')}: ${formatCost(
                  totalCost
                )}`}
            </span>
            <span>·</span>
            <div className="flex -space-x-[6px]">
              {channels.map((channel) => (
                <img
                  key={channel.id}
                  src={channel.picture}
                  title={channel.name}
                  className="w-[20px] h-[20px] rounded-full border border-newBgColorInner"
                  alt={channel.name}
                />
              ))}
            </div>
          </div>
        </div>
        <Button secondary className="text-[12px]" onClick={remove}>
          {t('delete', 'Delete')}
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[14px]">
        {campaign.posts.map((post) => (
          <PostCard
            key={`${post.id}-${post.status}-${post.content?.length}-${post.imagePath}`}
            post={post}
            isStory={campaign.instagramFormat === 'story'}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
};

export const AiCampaignsComponent: FC = () => {
  const t = useT();
  const modals = useModals();
  const { data: campaigns, isLoading, mutate } = useAiCampaigns();
  const { data: integrations } = useIntegrationsList();

  const newCampaign = useCallback(() => {
    modals.openModal({
      title: t('ai_campaign_new', 'New AI campaign'),
      closeOnClickOutside: false,
      classNames: {
        modal: 'w-[100%] max-w-[800px] text-textColor',
      },
      children: (close) => (
        <NewCampaign
          onCancel={close}
          onCreated={() => {
            close();
            mutate();
          }}
        />
      ),
    });
  }, [mutate]);

  return (
    <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[20px] transition-all">
      <div className="flex justify-between items-center gap-[12px]">
        <div className="flex flex-col gap-[4px]">
          <div className="text-[24px] font-[600]">
            {t('ai_campaigns', 'AI Campaigns')}
          </div>
          <div className="text-[14px] opacity-70">
            {t(
              'ai_campaigns_description',
              'Pick your themes, the AI researches what is trending right now, writes the posts and draws the images. Nothing is published until you approve it.'
            )}
          </div>
        </div>
        <Button onClick={newCampaign}>
          {t('ai_campaign_new', 'New AI campaign')}
        </Button>
      </div>

      {!isLoading && !campaigns?.length && (
        <div className="flex flex-col items-center justify-center gap-[12px] py-[80px] text-center opacity-70">
          <div className="text-[18px]">
            {t('ai_campaigns_empty', 'You have no AI campaigns yet')}
          </div>
          <div>
            {t(
              'ai_campaigns_empty_description',
              'Create one to get a batch of posts about your themes, ready for your approval.'
            )}
          </div>
        </div>
      )}

      {campaigns?.map((campaign) => (
        <CampaignCard
          key={campaign.id}
          campaign={campaign}
          integrations={integrations || []}
          onChange={() => mutate()}
        />
      ))}
    </div>
  );
};
