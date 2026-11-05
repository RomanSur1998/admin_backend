import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value.trim().toLocaleLowerCase();
    }
    return value;
  })
  @IsEmail()
  identifier: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
