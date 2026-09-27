import { BadRequestException, Injectable } from '@nestjs/common';
import { Organization } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { AiCampaignsRepository } from '@gitroom/nestjs-libraries/database/prisma/ai-campaigns/ai.campaigns.repository';
import {
  AiCampaignDto,
  AiCampaignPostDto,
} from '@gitroom/nestjs-libraries/dtos/ai-campaigns/ai.campaign.dto';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';

dayjs.extend(utc);

type CampaignPost = Awaited<
  ReturnType<AiCampaignsRepository['createCampaign']>
>['posts'][number];

@Injectable()
export class AiCampaignsService {
  private storage = UploadFactory.createStorage();
  constructor(
    private _aiCampaignsRepository: AiCampaignsRepository,
    private _openaiService: OpenaiService,
    private _mediaService: MediaService,
    private _postsService: PostsService,
    private _integrationService: IntegrationService,
    private _subscriptionService: SubscriptionService
  ) {}

  async getCampaigns(orgId: string) {
    await this._aiCampaignsRepository.failStalePosts(
      orgId,
      dayjs().subtract(60, 'minute').toDate()
    );
    return this._aiCampaignsRepository.getCampaigns(orgId);
  }

  async createCampaign(org: Organization, body: AiCampaignDto) {
    const integrations = await this.getIntegrations(org.id, body.integrations);
    if (!integrations.length) {
      throw new BadRequestException('Select at least one active channel');
    }

    // Themes take turns so every theme gets its share of the posts,
    // one post every `intervalDays` starting from `startDate`
    const posts = Array.from({ length: body.quantity }).map((_, index) => ({
      theme: body.themes[index % body.themes.length],
      publishDate: dayjs(body.startDate)
        .add(index * body.intervalDays, 'day')
        .toDate(),
    }));

    const campaign = await this._aiCampaignsRepository.createCampaign(
      org.id,
      body,
      posts
    );

    // Generating takes minutes (web search, texts and images), the page
    // polls the campaign until every post left the "generating" status
    this.generateCampaign(org, campaign.id, campaign.posts).catch((err) =>
      console.log('AI campaign generation failed', err)
    );

    return { id: campaign.id };
  }

  async deleteCampaign(orgId: string, id: string) {
    return this._aiCampaignsRepository.deleteCampaign(orgId, id);
  }

