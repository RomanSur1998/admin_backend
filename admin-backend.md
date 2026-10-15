# Neo Cafe — Backend Implementation Plan

Бэкенд для админ-панели сети кофеен **Neo Cafe** (текущий фронт: React 18 + Vite + Redux Toolkit,
`src/`). Документ описывает целевую реализацию бэкенда на **NestJS**, восстановленную из фронта
модель данных и API-контракт, а также порядок работ.

> Статус: план. Код ещё не написан. Открытые вопросы — в конце документа.

---

## 1. Назначение системы

Внутренняя CRM/панель управления для владельца и управляющих сети кофеен. Закрывает 4 бизнес-домена:

| Домен | Экран фронта | Содержание |
|---|---|---|
| **Меню** | `/menu` | CRUD позиций меню (фото, название, описание, категория, цена, состав с граммовкой) + CRUD категорий |
| **Склад** | `/stock` | CRUD остатков по филиалам (кол-во, ед. изм., категория, мин. лимит, дата прихода), список заканчивающихся позиций |
| **Филиалы** | `/branches` | CRUD точек (фото, адрес, телефон, 2ГИС, кол-во столиков, график работы) |
| **Сотрудники** | `/employers` | CRUD персонала (логин/пароль, имя, должность, дата рождения, email, филиал, график работы) |
| **Авторизация** | `/`, `/code` | Вход администратора; форма OTP-кода в UI есть, но не подключена |

Везде — пагинация (`number` + `size`), поиск по имени, паттерн «список + модалка создания/редактирования + модалка удаления».

**Не входит в scope v1:** сущность «Заказ»/«Продажа» (POS/касса) — решение отложено, см. открытые вопросы.

---

## 2. Восстановленная модель данных

Извлечена из `src/api/api.js`, `src/redux/slices/DataSlice.js` и модалок `src/components/Modal/*`.

### Category
- `name: string` (уникальное)

### MenuItem
- `name: string`
- `description: string`
- `category: Category` (ссылка)
- `price: number`
- `image: file` → хранится URL
- `compositions: { name: string; quantity: number; unit: 'мл'|'кг'|'гр'|'шт' }[]`

### WarehouseItem
- `name: string`
- `quantity: number`
- `unit: 'мл'|'кг'|'гр'|'шт'`
- `category: 'готовая продукция'|'сырьё'`
- `minimalLimit: number` — порог для алерта «заканчивается»
- `dateOfArrival: date`
- `branch: Branch` (ссылка)

### Branch (в текущем API — `filial`)
- `name: string`
- `address: string`
- `phone: string`
- `gisUrl: string` — ссылка на 2ГИС
- `tableAmount: number` — кол-во столиков
- `image: file` → URL
- `workDays: { day: string; checked: boolean; from: string; to: string }[]`

### Staff (в текущем API — `stuff`)
- `login: string` (уникальное)
- `password: string` → хранится только hash, **в ответах не отдаётся**
- `name: string`
- `position: 'официант'|'бармен'|'админ'`
- `birthday: date`
- `email: string`
- `branch: Branch` (ссылка)
- `workDays: { day; checked; from; to }[]`

### Auth
- `admin-login: { identifier: string; password: string }` → `{ accessToken, refreshToken }`
- `refresh-token` → новая пара токенов

---

## 3. Восстановленный REST-контракт (текущий фронт ждёт именно это)

Пути сохраняем 1-в-1, чтобы переключить существующий фронт заменой константы `API` в
`src/constants/url.js` без переписывания клиента. Явно помеченные пункты — нормализуем.

