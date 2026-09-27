'use client';

import React, { FC, useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { expandPostsList } from '@gitroom/helpers/utils/posts.list.minify';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { getTimezone } from '@gitroom/frontend/components/layout/set.timezone';

type ListState = 'scheduled' | 'published' | 'draft';

interface ListPost {
  id: string;
  content: string;
  image?: string;
  publishDate: string;
  releaseURL?: string;
  state: 'QUEUE' | 'PUBLISHED' | 'ERROR' | 'DRAFT';
  integration: {
    id: string;
    name: string;
    picture: string;
    providerIdentifier: string;
  };
}

const PAGE = 30;

const usePostsList = (state: ListState, limit: number) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return expandPostsList(await (await fetch(path)).json()) as {
      posts: ListPost[];
      hasMore: boolean;
    };
  }, []);

  return useSWR<{ posts: ListPost[]; hasMore: boolean }>(
    `/posts/list?${new URLSearchParams({
      page: '0',
      limit: String(limit),
      state,
    })}`,
    load,
    { revalidateOnFocus: true }
  );
};

// Posts are stored as editor HTML, the agenda shows plain text
const plainText = (content: string) =>
  (content || '')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

const firstImage = (image?: string) => {
  try {
    return (JSON.parse(image || '[]') as Array<{ path: string }>)[0]?.path;
  } catch (e) {
    return undefined;
  }
};

const PostItem: FC<{ post: ListPost }> = ({ post }) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const thumbnail = firstImage(post.image);
  const text = plainText(post.content);
  const date = dayjs.utc(post.publishDate).tz(getTimezone());

  const status = {
    QUEUE: {
      label: t('mobile_status_scheduled', 'Scheduled'),
      className: 'bg-[#612BD3]/20 text-[#C4B5FD]',
    },
    PUBLISHED: {
      label: t('mobile_status_published', 'Published'),
      className: 'bg-green-500/15 text-green-400',
    },
    ERROR: {
      label: t('mobile_status_error', 'Error'),
      className: 'bg-red-500/15 text-red-400',
    },
    DRAFT: {
      label: t('mobile_status_draft', 'Draft'),
      className: 'bg-newBgColorInner opacity-80',
    },
  }[post.state];

  return (
    <div
      onClick={() => setOpen(!open)}
      className="flex flex-col gap-[10px] p-[12px] rounded-[12px] bg-newBgColorInner border border-newBorder"
    >
      <div className="flex items-center gap-[10px]">
        <div className="relative shrink-0">
          <img
            src={post.integration?.picture || '/no-picture.jpg'}
            alt={post.integration?.name}
            className="w-[36px] h-[36px] rounded-full object-cover"
          />
          <img
            src={`/icons/platforms/${post.integration?.providerIdentifier}.png`}
            alt=""
            className="w-[16px] h-[16px] rounded-full absolute -bottom-[2px] -end-[2px]"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] truncate">{post.integration?.name}</div>
          <div className="text-[12px] opacity-60">{date.format('HH:mm')}</div>
        </div>
        {status && (
          <div
            className={clsx(
              'text-[11px] px-[8px] py-[3px] rounded-full whitespace-nowrap',
              status.className
            )}
          >
            {status.label}
          </div>
        )}
      </div>
      <div className="flex gap-[10px]">
        {thumbnail && !open && (
          <img
            src={thumbnail}
            alt=""
            className="w-[64px] h-[64px] rounded-[8px] object-cover shrink-0"
          />
        )}
        <div
          className={clsx(
            'text-[14px] whitespace-pre-wrap break-words',
            !open && 'line-clamp-3'
          )}
        >
          {text || t('mobile_no_text', '(no text)')}
        </div>
      </div>
      {open && thumbnail && (
        <img src={thumbnail} alt="" className="w-full rounded-[8px]" />
      )}
      {open && post.releaseURL && (
        <a
          href={post.releaseURL}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[13px] text-[#A78BFA] underline"
        >
          {t('mobile_open_post', 'Open the published post')}
        </a>
      )}
    </div>
  );
};

const dayLabel = (date: dayjs.Dayjs, t: ReturnType<typeof useT>) => {
  const today = dayjs().tz(getTimezone()).startOf('day');
  const diff = date.startOf('day').diff(today, 'day');
  if (diff === 0) return t('mobile_today', 'Today');
  if (diff === 1) return t('mobile_tomorrow', 'Tomorrow');
  if (diff === -1) return t('mobile_yesterday', 'Yesterday');
  return date.toDate().toLocaleDateString(undefined, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: getTimezone(),
  });
};

export const MobileAgendaComponent: FC = () => {
  const t = useT();
  const [state, setState] = useState<ListState>('scheduled');
  const [limit, setLimit] = useState(PAGE);
  const { data, isLoading } = usePostsList(state, limit);

  const groups = useMemo(() => {
    const byDay: Array<{ key: string; label: string; posts: ListPost[] }> = [];
    for (const post of data?.posts || []) {
      const date = dayjs.utc(post.publishDate).tz(getTimezone());
      const key = date.format('YYYY-MM-DD');
      let group = byDay.find((g) => g.key === key);
      if (!group) {
        group = { key, label: dayLabel(date, t), posts: [] };
        byDay.push(group);
      }
      group.posts.push(post);
    }
    return byDay;
  }, [data, t]);

  const tabs: Array<{ value: ListState; label: string }> = [
    { value: 'scheduled', label: t('mobile_filter_scheduled', 'Scheduled') },
    { value: 'published', label: t('mobile_filter_published', 'Published') },
    { value: 'draft', label: t('mobile_filter_drafts', 'Drafts') },
  ];

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="grid grid-cols-3 gap-[4px] p-[4px] rounded-[10px] bg-newBgColorInner border border-newBorder">
        {tabs.map((tab) => (
          <div
            key={tab.value}
            onClick={() => {
              setState(tab.value);
              setLimit(PAGE);
            }}
            className={clsx(
              'text-center py-[8px] rounded-[8px] text-[13px]',
              state === tab.value ? 'bg-[#612BD3] text-white' : 'opacity-70'
            )}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="flex flex-col gap-[10px]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[110px] rounded-[12px] bg-newSep animate-pulse"
            />
          ))}
        </div>
      )}

      {!isLoading && !groups.length && (
        <div className="text-center opacity-60 py-[60px] text-[14px]">
          {state === 'scheduled'
            ? t('mobile_empty_scheduled', 'No scheduled posts yet')
            : state === 'published'
            ? t('mobile_empty_published', 'Nothing published yet')
            : t('mobile_empty_drafts', 'No drafts')}
        </div>
      )}

      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-[8px]">
          <div className="text-[13px] font-[600] capitalize opacity-80">
            {group.label}
          </div>
          {group.posts.map((post) => (
            <PostItem key={post.id} post={post} />
          ))}
        </div>
      ))}

      {data?.hasMore && limit < 100 && (
        <button
          onClick={() => setLimit(Math.min(limit + PAGE, 100))}
          className="py-[12px] rounded-[10px] border border-newBorder text-[14px]"
        >
          {t('mobile_load_more', 'Load more')}
        </button>
      )}
    </div>
  );
};
