import { BadRequestException, Injectable } from '@nestjs/common';
import { AiCarousel, Organization } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { AiCarouselsRepository } from '@gitroom/nestjs-libraries/database/prisma/ai-carousels/ai.carousels.repository';
import {
  AiCarouselDto,
  AiCarouselUpdateDto,
} from '@gitroom/nestjs-libraries/dtos/ai-carousels/ai.carousel.dto';
import {
  AiCampaignTier,
  OpenaiService,
} from '@gitroom/nestjs-libraries/openai/openai.service';
import { BrandKitService } from '@gitroom/nestjs-libraries/database/prisma/brand-kit/brand.kit.service';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import {
  buildCarouselHtml,
  CarouselSlide,
} from '@gitroom/nestjs-libraries/carousels/carousel.template';
import { renderCarousel } from '@gitroom/nestjs-libraries/carousels/carousel.renderer';

dayjs.extend(utc);

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Step 9 of the guide: the AI reviews its own slides as a demanding editor
const EDITOR_REVIEW = `Revise como um editor exigente antes de publicar no nome do autor:
(1) cada número, nome, data e afirmação precisa estar na pesquisa, de preferência na fonte original; corrija ou remova o que não estiver, incluindo o que aparece em DIVERGENCES como não confirmado;
(2) remova exageros de tempo, causa ou alcance que a fonte não sustenta;
(3) citação só se for frase exata de uma pessoa nomeada nas QUOTES, senão troque o slide por outro tipo;
(4) troque itens de enchimento por informação concreta da pesquisa;
(5) use as palavras exatas da fonte para limitações.
Mantenha a estrutura, a quantidade de slides e o tom.`;

// Settings the providers need to publish several pictures as a carousel
const carouselSettings = (identifier: string, title: string) =>
  ['instagram', 'instagram-standalone'].includes(identifier)
    ? { post_type: 'post' }
    : ['linkedin', 'linkedin-page'].includes(identifier)
    ? { post_as_images_carousel: true, carousel_name: title.slice(0, 60) }
    : {};

@Injectable()
export class AiCarouselsService {
  private storage = UploadFactory.createStorage();
  constructor(
    private _aiCarouselsRepository: AiCarouselsRepository,
    private _openaiService: OpenaiService,
    private _brandKitService: BrandKitService,
    private _mediaService: MediaService,
    private _postsService: PostsService,
    private _integrationService: IntegrationService
  ) {}

  async getCarousels(orgId: string) {
    await this._aiCarouselsRepository.failStale(
      orgId,
      dayjs().subtract(30, 'minute').toDate()
    );
    return this._aiCarouselsRepository.getCarousels(orgId);
  }

  async createCarousel(org: Organization, body: AiCarouselDto) {
    if (!(await this.getIntegrations(org.id, body.integrations)).length) {
      throw new BadRequestException('Select at least one active channel');
    }

    const carousel = await this._aiCarouselsRepository.createCarousel(
      org.id,
      body
    );
    this.run(org, carousel.id, () => this.research(org, carousel));
    return { id: carousel.id };
  }

  async chooseHook(org: Organization, id: string, hook: string) {
    const carousel = await this.getCarousel(org.id, id);
    if (!carousel.research) {
      throw new BadRequestException('The research is not ready yet');
    }
    await this.lock(org.id, id, ['choosing_hook', 'failed'], 'generating');
    this.run(org, id, () => this.generate(org, { ...carousel, hook }));
    return { id };
  }

  async reviseCarousel(org: Organization, id: string, instruction: string) {
    const carousel = await this.getCarousel(org.id, id);
    if (!carousel.slides) {
      throw new BadRequestException('There are no slides to change yet');
    }
    await this.lock(org.id, id, ['pending', 'failed'], 'generating');
    this.run(org, id, () => this.revise(org, carousel, instruction));
    return { id };
  }

  async updateCarousel(orgId: string, id: string, body: AiCarouselUpdateDto) {
    const carousel = await this.getCarousel(orgId, id);
    if (carousel.status !== 'pending') {
      throw new BadRequestException('Only carousels waiting for approval can be changed');
    }
    return this._aiCarouselsRepository.updateCarousel(orgId, id, {
      ...(body.caption !== undefined ? { caption: body.caption } : {}),
      ...(body.publishDate ? { publishDate: new Date(body.publishDate) } : {}),
    });
  }