  async updatePost(orgId: string, id: string, body: AiCampaignPostDto) {
    const post = await this.getPendingPost(orgId, id);
    return this._aiCampaignsRepository.updatePost(orgId, post.id, {
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.publishDate ? { publishDate: new Date(body.publishDate) } : {}),
    });
  }

  async rejectPost(orgId: string, id: string) {
    const post = await this.getPendingPost(orgId, id);
    return this._aiCampaignsRepository.updatePost(orgId, post.id, {
      status: 'rejected',
    });
  }

  // Regenerating runs in the background like the first generation, a web
  // search plus an image easily takes longer than the proxy timeout
  async regenerateText(org: Organization, id: string) {
    const post = await this.getPendingPost(org.id, id);
    await this.lockPost(org.id, post.id, 'generating');

    this.runRegenerateText(org, post).catch((err) =>
      this.failPost(org.id, post.id, err)
    );

    return { id: post.id };
  }

  async regenerateImage(org: Organization, id: string) {
    const post = await this.getPendingPost(org.id, id);
    if (!post.imagePrompt) {
      throw new BadRequestException('This post has no image prompt');
    }

    await this.lockPost(org.id, post.id, 'generating');

    this.runRegenerateImage(org, post.id, post.imagePrompt).catch((err) =>
      this.failPost(org.id, post.id, err)
    );

    return { id: post.id };
  }

  // Nothing reaches the calendar before the user approves it, approving
  // schedules the post on every channel of the campaign
  async approvePost(orgId: string, id: string) {
    const post = await this.getPendingPost(orgId, id);
    if (!post.content) {
      throw new BadRequestException('This post has no content');
    }

    if (dayjs(post.publishDate).isBefore(dayjs())) {
      throw new BadRequestException(
        'The publish date is in the past, change it before approving'
      );
    }

    const integrations = await this.getIntegrations(
      orgId,
      JSON.parse(post.campaign.integrations)
    );
    if (!integrations.length) {
      throw new BadRequestException('The channels of this campaign are gone');
    }

    const group = makeId(10);
    const body = await this._postsService.mapTypeToPost(
      {
        type: 'schedule',
        date: dayjs(post.publishDate).utc().format('YYYY-MM-DDTHH:mm:ss') + 'Z',
        shortLink: false,
        tags: [],
        posts: integrations.map((integration) => ({
          integration: { id: integration.id },
          group,
          settings: {
            __type: integration.providerIdentifier as any,
          } as any,
          value: [
            {
              id: makeId(10),
              delay: 0,
              content: post.content!,
              image:
                post.imageId && post.imagePath
                  ? [{ id: post.imageId, path: post.imagePath }]
                  : [],
            },
          ],
        })),
      },
      orgId
    );

    const validation = await this._postsService.validatePosts(
      orgId,
      body.posts
    );
    const invalid = validation.find(
      (p) => p.emptyContent || !p.valid || p.errors !== true || p.tooLong
    );
    if (invalid) {
      throw new BadRequestException(
        `${invalid.name}: ${
          invalid.tooLong
            ? 'post is too long, please shorten it'
            : invalid.settingsError ||
              (invalid.errors !== true ? invalid.errors : '') ||
              'please fix the post'
        }`
      );
    }

    await this.lockPost(orgId, post.id, 'approving');

    try {
      await this._postsService.createPost(orgId, body, 'AI_CAMPAIGN');
    } catch (err) {
      await this._aiCampaignsRepository.updatePost(orgId, post.id, {
        status: 'pending',
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    return this._aiCampaignsRepository.updatePost(orgId, post.id, {
      status: 'approved',
      postGroup: group,
    });
  }

  private async generateCampaign(
    org: Organization,
    campaignId: string,
    posts: CampaignPost[]
  ) {
    const campaign = await this._aiCampaignsRepository.getCampaign(
      org.id,
      campaignId
    );
    if (!campaign) {
      return;
    }

    const integrations = await this.getIntegrations(
      org.id,
      JSON.parse(campaign.integrations)
    );
    const platforms = integrations.map((p) => p.providerIdentifier);
    const byTheme = posts.reduce((all, post) => {
      all[post.theme] = [...(all[post.theme] || []), post];
      return all;
    }, {} as Record<string, CampaignPost[]>);

    // One web search per theme, then one post per angle found
    for (const [theme, themePosts] of Object.entries(byTheme)) {
      try {
        const research = await this._openaiService.researchTrends(
          theme,
          campaign.language,
          themePosts.length
        );
        const generated = await this._openaiService.generateCampaignPosts({
          theme,
          research,
          count: themePosts.length,
          language: campaign.language,
          tone: campaign.tone || undefined,
          instructions: campaign.instructions || undefined,
          platforms,
        });

        for (const [index, post] of themePosts.entries()) {
          const item = generated[index];
          if (!item) {
            await this.failPost(
              org.id,
              post.id,
              new Error('The AI returned fewer posts than requested')
            );
            continue;
          }

          await this._aiCampaignsRepository.updatePost(org.id, post.id, {
            trend: item.trend,
            sources: JSON.stringify(item.sources),
            content: item.content,
            imagePrompt: item.imagePrompt,
            ...(campaign.generateImages ? {} : { status: 'pending' }),
          });

          if (!campaign.generateImages) {
            continue;
          }

          try {
            const media = await this.createImage(org, item.imagePrompt);
            await this._aiCampaignsRepository.updatePost(org.id, post.id, {
              status: 'pending',
              imageId: media.id,
              imagePath: media.path,
            });
          } catch (err) {
            // The text is still useful, the user can retry only the image
            await this._aiCampaignsRepository.updatePost(org.id, post.id, {
              status: 'pending',
              error: `Image: ${err instanceof Error ? err.message : err}`,
            });
          }
        }
      } catch (err) {
        for (const post of themePosts) {
          await this.failPost(org.id, post.id, err);
        }
      }
    }

    await this._aiCampaignsRepository.updateCampaignStatus(campaignId, 'ready');
  }

  private async runRegenerateText(
    org: Organization,
    post: NonNullable<Awaited<ReturnType<AiCampaignsRepository['getPost']>>>
  ) {
    const integrations = await this.getIntegrations(
      org.id,
      JSON.parse(post.campaign.integrations)
    );
    const research = await this._openaiService.researchTrends(
      post.theme,
      post.campaign.language,
      3
    );
    const [generated] = await this._openaiService.generateCampaignPosts({
      theme: post.theme,
      research,
      count: 1,
      language: post.campaign.language,
      tone: post.campaign.tone || undefined,
      instructions: post.campaign.instructions || undefined,
      platforms: integrations.map((p) => p.providerIdentifier),
    });

    if (!generated) {
      throw new Error('The AI did not return a post');
    }

    await this._aiCampaignsRepository.updatePost(org.id, post.id, {
      status: 'pending',
      trend: generated.trend,
      sources: JSON.stringify(generated.sources),
      content: generated.content,
      imagePrompt: generated.imagePrompt,
    });
  }

  private async runRegenerateImage(
    org: Organization,
    id: string,
    prompt: string
  ) {
    try {
      const media = await this.createImage(org, prompt);
      await this._aiCampaignsRepository.updatePost(org.id, id, {
        status: 'pending',
        imageId: media.id,
        imagePath: media.path,
      });
    } catch (err) {
      // The text is still there, only the new image failed
      await this._aiCampaignsRepository.updatePost(org.id, id, {
        status: 'pending',
        error: `Image: ${err instanceof Error ? err.message : err}`,
      });
    }
  }

  private async createImage(org: Organization, prompt: string) {
    // Same credit gate as the dashboard's /media/generate-image route
    const total = await this._subscriptionService.checkCredits(org);
    if (process.env.STRIPE_PUBLISHABLE_KEY && total.credits <= 0) {
      throw new Error('No AI image credits are available on this account');
    }

    const image = await this._mediaService.generateImage(
      this._openaiService.realisticPhotoPrompt(prompt),
      org
    );
    const file = await this.storage.uploadSimple(
      'data:image/png;base64,' + image
    );

    return this._mediaService.saveFile(org.id, file.split('/').pop()!, file);
  }

  private async getIntegrations(orgId: string, ids: string[]) {
    const list = await this._integrationService.getIntegrationsList(orgId);
    return list.filter(
      (p) => ids.includes(p.id) && !p.disabled && !p.inBetweenSteps
    );
  }

  private async getPendingPost(orgId: string, id: string) {
    const post = await this._aiCampaignsRepository.getPost(orgId, id);
    if (!post) {
      throw new BadRequestException('Post not found');
    }

    if (!['pending', 'failed'].includes(post.status)) {
      throw new BadRequestException(
        `This post can not be changed, its status is ${post.status}`
      );
    }

    return post;
  }

  private async lockPost(orgId: string, id: string, status: string) {
    if (!(await this._aiCampaignsRepository.lockPost(orgId, id, status))) {
      throw new BadRequestException('This post is already being processed');
    }
  }

  private failPost(orgId: string, id: string, err: unknown) {
    return this._aiCampaignsRepository.updatePost(orgId, id, {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
