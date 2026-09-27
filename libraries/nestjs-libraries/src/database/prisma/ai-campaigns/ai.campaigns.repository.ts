import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { AiCampaignDto } from '@gitroom/nestjs-libraries/dtos/ai-campaigns/ai.campaign.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AiCampaignsRepository {
  constructor(
    private _aiCampaign: PrismaRepository<'aiCampaign'>,
    private _aiCampaignPost: PrismaRepository<'aiCampaignPost'>
  ) {}

  getCampaigns(orgId: string) {
    return this._aiCampaign.model.aiCampaign.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        posts: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            publishDate: 'asc',
          },
        },
      },
    });
  }

  getCampaign(orgId: string, id: string) {
    return this._aiCampaign.model.aiCampaign.findFirst({
      where: {
        id,
        organizationId: orgId,
        deletedAt: null,
      },
      include: {
        posts: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            publishDate: 'asc',
          },
        },
      },
    });
  }

  createCampaign(
    orgId: string,
    body: AiCampaignDto,
    posts: Array<{ theme: string; publishDate: Date }>
  ) {
    return this._aiCampaign.model.aiCampaign.create({
      data: {
        organizationId: orgId,
        themes: JSON.stringify(body.themes),
        quantity: body.quantity,
        integrations: JSON.stringify(body.integrations),
        startDate: new Date(body.startDate),
        intervalDays: body.intervalDays,
        language: body.language,
        tone: body.tone,
        instructions: body.instructions,
        generateImages: body.generateImages,
        instagramFormat: body.instagramFormat || 'post',
        aiModel: body.aiModel || 'premium',
        posts: {
          create: posts.map((p) => ({
            organizationId: orgId,
            theme: p.theme,
            publishDate: p.publishDate,
          })),
        },
      },
      include: {
        posts: {
          orderBy: {
            publishDate: 'asc',
          },
        },
      },
    });
  }

  updateCampaignStatus(id: string, status: string) {
    return this._aiCampaign.model.aiCampaign.update({
      where: {
        id,
      },
      data: {
        status,
      },
    });
  }

  deleteCampaign(orgId: string, id: string) {
    return this._aiCampaign.model.aiCampaign.update({
      where: {
        id,
        organizationId: orgId,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  // A restart in the middle of a generation leaves posts in "generating"
  failStalePosts(orgId: string, before: Date) {
    return this._aiCampaignPost.model.aiCampaignPost.updateMany({
      where: {
        organizationId: orgId,
        status: 'generating',
        updatedAt: {
          lt: before,
        },
      },
      data: {
        status: 'failed',
        error: 'The generation was interrupted, try again',
      },
    });
  }

  // Only one request can move a post out of pending / failed, so a double
  // click can not schedule the same post twice
  async lockPost(orgId: string, id: string, status: string) {
    const { count } = await this._aiCampaignPost.model.aiCampaignPost.updateMany(
      {
        where: {
          id,
          organizationId: orgId,
          status: {
            in: ['pending', 'failed'],
          },
        },
        data: {
          status,
          error: null,
        },
      }
    );

    return count > 0;
  }

  getPost(orgId: string, id: string) {
    return this._aiCampaignPost.model.aiCampaignPost.findFirst({
      where: {
        id,
        organizationId: orgId,
        deletedAt: null,
      },
      include: {
        campaign: true,
      },
    });
  }

  updatePost(
    orgId: string,
    id: string,
    data: Prisma.AiCampaignPostUpdateInput
  ) {
    return this._aiCampaignPost.model.aiCampaignPost.update({
      where: {
        id,
        organizationId: orgId,
      },
      data,
    });
  }
}