```
POST   /api/v1/auth/admin-login
POST   /api/v1/auth/refresh-token

GET    /api/v1/category/all
POST   /api/v1/category/add
DELETE /api/v1/category/delete/:name        # ⚠ удаление по имени → нормализовать на :id

GET    /api/v1/menu/all?number=&size=
GET    /api/v1/menu/find-by-name/:q?number=&size=
POST   /api/v1/menu                          # multipart: file + file_json (JSON-строка)
PUT    /api/v1/menu/update/:id               # multipart
DELETE /api/v1/menu?id=                      # ⚠ id в query → перенести в путь

GET    /api/v1/warehouse/category/:category?number=&size=
GET    /api/v1/warehouse/out-stock?number=&size=
GET    /api/v1/warehouse/find/:q?number=&size=
POST   /api/v1/warehouse
PUT    /api/v1/warehouse/update/:id
DELETE /api/v1/warehouse/:id

GET    /api/v1/filial/all?number=&size=
GET    /api/v1/filial/all-names
GET    /api/v1/filial/find/:q?number=&size=
POST   /api/v1/filial/save                   # multipart
PUT    /api/v1/filial/update/:id             # multipart
DELETE /api/v1/filial/delete/:id

GET    /api/v1/stuff/all?number=&size=
GET    /api/v1/stuff/find/:q?number=&size=
POST   /api/v1/stuff/save
PUT    /api/v1/stuff/update/:id
DELETE /api/v1/stuff/delete/:id
```

### Форматы ответа (из `DataSlice.js`)
- Списки: `{ data: { responses: T[], allCount: number } }` — сохраняем, либо оборачиваем в
  единый конверт `{ content, totalElements, totalPages, number, size }` (предпочтительно; тогда
  фронт правится в одном месте — маппер).
- `category/all`, `filial/all-names` — плоский массив.

---

## 4. Технологический стек

