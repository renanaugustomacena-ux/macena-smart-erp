import { ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * TypeORM configuration.
 *
 * Migration-first:
 *   - Dev (NODE_ENV !== 'production' and DB_SYNCHRONIZE !== 'false'):
 *     `synchronize: true` for ergonomic local iteration.
 *   - Prod (NODE_ENV === 'production' OR DB_SYNCHRONIZE === 'false'):
 *     synchronize OFF, `migrationsRun = true` so the migrations in
 *     `dist/migrations/` are applied on boot.
 *
 * The `migrations` glob targets BOTH the compiled dist output and the
 * source `.ts` files, so `npm run migration:run` works in development
 * using ts-node and the deployed container uses the compiled JS.
 */
export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProd = nodeEnv === 'production';
  const syncEnv = configService.get<string>('DB_SYNCHRONIZE');
  // Default: synchronize ON in non-prod, OFF in prod. Operator can force
  // OFF in staging by setting DB_SYNCHRONIZE=false.
  const synchronize = syncEnv === 'false' ? false : !isProd;

  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string>('DB_USERNAME', 'smarterp'),
    password: configService.get<string>('DB_PASSWORD', 'smarterp_dev_pass'),
    database: configService.get<string>('DB_NAME', 'smarterp'),
    schema: configService.get<string>('DB_SCHEMA', 'public'),

    autoLoadEntities: true,
    synchronize,

    extra: {
      max: configService.get<number>('DB_POOL_MAX', 20),
      min: configService.get<number>('DB_POOL_MIN', 5),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    },

    logging:
      nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error'],

    ssl: isProd
      ? {
          rejectUnauthorized: configService.get<boolean>(
            'DB_SSL_REJECT_UNAUTHORIZED',
            true,
          ),
          ca: configService.get<string>('DB_SSL_CA'),
        }
      : false,

    migrations: [
      'dist/migrations/*.js',
      __dirname + '/../migrations/*.{js,ts}',
    ],
    migrationsTableName: 'typeorm_migrations',
    migrationsRun: configService.get<string>('DB_RUN_MIGRATIONS', 'false') === 'true' || isProd,

    retryAttempts: configService.get<number>('DB_RETRY_ATTEMPTS', 3),
    retryDelay: configService.get<number>('DB_RETRY_DELAY', 3000),
  };
};

/**
 * Standalone DataSource exported for the `typeorm` CLI (`migration:generate`,
 * `migration:run`, `migration:revert`). Reads env directly because the Nest
 * DI container is not available in CLI context.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'smarterp',
  password: process.env.DB_PASSWORD ?? 'smarterp_dev_pass',
  database: process.env.DB_NAME ?? 'smarterp',
  schema: process.env.DB_SCHEMA ?? 'public',
  entities: [__dirname + '/../**/*.entity.{js,ts}'],
  migrations: [__dirname + '/../migrations/*.{js,ts}'],
  migrationsTableName: 'typeorm_migrations',
} as DataSourceOptions);
