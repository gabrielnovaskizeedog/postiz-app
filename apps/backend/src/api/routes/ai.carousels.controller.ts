import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { AiCarouselsService } from '@gitroom/nestjs-libraries/database/prisma/ai-carousels/ai.carousels.service';
import {
  AiCarouselDto,
  AiCarouselHookDto,
  AiCarouselReviseDto,
  AiCarouselUpdateDto,
} from '@gitroom/nestjs-libraries/dtos/ai-carousels/ai.carousel.dto';

@ApiTags('AI Carousels')
@Controller('/ai-carousels')
export class AiCarouselsController {
  constructor(private _aiCarouselsService: AiCarouselsService) {}

  @Get('/')
  getCarousels(@GetOrgFromRequest() org: Organization) {
    return this._aiCarouselsService.getCarousels(org.id);
  }

  @Post('/')
  createCarousel(
    @GetOrgFromRequest() org: Organization,
    @Body() body: AiCarouselDto
  ) {
    return this._aiCarouselsService.createCarousel(org, body);
  }

  @Post('/:id/hook')
  chooseHook(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: AiCarouselHookDto
  ) {
    return this._aiCarouselsService.chooseHook(org, id, body.hook);
  }

  @Post('/:id/revise')
  reviseCarousel(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: AiCarouselReviseDto
  ) {
    return this._aiCarouselsService.reviseCarousel(org, id, body.instruction);
  }

  @Put('/:id')
  updateCarousel(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: AiCarouselUpdateDto
  ) {
    return this._aiCarouselsService.updateCarousel(org.id, id, body);
  }

  @Post('/:id/approve')
  approveCarousel(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._aiCarouselsService.approveCarousel(org.id, id);
  }

  @Post('/:id/reject')
  rejectCarousel(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._aiCarouselsService.rejectCarousel(org.id, id);
  }

  @Delete('/:id')
  deleteCarousel(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._aiCarouselsService.deleteCarousel(org.id, id);
  }
}