| Слой | Выбор | Обоснование |
|---|---|---|
| Фреймворк | **NestJS** (Express-адаптер) | модульность, DI, guards/interceptors из коробки |
| БД | **PostgreSQL** | реляционная модель с чёткими связями |
| ORM | **Prisma** | типобезопасность, миграции по diff схемы; `$queryRaw` как escape hatch для сложных запросов. Отказ от ORM рассматривался — не оправдан на 6 сущностях с простым CRUD |
| Auth | `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `passport-local` | стандарт для Nest |
| Хэш паролей | **argon2** (argon2id) | устойчивее bcrypt к GPU-брутфорсу (OWASP) |
| Валидация | `class-validator`, `class-transformer` | DTO как источник правды, замена yup-схем фронта |
| Rate limiting | `@nestjs/throttler` (+ Redis-storage) | защита `/auth/login` от брутфорса |
| Конфиг | `@nestjs/config` + **zod** | падать на старте при отсутствии env, а не в рантайме |
| Файлы | `multer` + **Cloudinary** (или S3-совместимое) | фото меню и филиалов; выбор провайдера — открытый вопрос |
| Email | provider SDK (Resend/SendGrid) | reset-password, OTP (если включаем 2FA) |
| Документация | `@nestjs/swagger` | самодокументируемый контракт + генерация типов для фронта |
| Безопасность | `helmet` | security-заголовки |
| Логи/ошибки | `nestjs-pino` + `@sentry/node` | структурные логи + трекинг необработанных исключений |
| Тесты | `jest` (в комплекте) + `supertest` | unit + e2e |

---

## 5. Архитектура

**Модульный монолит.** Один деплоюмый Nest-процесс, границы модулей = bounded contexts.

- **Не микросервисы** — одна команда, 6 связанных доменов, общий `Branch` как FK, нет требований к
  независимому масштабированию. Межсервисные транзакции ради `JOIN` — оверинжиниринг.
- **Не полный DDD/hexagonal** — бизнес-логика тонкая (CRUD + пара вычисляемых правил). Отдельные
  Use Case / Port / Adapter слои не окупаются. Исключение — `auth` (ротация токенов, reuse-detection):
  выносится в отдельный сервис-класс, тестируемый без HTTP.
- **Не CQRS** — модель чтения = модель записи, event sourcing не нужен.

Внутри модуля: `Controller` (HTTP + DTO) → `Service` (бизнес-правила + вызов Prisma) → `PrismaService`.

Путь эволюции: чёткие границы модулей позволяют позже вырезать сервис (например, real-time
warehouse-алерты в отдельный сервис с очередью), если появится доказанная необходимость.

---

## 6. Структура папок

```
backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                    # bootstrap первого SUPER_ADMIN + dev-данные
│
├── src/
│   ├── main.ts                    # helmet, ValidationPipe, Swagger, CORS, global filters/interceptors
│   ├── app.module.ts
│   │
│   ├── config/
│   │   └── env.schema.ts          # zod-схема env, валидация при старте
│   │
│   ├── prisma/
│   │   ├── prisma.module.ts       # @Global()
│   │   └── prisma.service.ts
│   │
│   ├── common/
│   │   ├── decorators/            # @CurrentUser, @Roles, @Public
│   │   ├── guards/                # JwtAuthGuard, RolesGuard
│   │   ├── interceptors/          # response-конверт, logging
│   │   ├── filters/               # HttpExceptionFilter — единый формат ошибок
│   │   ├── pipes/                 # PaginationPipe: number/size → skip/take
│   │   └── dto/                   # PaginationQueryDto
│   │
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts     # login, refresh, logout, logout-all
│   │   ├── auth.service.ts
│   │   ├── strategies/            # local, jwt-access, jwt-refresh
│   │   ├── refresh-tokens/
│   │   │   └── refresh-token.service.ts   # ротация + reuse-detection
│   │   ├── password-reset/
│   │   │   ├── password-reset.controller.ts
│   │   │   └── password-reset.service.ts
│   │   ├── dto/                   # login.dto, refresh.dto, change-password.dto
│   │   └── auth.service.spec.ts
│   │
│   ├── categories/               # module / controller / service / dto
│   ├── menu/                     # + dto/composition-item.dto.ts, транзакционная запись состава
│   ├── warehouse/               # + логика out-of-stock (quantity <= minimalLimit)
│   ├── branches/                # + dto/work-day.dto.ts
│   ├── staff/                   # + хэш пароля, exclude passwordHash из ответов
│   └── uploads/
│       ├── uploads.module.ts
│       └── uploads.service.ts    # обёртка над Cloudinary/S3, инжектится в menu и branches
│
├── test/
│   ├── jest-e2e.json
│   ├── auth.e2e-spec.ts
│   └── menu.e2e-spec.ts
│
├── .env.example
├── docker-compose.yml            # Postgres + Redis для локальной разработки
├── nest-cli.json
├── tsconfig.json
├── package.json
└── README.md
```

Внутримодульный паттерн одинаков для всех доменных модулей (то, что генерирует `nest g resource`).
`.spec.ts` — рядом с файлом; `test/` в корне — только e2e (поднимают весь app + тестовую БД).

---

## 7. Prisma-схема (черновик)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  SUPER_ADMIN
  BRANCH_ADMIN
}

enum StaffPosition {
  WAITER
  BARMAN
  ADMIN
}

enum Unit {
  ML   // мл
  KG   // кг
  G    // гр
  PCS  // шт
}

enum WarehouseCategory {
  READY  // готовая продукция
  RAW    // сырьё
}

model Admin {
  id             String         @id @default(uuid())
  email          String         @unique
  passwordHash   String
  role           Role           @default(SUPER_ADMIN)
  branchId       String?        // null для SUPER_ADMIN
  branch         Branch?        @relation(fields: [branchId], references: [id])
  failedAttempts Int            @default(0)
  lockedUntil    DateTime?
  refreshTokens  RefreshToken[]
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
}

model RefreshToken {
  id           String   @id @default(uuid())
  tokenHash    String   @unique          // sha256 от выданного токена
  adminId      String
  admin        Admin    @relation(fields: [adminId], references: [id], onDelete: Cascade)
  userAgent    String?
  ip           String?
  revoked      Boolean  @default(false)
  replacedById String?                   // id токена-преемника при ротации
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  @@index([adminId])
}

model PasswordResetToken {
  id        String    @id @default(uuid())
  tokenHash String    @unique
  adminId   String
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
}

model AuditLog {
  id         String   @id @default(uuid())
  actorId    String?
  action     String   // "branch.delete", "menu.update", ...
  entityType String
  entityId   String?
  metadata   Json?
  ip         String?
  createdAt  DateTime @default(now())

  @@index([actorId])
  @@index([entityType, entityId])
}

model Category {
  id        String     @id @default(uuid())
  name      String     @unique
  menuItems MenuItem[]
  createdAt DateTime   @default(now())
}

model MenuItem {
  id           String        @id @default(uuid())
  name         String
  description  String?
  price        Decimal       @db.Decimal(10, 2)
  imageUrl     String?
  categoryId   String
  category     Category      @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  compositions Composition[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@index([categoryId])
  @@index([name])
}

model Composition {
  id         String   @id @default(uuid())
  name       String
  quantity   Decimal  @db.Decimal(10, 2)
  unit       Unit
  menuItemId String
  menuItem   MenuItem @relation(fields: [menuItemId], references: [id], onDelete: Cascade)

  @@index([menuItemId])
}

model Branch {
  id          String          @id @default(uuid())
  name        String
  address     String
  phone       String
  gisUrl      String?
  imageUrl    String?
  tableAmount Int             @default(0)
  workDays    Json            // WorkDay[]: { day, checked, from, to }
  warehouse   WarehouseItem[]
  staff       Staff[]
  admins      Admin[]
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([name])
}

model WarehouseItem {
  id            String            @id @default(uuid())
  name          String
  quantity      Decimal           @db.Decimal(10, 2)
  unit          Unit
  category      WarehouseCategory
  minimalLimit  Decimal           @db.Decimal(10, 2)
  dateOfArrival DateTime
  branchId      String
  branch        Branch            @relation(fields: [branchId], references: [id], onDelete: Cascade)
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  @@index([branchId])
  @@index([name])
}

model Staff {
  id           String        @id @default(uuid())
  login        String        @unique
  passwordHash String
  name         String
  position     StaffPosition
  birthday     DateTime?
  email        String?
  branchId     String
  branch       Branch        @relation(fields: [branchId], references: [id], onDelete: Cascade)
  workDays     Json          // WorkDay[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@index([branchId])
  @@index([name])
}
```

