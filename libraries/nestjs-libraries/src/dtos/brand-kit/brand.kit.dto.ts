import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class BrandKitDto {
  @IsIn(['editorial', 'noturno', 'coral'])
  identity: string;

  @IsString()
  @MaxLength(60)
  name: string;

  @IsString()
  @MaxLength(40)
  handle: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  bio?: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  category?: string;

  @IsString()
  @IsOptional()
  avatarPath?: string;

  @IsIn(['curta', 'media', 'longa'])
  captionSize: string;

  @IsString()
  @MaxLength(80)
  captionTone: string;

  @IsInt()
  @Min(0)
  @Max(5)
  captionEmojis: number;

  @IsInt()
  @Min(0)
  @Max(10)
  captionHashtags: number;
}

export class BrandPhotoDto {
  @IsString()
  path: string;

  @IsString()
  @MaxLength(40)
  emotion: string;
}

export class BrandPhotoEmotionDto {
  @IsString()
  @MaxLength(40)
  emotion: string;
}
