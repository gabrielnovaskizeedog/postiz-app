import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { AiCampaignsService } from '@gitroom/nestjs-libraries/database/prisma/ai-campaigns/ai.campaigns.service';
import {
  AiCampaignDto,
  AiCampaignPostDto,
} from '@gitroom/nestjs-libraries/dtos/ai-campaigns/ai.campaign.dto';

@ApiTags('AI Campaigns')
@Controller('/ai-campaigns')
export class AiCampaignsController {
  constructor(private _aiCampaignsService: AiCampaignsService) {}

  @Get('/')
  getCampaigns(@GetOrgFromRequest() org: Organization) {
    return this._aiCampaignsService.getCampaigns(org.id);
  }

  @Post('/')
  createCampaign(
    @GetOrgFromRequest() org: Organization,
    @Body() body: AiCampaignDto
  ) {
    return this._aiCampaignsService.createCampaign(org, body);
  }

  @Delete('/:id')
  deleteCampaign(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._aiCampaignsService.deleteCampaign(org.id, id);
  }

  @Put('/posts/:id')
  updatePost(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: AiCampaignPostDto
  ) {
    return this._aiCampaignsService.updatePost(org.id, id, body);
  }

  @Post('/posts/:id/approve')
  approvePost(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._aiCampaignsService.approvePost(org.id, id);
  }

  @Post('/posts/:id/reject')
  rejectPost(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._aiCampaignsService.rejectPost(org.id, id);
  }

  @Post('/posts/:id/regenerate-text')
  regenerateText(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._aiCampaignsService.regenerateText(org, id);
  }

  @Post('/posts/:id/regenerate-image')
  regenerateImage(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._aiCampaignsService.regenerateImage(org, id);
  }
}