Улучшения относительно текущего контракта:
- `unit` / `category` / `position` — enum вместо свободной строки.
- `out-stock` — вычисляется (`quantity <= minimalLimit`), без отдельной таблицы.
- `passwordHash` никогда не попадает в DTO ответа (сейчас фронт `NewEmployer` подсовывает пароль в форму — так делать нельзя).
- `dateOfArrival` — реальный `DateTime`, а не строка `дд.мм.гг`.

---

## 8. Аутентификация — регистрация и логин

### Регистрация
Публичной self-service регистрации **нет и не будет** — это внутренняя админка.

1. **Admin (SUPER_ADMIN)** — создаётся `prisma/seed.ts` при первом деплое либо разовой CLI-командой.
   Публичного `POST /auth/register` не существует.
2. **Staff** — создаётся уже залогиненным админом через `POST /stuff/save`. Это «регистрация»
   сотрудника, инициированная админом; токены при этом не выдаются.

### Login (пошагово)

```
POST /api/v1/auth/admin-login  { identifier, password }
```
1. `ThrottlerGuard` — лимит попыток по IP (например, 5/мин) до проверки пароля.
2. `LocalStrategy` → `AuthService.validateAdmin(identifier, password)`:
    - поиск `Admin` по email/логину;
    - если `lockedUntil > now` → `423 Locked`;
    - `argon2.verify(passwordHash, password)`;
    - неудача → `failedAttempts++`, при достижении порога `lockedUntil = now + 15m`, ответ `401`;
    - успех → `failedAttempts = 0`.
3. `AuthService.issueTokens(admin)`:
   ```
   accessToken  = jwt.sign({ sub: admin.id, role: admin.role, branchId: admin.branchId },
                           ACCESS_SECRET, { expiresIn: '15m' })
   refreshToken = randomBytes(64).hex
   → RefreshToken.create({ tokenHash: sha256(refreshToken), adminId, expiresAt: now + 30d,
                           userAgent, ip })
   ```
4. Ответ `200 { accessToken, refreshToken }` — формат совпадает с тем, что ждёт текущий фронт
   (`api.authorization` в `src/api/api.js`).

### Авторизованный запрос
```
Authorization: Bearer <accessToken>
```
`JwtAccessStrategy` проверяет подпись + `exp` → кладёт `{ sub, role, branchId }` в `request.user`.
Глобальный `JwtAuthGuard` пропускает (кроме роутов с `@Public()`), `RolesGuard` проверяет `@Roles(...)`.

### Refresh (с ротацией и reuse-detection)
```
POST /api/v1/auth/refresh-token  { refreshToken }
```
> Убираем захардкоженный `email: "admin@gmail.com"` из текущего `configAxios.js` — идентификация
> строго по самому токену.