  async rejectCarousel(orgId: string, id: string) {
    await this.lock(orgId, id, ['choosing_hook', 'pending', 'failed'], 'rejected');
    return { id };
  }

  deleteCarousel(orgId: string, id: string) {
    return this._aiCarouselsRepository.deleteCarousel(orgId, id);
  }

  // Nothing is published before the user approves: approving schedules one
  // post with every slide on each channel of the carousel
  async approveCarousel(orgId: string, id: string) {
    const carousel = await this.getCarousel(orgId, id);
    const images = JSON.parse(carousel.images || '[]') as Array<{ id: string; path: string }>;
    if (carousel.status !== 'pending' || !images.length || !carousel.caption) {
      throw new BadRequestException('The carousel is not ready to be approved');
    }
    if (dayjs(carousel.publishDate).isBefore(dayjs())) {
      throw new BadRequestException('The publish date is in the past, change it before approving');
    }

    const integrations = await this.getIntegrations(orgId, JSON.parse(carousel.integrations));
    if (!integrations.length) {
      throw new BadRequestException('The channels of this carousel are gone');
    }

    const group = makeId(10);
    const body = await this._postsService.mapTypeToPost(
      {
        type: 'schedule',
        date: dayjs(carousel.publishDate).utc().format('YYYY-MM-DDTHH:mm:ss') + 'Z',
        shortLink: false,
        tags: [],
        posts: integrations.map((integration) => ({
          integration: { id: integration.id },
          group,
          settings: {
            __type: integration.providerIdentifier as any,
            ...carouselSettings(integration.providerIdentifier, carousel.hook || 'Carrossel'),
          } as any,
          value: [
            {
              id: makeId(10),
              delay: 0,
              content: carousel.caption!,
              image: images,
            },
          ],
        })),
      },
      orgId
    );

    const validation = await this._postsService.validatePosts(orgId, body.posts);
    const invalid = validation.find(
      (p) => p.emptyContent || !p.valid || p.errors !== true || p.tooLong
    );
    if (invalid) {
      throw new BadRequestException(
        `${invalid.name}: ${
          invalid.tooLong
            ? 'the caption is too long for this channel'
            : invalid.settingsError || (invalid.errors !== true ? invalid.errors : '') || 'please fix the post'
        }`
      );
    }

    await this.lock(orgId, id, ['pending'], 'approving');
    try {
      await this._postsService.createPost(orgId, body, 'AI_CAMPAIGN');
    } catch (err) {
      await this._aiCarouselsRepository.updateCarousel(orgId, id, {
        status: 'pending',
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    return this._aiCarouselsRepository.updateCarousel(orgId, id, {
      status: 'approved',
      postGroup: group,
    });
  }

  // Step 7: read the link (or the trending story), check the original source,
  // then 5 cover hooks for the user to pick
  private async research(org: Organization, carousel: AiCarousel) {
    const tier = carousel.aiModel as AiCampaignTier;
    const research = await this._openaiService.researchCarousel({
      url: carousel.sourceUrl || undefined,
      theme: carousel.theme || undefined,
      language: carousel.language,
      // checking the original source needs the best model, it costs cents
      tier: 'premium',
    });
    const hooks = await this._openaiService.generateCarouselHooks({
      research: research.text,
      language: carousel.language,
      audience: carousel.audience || undefined,
      tier,
    });
    await this._aiCarouselsRepository.updateCarousel(org.id, carousel.id, {
      status: 'choosing_hook',
      research: research.text,
      hooks: JSON.stringify(hooks.hooks),
      cost: { increment: research.cost + hooks.cost },
    });
  }

  // Steps 5 to 10: slides, editor review, PNGs and caption
  private async generate(org: Organization, carousel: AiCarousel) {
    const tier = carousel.aiModel as AiCampaignTier;
    const kit = await this._brandKitService.getBrandKit(org);
    const emotions = [...new Set(kit.photos.map((p) => p.emotion))];
    const common = {
      research: carousel.research!,
      language: carousel.language,
      audience: carousel.audience || undefined,
      emotions,
      tier,
    };

    const draft = await this._openaiService.generateCarouselSlides({
      ...common,
      hook: carousel.hook!,
      slides: carousel.slidesCount,
    });
    const reviewed = await this._openaiService.reviseCarouselSlides({
      ...common,
      current: draft.slides,
      instruction: EDITOR_REVIEW,
    });
    const images = await this.renderAndUpload(org, carousel, reviewed.slides);
    const caption = await this._openaiService.generateCarouselCaption({
      research: carousel.research!,
      slides: reviewed.slides,
      language: carousel.language,
      size: kit.captionSize,
      tone: kit.captionTone,
      emojis: kit.captionEmojis,
      hashtags: kit.captionHashtags,
      tier,
    });

    await this._aiCarouselsRepository.updateCarousel(org.id, carousel.id, {
      status: 'pending',
      hook: carousel.hook,
      slides: JSON.stringify(reviewed.slides),
      images: JSON.stringify(images),
      caption: caption.caption,
      sources: this.sourcesOf(carousel.research!),
      cost: { increment: draft.cost + reviewed.cost + caption.cost },
    });
  }

  private async revise(org: Organization, carousel: AiCarousel, instruction: string) {
    const kit = await this._brandKitService.getBrandKit(org);
    const revised = await this._openaiService.reviseCarouselSlides({
      research: carousel.research!,
      current: JSON.parse(carousel.slides!) as CarouselSlide[],
      instruction,
      language: carousel.language,
      audience: carousel.audience || undefined,
      emotions: [...new Set(kit.photos.map((p) => p.emotion))],
      tier: carousel.aiModel as AiCampaignTier,
    });
    const images = await this.renderAndUpload(org, carousel, revised.slides);
    await this._aiCarouselsRepository.updateCarousel(org.id, carousel.id, {
      status: 'pending',
      slides: JSON.stringify(revised.slides),
      images: JSON.stringify(images),
      cost: { increment: revised.cost },
    });
  }

  private async renderAndUpload(org: Organization, carousel: AiCarousel, slides: CarouselSlide[]) {
    const kit = await this._brandKitService.getBrandKit(org);
    const date = dayjs(carousel.publishDate);
    const html = buildCarouselHtml(
      slides,
      {
        identity: kit.identity,
        name: kit.name,
        handle: kit.handle,
        bio: kit.bio || '',
        category: carousel.category || kit.category || '',
        avatarPath: kit.avatarPath,
        photos: kit.photos.map((p) => ({
          path: p.path,
          emotion: p.emotion,
          cutout: p.cutout,
          ratio: p.ratio,
        })),
      },
      `${MONTHS[date.month()]} · ${date.year()}`
    );
    const pngs = await renderCarousel(html, slides.length);

    const images: Array<{ id: string; path: string }> = [];
    for (const png of pngs) {
      const file = await this.storage.uploadSimple('data:image/png;base64,' + png.toString('base64'));
      const media = await this._mediaService.saveFile(org.id, file.split('/').pop()!, file);
      images.push({ id: media.id, path: media.path });
    }
    return images;
  }

  // The SOURCES section of the research, shown to the user next to the slides
  private sourcesOf(research: string) {
    return JSON.stringify(
      [...new Set(research.match(/https?:\/\/[^\s)\]]+/g) || [])].map((url) =>
        url.replace(/[?&]utm_source=openai/, '').replace(/[.,;]+$/, '')
      )
    );
  }

  // Generation takes minutes, it runs in the background and the page polls
  private run(org: Organization, id: string, job: () => Promise<void>) {
    job().catch((err) =>
      this._aiCarouselsRepository.updateCarousel(org.id, id, {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      })
    );
  }

  private async lock(orgId: string, id: string, from: string[], to: string) {
    if (!(await this._aiCarouselsRepository.lockCarousel(orgId, id, from, to))) {
      throw new BadRequestException('This carousel is already being processed');
    }
  }

  private async getCarousel(orgId: string, id: string) {
    const carousel = await this._aiCarouselsRepository.getCarousel(orgId, id);
    if (!carousel) {
      throw new BadRequestException('Carousel not found');
    }
    return carousel;
  }

  private async getIntegrations(orgId: string, ids: string[]) {
    const list = await this._integrationService.getIntegrationsList(orgId);
    return list.filter((p) => ids.includes(p.id) && !p.disabled && !p.inBetweenSteps);
  }
}
