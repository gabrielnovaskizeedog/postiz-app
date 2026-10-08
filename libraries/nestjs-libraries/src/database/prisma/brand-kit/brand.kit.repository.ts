import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { BrandKitDto } from '@gitroom/nestjs-libraries/dtos/brand-kit/brand.kit.dto';

@Injectable()
export class BrandKitRepository {
  constructor(
    private _brandKit: PrismaRepository<'brandKit'>,
    private _brandPhoto: PrismaRepository<'brandPhoto'>
  ) {}

  getBrandKit(orgId: string) {
    return this._brandKit.model.brandKit.findUnique({
      where: {
        organizationId: orgId,
      },
    });
  }

  saveBrandKit(orgId: string, body: BrandKitDto) {
    return this._brandKit.model.brandKit.upsert({
      where: {
        organizationId: orgId,
      },
      create: {
        organizationId: orgId,
        ...body,
      },
      update: body,
    });
  }

  getPhotos(orgId: string) {
    return this._brandPhoto.model.brandPhoto.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  addPhoto(
    orgId: string,
    photo: { path: string; emotion: string; cutout: boolean; ratio: number }
  ) {
    return this._brandPhoto.model.brandPhoto.create({
      data: {
        organizationId: orgId,
        ...photo,
      },
    });
  }

  updatePhotoEmotion(orgId: string, id: string, emotion: string) {
    return this._brandPhoto.model.brandPhoto.update({
      where: {
        id,
        organizationId: orgId,
      },
      data: {
        emotion,
      },
    });
  }

  deletePhoto(orgId: string, id: string) {
    return this._brandPhoto.model.brandPhoto.update({
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