1. `hash = sha256(refreshToken)` → поиск в `RefreshToken`.
2. Не найдено / `expiresAt < now` → `401`.
3. `revoked === true` (токен уже использовался) → **сигнал кражи**: отозвать все токены этого
   `adminId`, ответ `401` (форс релогин).
4. Валидно → пометить запись `revoked = true, replacedById = <new>`, выпустить новую пару (как в login).

### Logout
```
POST /api/v1/auth/logout       { refreshToken }   → revoked = true для этой записи
POST /api/v1/auth/logout-all   (по access-токену) → revoked = true для всех записей adminId
```

### Password reset (для Staff, если понадобится self-login)
```
POST /api/v1/auth/forgot-password  { email }        → одноразовый токен на email (TTL 15–30 мин)
POST /api/v1/auth/reset-password    { token, newPassword }
                                                     → новый hash + revoke всех refresh-токенов
```

### 2FA (OTP) — опционально
UI-заготовка `CodeForm` есть. Если включаем: `login` при включённой 2FA возвращает
`{ requires2FA: true, challengeId }`, затем `POST /auth/verify-otp { challengeId, code }` выдаёт токены.
Код — 4 цифры, TTL 5 мин, ≤3 попыток, хранится хэшированным (Redis). По умолчанию — **отложено на v2**.

---

## 9. Авторизация (RBAC + scoping по филиалу)

Модель: **RBAC + resource scoping**, не чистый RBAC и не ABAC/CASL (последнее — оверинжиниринг для 2 ролей).

### Роли
| Роль | Доступ |
|---|---|
| `SUPER_ADMIN` | всё: меню, категории, все филиалы, весь персонал, весь склад |
| `BRANCH_ADMIN` | только свой филиал: его склад, его персонал, данные своего филиала. Меню/категории — **read-only** (они общие на сеть) |

Обоснование scoping: `WarehouseItem` и `Staff` привязаны к `branchId`; `MenuItem`/`Category` — нет
(меню общее). Значит склад/персонал/филиал — филиал-scoped, меню/категории — сетевые.

### Принципы
1. **Deny by default** — роут без `@Roles(...)` доступен только `SUPER_ADMIN`; без токена — только роуты с `@Public()`.
   Забытый декоратор сужает доступ, а не открывает его.
2. **Scoping из токена, не из запроса** — `branchId` берётся из `request.user`, а не из body/query.
3. **Фильтр на уровне БД** — `where: { branchId }` в самом Prisma-запросе, не постфактум в контроллере.
4. **Least privilege** — роль получает минимум; не плодить «админ может всё».
5. **Централизация** — правило «может ли user трогать этот branchId» в одном guard/helper, не копипастой.
6. **Auditability** — отказы (`403`) и мутации пишутся в `AuditLog`.
7. **Fail-safe** — нет `branchId` там, где нужен scoping → запрет, не «можно всё».

### Реализация
```ts
// JWT payload: { sub, role, branchId }

@Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
@Get()
findAll(@CurrentUser() user: JwtUser) {
  const scope = user.role === 'SUPER_ADMIN' ? undefined : user.branchId;
  return this.staffService.findAll(scope);   // scoping внутри сервиса
}
```
```ts
// staff.service.ts
findAll(branchId?: string) {
  return this.prisma.staff.findMany({ where: branchId ? { branchId } : {} });
}
```
CASL/ABAC вводится только если появится матрица вида «менеджер видит склад, но не зарплаты» — не раньше.

### Итерации внедрения

| Итерация | Когда | Что даёт |
|---|---|---|
| **RBAC-1. Фундамент** | вместе с AuthModule (v1) | роль и филиал в данных и токене, глобальные `AuthGuard` + `RolesGuard`, deny by default |
| **RBAC-2. BRANCH_ADMIN** | v3a, вместе со складом/персоналом по филиалам | управление админами, `@Roles` на роутах, scoping по `branchId` в сервисах |
| **RBAC-3. Аудит** | v3a, сразу после RBAC-2 | `AuditLog` для мутаций, входов и отказов `403` |
| **RBAC-4. Расширения** | по запросу | настраиваемые permissions, вход для `Staff` (официант/бармен) |

#### RBAC-1. Фундамент

