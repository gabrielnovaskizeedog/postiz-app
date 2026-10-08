import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiCarouselDto } from '@gitroom/nestjs-libraries/dtos/ai-carousels/ai.carousel.dto';

@Injectable()
export class AiCarouselsRepository {
  constructor(private _aiCarousel: PrismaRepository<'aiCarousel'>) {}

  getCarousels(orgId: string) {
    return this._aiCarousel.model.aiCarousel.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });
  }

  getCarousel(orgId: string, id: string) {
    return this._aiCarousel.model.aiCarousel.findFirst({
      where: {
        id,
        organizationId: orgId,
        deletedAt: null,
      },
    });
  }

  createCarousel(orgId: string, body: AiCarouselDto) {
    return this._aiCarousel.model.aiCarousel.create({
      data: {
        organizationId: orgId,
        source: body.source,
        sourceUrl: body.source === 'link' ? body.url : null,
        theme: body.source === 'trend' ? body.theme : null,
        audience: body.audience,
        category: body.category,
        slidesCount: body.slides,
        language: body.language,
        integrations: JSON.stringify(body.integrations),
        publishDate: new Date(body.publishDate),
        aiModel: body.aiModel || 'premium',
      },
    });
  }

  updateCarousel(
    orgId: string,
    id: string,
    data: Prisma.AiCarouselUpdateInput
  ) {
    return this._aiCarousel.model.aiCarousel.update({
      where: {
        id,
        organizationId: orgId,
      },
      data,
    });
  }

  // Only one request can move a carousel out of the given statuses
  async lockCarousel(orgId: string, id: string, from: string[], to: string) {
    const { count } = await this._aiCarousel.model.aiCarousel.updateMany({
      where: {
        id,
        organizationId: orgId,
        status: { in: from },
      },
      data: {
        status: to,
        error: null,
      },
    });
    return count > 0;
  }

  // A restart in the middle of a generation leaves carousels working forever
  failStale(orgId: string, before: Date) {
    return this._aiCarousel.model.aiCarousel.updateMany({
      where: {
        organizationId: orgId,
        status: { in: ['researching', 'generating', 'approving'] },
        updatedAt: { lt: before },
      },
      data: {
        status: 'failed',
        error: 'The generation was interrupted, try again',
      },
    });
  }

  deleteCarousel(orgId: string, id: string) {
    return this._aiCarousel.model.aiCarousel.update({
      where: {
        id,
        organizationId: orgId,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}
