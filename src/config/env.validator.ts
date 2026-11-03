import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsString, IsUrl, Max, Min, MinLength, validateSync } from 'class-validator';

// 1. Разрешённые значения окружения — опечатка вроде "prod" не пройдёт
export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

// 2. Схема переменных окружения
export class Env {
  // = '...' — значение по умолчанию, если переменной нет в .env
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  // В .env это строка "3000" — превратится в число благодаря enableImplicitConversion ниже
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  // Без значения по умолчанию → обязательная переменная
  // require_tld: false — иначе "localhost" не считается валидным хостом
  @IsUrl({ protocols: ['postgresql', 'postgres'], require_tld: false })
  DATABASE_URL: string;

  // Минимум 32 символа — защита от слабых секретов вроде "secret"
  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET: string;

  // Формат "15m", "30d" — понимает @nestjs/jwt
  @IsString()
  JWT_ACCESS_TTL: string = '15m';

  @IsString()
  JWT_REFRESH_TTL: string = '30d';

  // Одна или несколько через запятую: "http://localhost:5173,https://admin.example.com"
  @IsString()
  CORS_ORIGIN: string;
}

// 3. Функция, которую вызывает ConfigModule при старте
export function validateEnv(config: Record<string, unknown>): Env {
  // Обычный объект из .env → экземпляр Env (с приведением типов по полям класса)
  const env = plainToInstance(Env, config, { enableImplicitConversion: true });

  // Проверяем все декораторы; отсутствующие поля тоже считаются ошибкой
  const errors = validateSync(env, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors.map(
      (e) => `  ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
    );
    throw new Error(`Invalid environment variables:\n${details.join('\n')}`);
  }

  return env;
}
