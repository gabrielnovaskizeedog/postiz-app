import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsDefined,
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
