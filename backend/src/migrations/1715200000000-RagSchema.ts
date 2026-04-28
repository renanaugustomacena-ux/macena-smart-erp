import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M-025 — RAG chunk store (plan §31.2 Sprint 26 / S26.1).
 *
 * v1 stores embeddings as JSONB; M-026 (deferred) flips the column to
 * `vector(1536)` once the pgvector extension is enabled in the
 * production cluster + the HNSW index is built.
 */
export class RagSchema1715200000000 implements MigrationInterface {
  name = 'RagSchema1715200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "rag_source_type_enum" AS ENUM ('audit', 'customer', 'product', 'invoice', 'supplier_invoice')`,
    );
    await queryRunner.query(`
      CREATE TABLE "rag_chunks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "sourceType" rag_source_type_enum NOT NULL,
        "sourceId" varchar(200) NOT NULL,
        "body" text NOT NULL,
        "embedding" jsonb NULL,
        "contentHash" varchar(64) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_rag_chunks_tenantId" ON "rag_chunks" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rag_chunks_source" ON "rag_chunks" ("tenantId", "sourceType", "sourceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rag_chunks_source_only" ON "rag_chunks" ("tenantId", "sourceType")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "rag_chunks"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "rag_source_type_enum"`);
  }
}