Цель: вся система закрыта по умолчанию, у каждого запроса есть типизированный `user` с ролью и филиалом.
Реально существует только `SUPER_ADMIN`, но механизм проверки ролей уже работает и покрыт тестами.

Состав:
- **Схема:** `enum Role { SUPER_ADMIN, BRANCH_ADMIN }`, `Admin.role @default(SUPER_ADMIN)`, `Admin.branchId?`.
- **JWT payload:** `{ sub, role, branchId }` — выдаётся в `AuthService.issueTokens`.
- **`src/common/`:**
  - `types/jwt-user.ts` — `JwtUser = { sub: string; role: Role; branchId: string | null }`;
  - `decorators/public.decorator.ts` — `@Public()`;
  - `decorators/roles.decorator.ts` — `@Roles(...roles)`;
  - `decorators/current-user.decorator.ts` — `@CurrentUser()`;
  - `guards/auth.guard.ts` — проверка Bearer-токена → `req.user`, иначе `401`;
  - `guards/roles.guard.ts` — нет `@Roles` → только `SUPER_ADMIN`; роль не подходит → `403`.
- **Регистрация:** оба guard через `APP_GUARD` в `AuthModule`, порядок: `AuthGuard` → `RolesGuard`.
- **Публичные роуты:** `POST /auth/admin-login`, `POST /auth/refresh-token`, `GET /health`.

Не входит: создание `BRANCH_ADMIN`, scoping в сервисах, аудит.

Готово, когда:
- запрос без токена на любой непубличный роут → `401`;
- unit-тесты `RolesGuard`: `@Public` пропускает; без `@Roles` пропускает `SUPER_ADMIN` и отклоняет `BRANCH_ADMIN`;
  с `@Roles('BRANCH_ADMIN')` пропускает `BRANCH_ADMIN`;
- e2e: login → запрос с токеном → `200`; без токена → `401`.

#### RBAC-2. BRANCH_ADMIN

- `AdminsModule`: CRUD админов (только `SUPER_ADMIN`), у `BRANCH_ADMIN` `branchId` обязателен.
- `@Roles(...)` на всех роутах по матрице из таблицы «Роли»; меню и категории для `BRANCH_ADMIN` — только `GET`.
- Helper `branchScope(user)`: `SUPER_ADMIN` → `undefined` (вся сеть), `BRANCH_ADMIN` → свой `branchId`,
  `BRANCH_ADMIN` без `branchId` → `403` (fail-safe).
- Сервисы склада, персонала и филиалов принимают `branchId?` и фильтруют в Prisma-запросе;
  чужой объект по `id` → `404`.
- Смена роли или филиала, блокировка админа → отзыв всех его refresh-токенов.
- e2e-матрица: каждая роль × каждый модуль × свой/чужой филиал.

#### RBAC-3. Аудит

- Модель `AuditLog` (раздел 7), `AuditService.log(...)`.
- Запись: все мутации, проведение и отмена документов, входы (успешные и нет), отказы `403`.
- Только добавление: API для изменения и удаления записей нет; просмотр — только `SUPER_ADMIN`.

#### RBAC-4. Расширения (по запросу)

- Настраиваемые роли: `Permission` + `RolePermission`, `@Roles` → `@RequirePermission('stock:write')`.
- Вход для `Staff`: отдельный тип субъекта в токене (`kind: 'admin' | 'staff'`) и свои роли.

---

## 10. Модули

| Модуль | Зачем | Ответственность |
|---|---|---|
| `PrismaModule` (`@Global`) | единый доступ к БД | `PrismaService` |
| `ConfigModule` | валидация env на старте | zod-схема |
| `AuthModule` | периметр безопасности всего API | login, refresh-ротация, logout, guards, strategies, password-reset |
| `CategoriesModule` | отдельная сущность, зависимость `MenuModule` | CRUD категорий |
| `MenuModule` | центральная сущность | CRUD + upload фото + транзакционная запись `compositions` |
| `BranchesModule` | FK-цель для `Warehouse` и `Staff` — создаётся раньше них | CRUD филиалов, `workDays` |
| `WarehouseModule` | склад, правило out-of-stock | CRUD + `quantity <= minimalLimit` |
| `StaffModule` | персонал, отдельно от `Admin` | CRUD, хэш пароля, exclude `passwordHash` |
| `UploadsModule` | общая логика файлов для `Menu` и `Branches` | Cloudinary/S3 клиент, валидация mime/размера |

