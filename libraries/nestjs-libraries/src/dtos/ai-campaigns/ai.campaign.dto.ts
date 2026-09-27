import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AiCampaignDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  themes: string[];

  @IsInt()
  @Min(1)
  @Max(30)
  quantity: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  integrations: string[];

  @IsDateString()
  @IsDefined()
  startDate: string;

  @IsInt()
  @Min(1)
  @Max(30)
  intervalDays: number;

  @IsString()
  @IsDefined()
  @MaxLength(40)
  language: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  tone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  instructions?: string;

  @IsBoolean()
  @IsDefined()
  generateImages: boolean;

  @IsIn(['post', 'story'])
  @IsOptional()
  instagramFormat?: 'post' | 'story';

  @IsIn(['premium', 'economy'])
  @IsOptional()
  aiModel?: 'premium' | 'economy';

  // Exact dates picked by the user (weekly planner), one per post, computed
  // in the browser so the user's timezone is respected
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(30)
  @IsDateString({}, { each: true })
  publishDates?: string[];
}

export class AiCampaignPostDto {
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  content?: string;

  @IsDateString()
  @IsOptional()
  publishDate?: string;
}
