import { BadRequestException, Injectable } from '@nestjs/common';
import { Organization } from '@prisma/client';
import sharp from 'sharp';
import { BrandKitRepository } from '@gitroom/nestjs-libraries/database/prisma/brand-kit/brand.kit.repository';
import {
  BrandKitDto,
  BrandPhotoDto,
} from '@gitroom/nestjs-libraries/dtos/brand-kit/brand.kit.dto';

@Injectable()
export class BrandKitService {
  constructor(private _brandKitRepository: BrandKitRepository) {}

  // The kit of the organization, with sensible defaults before it is saved
  async getBrandKit(org: Organization) {
    const kit = await this._brandKitRepository.getBrandKit(org.id);
    return {
      identity: 'editorial',
      name: org.name,
      handle: '',
      bio: '',
      category: '',
      avatarPath: null as string | null,
      captionSize: 'media',
      captionTone: 'leve',
      captionEmojis: 2,
      captionHashtags: 3,
      ...(kit || {}),
      photos: await this._brandKitRepository.getPhotos(org.id),
    };
  }

  saveBrandKit(orgId: string, body: BrandKitDto) {
    return this._brandKitRepository.saveBrandKit(orgId, body);
  }

  // A picture without background (transparent PNG) is placed as a cut-out,
  // any other picture goes in a frame; the ratio sizes it by its framing
  async addPhoto(orgId: string, body: BrandPhotoDto) {
    // only pictures uploaded to our own storage, never arbitrary URLs
    const allowed = [
      process.env.FRONTEND_URL,
      process.env.CLOUDFLARE_BUCKET_URL,
    ].filter(Boolean) as string[];
    if (!allowed.some((prefix) => body.path.startsWith(prefix))) {
      throw new BadRequestException('Upload the picture to the media library first');
    }

    let cutout = false;
    let ratio = 1.5;
    try {
      const image = sharp(
        Buffer.from(await (await fetch(body.path)).arrayBuffer())
      );
      const [metadata, stats] = await Promise.all([
        image.metadata(),
        image.stats(),
      ]);
      cutout = !!metadata.hasAlpha && !stats.isOpaque;
      ratio = (metadata.height || 3) / (metadata.width || 2);
    } catch (err) {
      throw new BadRequestException('Could not read this picture');
    }

    return this._brandKitRepository.addPhoto(orgId, {
      path: body.path,
      emotion: body.emotion,
      cutout,
      ratio,
    });
  }

  updatePhotoEmotion(orgId: string, id: string, emotion: string) {
    return this._brandKitRepository.updatePhotoEmotion(orgId, id, emotion);
  }

  deletePhoto(orgId: string, id: string) {
    return this._brandKitRepository.deletePhoto(orgId, id);
  }
}