Порядок реализации по зависимостям: `Auth` → `Categories` + `Branches` → `Menu` → `Warehouse` + `Staff`.

---

## 11. Сквозные механизмы

### Пагинация
`PaginationPipe`: `?number=&size=` → `{ skip, take }`. Единый конверт ответа для списков:
```json
{ "content": [], "totalElements": 0, "totalPages": 0, "number": 1, "size": 5 }
```

### Формат ошибок
`HttpExceptionFilter` → `{ statusCode, message, error, timestamp, path }` для всех ответов ≥ 400.

### Валидация
Глобальный `ValidationPipe({ whitelist: true, transform: true })`. DTO с `class-validator` — зеркало
yup-схем фронта (`src/helpers/validationShemas.js`), но источник правды — бэкенд.

### Файлы (multipart)
Текущий контракт: `file` + `file_json` (JSON-строка). В Nest: `FileInterceptor('file')` +
`@Body('file_json')` → `JSON.parse` → валидация через DTO вручную. Ограничения: whitelist mime
(`image/jpeg|png|webp`), лимит размера (`multer limits.fileSize`). Файл форвардится в `UploadsService`
без чтения в память целиком.

### Soft-delete
Для `Category` / `MenuItem`, которые могут быть использованы в исторических данных — рассмотреть
`deletedAt` вместо физического удаления. Решение — при реализации `MenuModule`.

---

## 12. Переменные окружения

```
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
REDIS_URL=
STORAGE_PROVIDER=cloudinary
CLOUDINARY_URL=                 # или AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_S3_BUCKET
EMAIL_API_KEY=
EMAIL_FROM=
CORS_ORIGIN=
PORT=3000
NODE_ENV=development
```
Валидируются zod-схемой в `src/config/env.schema.ts` — сервис не стартует при отсутствии переменной.

---

## 13. Инфраструктура

| Компонент | Вариант | Назначение |
|---|---|---|
| PostgreSQL | Railway Postgres / Neon / Supabase | основная БД |
| Redis | Railway Redis / Upstash | throttler-storage, OTP-коды с TTL, blacklist токенов |
| Файловое хранилище | Cloudinary (free tier, resize/CDN) или S3-совместимое | фото меню и филиалов |
| Email | Resend / SendGrid / Postmark | reset-password, OTP |
| Hosting | Railway (там же, где текущий бэк `neo-cafe.up.railway.app`) | сервисы `core-api` + `postgres` (+ `redis`) |

Окружения: **dev / staging / prod** — три набора env, три БД. Staging обязателен: миграции
проверяются там до прода.

---

## 14. CI/CD

```
PR:            lint (eslint) → typecheck (tsc --noEmit) → unit-тесты → e2e (тестовая БД в CI) → build
merge в main:  prisma migrate deploy → deploy на Railway
```
Green CI — обязательное условие мержа в `main`. Полезный guard-тест: модуль не импортирует
Prisma-модели чужого домена напрямую (защита границ модулей).

---

## 15. Тестовая стратегия

| Уровень | Что покрывает | Примеры |
|---|---|---|
| Unit | `*.service.ts` с замоканным `PrismaService` | out-of-stock, ротация refresh-токена, reuse-detection, lockout |
| e2e | весь HTTP-путь на тестовой БД | login → refresh → CRUD happy path; 401 без токена; 403 не своей роли/филиала |
| Не тестируем | DTO-валидацию `class-validator` (фреймворковая) | — |

`auth/` и `common/pipes/` — близко к 100% покрытия (ошибка роняет весь бэкенд).

---

## 16. Наблюдаемость

- `GET /health` — пинг Postgres; нужен Railway для health-check перед переключением трафика.
- `nestjs-pino` — структурные JSON-логи (не `console.log`).
- `@sentry/node` — необработанные исключения.
- Не на старте: OpenTelemetry/APM (оправдан при нескольких сервисах).

---

## 17. Security-чеклист (проход перед первым релизом)

