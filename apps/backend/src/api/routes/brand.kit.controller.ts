import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { BrandKitService } from '@gitroom/nestjs-libraries/database/prisma/brand-kit/brand.kit.service';
import {
  BrandKitDto,
  BrandPhotoDto,
  BrandPhotoEmotionDto,
} from '@gitroom/nestjs-libraries/dtos/brand-kit/brand.kit.dto';

@ApiTags('Brand Kit')
@Controller('/brand-kit')
export class BrandKitController {
  constructor(private _brandKitService: BrandKitService) {}

  @Get('/')
  getBrandKit(@GetOrgFromRequest() org: Organization) {
    return this._brandKitService.getBrandKit(org);
  }

  @Put('/')
  saveBrandKit(
    @GetOrgFromRequest() org: Organization,
    @Body() body: BrandKitDto
  ) {
    return this._brandKitService.saveBrandKit(org.id, body);
  }

  @Post('/photos')
  addPhoto(
    @GetOrgFromRequest() org: Organization,
    @Body() body: BrandPhotoDto
  ) {
    return this._brandKitService.addPhoto(org.id, body);
  }

  @Put('/photos/:id')
  updatePhoto(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: BrandPhotoEmotionDto
  ) {
    return this._brandKitService.updatePhotoEmotion(org.id, id, body.emotion);
  }

  @Delete('/photos/:id')
  deletePhoto(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._brandKitService.deletePhoto(org.id, id);
  }
}
