import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class AiCarouselDto {
  @IsIn(['link', 'trend'])
  source: 'link' | 'trend';

  @ValidateIf((o) => o.source === 'link')
  @IsUrl({ require_protocol: true })
  url?: string;

  @ValidateIf((o) => o.source === 'trend')
  @IsString()
  @MaxLength(120)
  theme?: string;

  @IsInt()
  @Min(4)
  @Max(10)
  slides: number;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  audience?: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  category?: string;

  @IsString()
  @MaxLength(40)
  language: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  integrations: string[];

  @IsDateString()
  publishDate: string;

  @IsIn(['premium', 'economy'])
  @IsOptional()
  aiModel?: 'premium' | 'economy';
}

export class AiCarouselHookDto {
  @IsString()
  @MaxLength(160)
  hook: string;
}

export class AiCarouselReviseDto {
  @IsString()
  @MaxLength(600)
  instruction: string;
}

export class AiCarouselUpdateDto {
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  caption?: string;

  @IsDateString()
  @IsOptional()
  publishDate?: string;
}