- [ ] `ThrottlerGuard` на `/auth/login`
- [ ] Lockout аккаунта после N неудачных попыток
- [ ] argon2id для паролей; `passwordHash` не в ответах
- [ ] Refresh-токены: хэш в БД, ротация, reuse-detection, `logout` / `logout-all`
- [ ] Валидация загружаемых файлов: whitelist mime + лимит размера
- [ ] Санитайзинг `file_json` перед `JSON.parse` (обёрнуть в try/catch, валидировать DTO)
- [ ] Жёсткий CORS allowlist (`CORS_ORIGIN`)
- [ ] `helmet`
- [ ] Секреты только в Railway variables; политика ротации JWT-секретов задокументирована
- [ ] `npm audit` / Dependabot в CI
- [ ] Scoping по `branchId` берётся из токена, не из запроса
- [ ] `AuditLog` на мутации и отказы доступа

---

## 18. Порядок реализации

1. **Bootstrap** — `nest new`, Prisma init, zod env-валидация, `docker-compose` (Postgres + Redis),
   `main.ts` (helmet, ValidationPipe, Swagger, CORS), `/health`.
2. **AuthModule** — login, refresh с ротацией + reuse-detection, argon2, throttler, lockout,
   logout / logout-all. Без 2FA и password-reset на первой итерации (если отложены).
3. **CategoriesModule + MenuModule** — CRUD, вложенные `compositions` (транзакция), upload фото.
4. **BranchesModule** — CRUD, `workDays`, upload фото.
5. **WarehouseModule** — CRUD, `out-stock`, scoping по филиалу.
6. **StaffModule** — CRUD, хэш пароля, scoping по филиалу.
7. **Пагинация/поиск** — вынести общий helper, применить во всех модулях.
8. **Сшивка с текущим фронтом** — заменить `API` в `src/constants/url.js`, прогнать все экраны.
   *Рабочий продукт уже на этом шаге.*
9. **e2e-тесты** — auth + happy-path CRUD.
10. **Деплой на Railway** + миграции в CI.

Переезд фронта на Next.js + BFF / TanStack Query / Zustand — **отдельный трек после шага 8**,
не блокирует первый релиз.

---

## 19. Открытые вопросы

1. **Модуль «Заказ» (Order/Sale).** В текущей модели отсутствует сущность, связывающая меню, склад,
   филиалы и выручку. Заказы обрабатываются отдельной POS-системой (вне scope) или должны быть частью
   этого бэкенда? От ответа зависит, нужны ли `Order` / `OrderItem` / статусы оплаты и списание
   склада по составу блюда.
2. **`BRANCH_ADMIN` в v1 или только `SUPER_ADMIN`.** Сейчас логинится один `admin-login` без привязки
   к филиалу. Закладывать вторую роль сразу или оставить `role`/`branchId` в токене как задел без
   реальной второй роли?
3. **Staff self-login.** Официант/бармен логинятся куда-либо (будущее мобильное приложение) или
   `Staff` — только справочник для графиков? Влияет на ширину RBAC.
4. **2FA (OTP) и password-reset — v1 или v2.** UI-заготовка `CodeForm` есть, backend-контракт можно
   заложить сейчас, включить требование позже.
5. **Файловое хранилище** — Cloudinary или S3-совместимое (влияет на `UploadsService` и env).
6. **Миграция данных.** Есть ли реальные данные в текущем бэке `neo-cafe.up.railway.app`, которые
   нужно перенести, или схема с нуля?

---

## 20. Architecture Decision Records (кратко)

| # | Решение | Почему |
|---|---|---|
| 001 | Модульный монолит, не микросервисы | одна команда, 6 связанных доменов, нет требований к раздельному масштабированию |
| 002 | Prisma, не raw SQL / query builder | 6 сущностей, простой CRUD; `$queryRaw` покрывает редкие сложные запросы |
| 003 | RBAC + scoping по `branchId`, не CASL/ABAC | 2 роли, один scope-параметр; ABAC — оверинжиниринг |
| 004 | Пути API 1-в-1 с текущим фронтом | переключение заменой одной константы, без переписывания клиента |
| 005 | Order вне scope v1 | решение отложено; сущности спроектированы независимо, расширение недорогое |
| 006 | 2FA / password-reset отложены на v2 | не блокируют первый релиз; контракт закладывается заранее |
