-- ==============================================================================
-- Log Pose Terminal: Supabase Database Migration & Backend Schema Alignment
-- Migration Script: scripts/migrations/001_backend_schema_migration.sql
-- ==============================================================================
-- NOTE: Do NOT execute automatically. Review this script carefully and execute in
-- the Supabase SQL Editor dashboard.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Backup Existing Tables
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'forecast_run') THEN
        CREATE TABLE IF NOT EXISTS public.backup_forecast_run AS
        SELECT * FROM public.forecast_run;
        RAISE NOTICE 'Backed up public.forecast_run into public.backup_forecast_run';
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'forecast_point') THEN
        CREATE TABLE IF NOT EXISTS public.backup_forecast_point AS
        SELECT * FROM public.forecast_point;
        RAISE NOTICE 'Backed up public.forecast_point into public.backup_forecast_point';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. Clean Up Synthetic Mock Data
-- ------------------------------------------------------------------------------
-- The browser mock engine previously inserted simulated runs and settled them
-- against synthetic prices. We remove these before aligning the schema.
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'forecast_point') THEN
        DELETE FROM public.forecast_point
        WHERE forecast_run_id IN (
            SELECT id FROM public.forecast_run
            WHERE is_seeded_demo = TRUE
               OR anchor_date < '2026-11-01'
               OR confidence_metadata->>'is_seeded_demo' = 'true'
        );
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'forecast_run') THEN
        DELETE FROM public.forecast_run
        WHERE is_seeded_demo = TRUE
           OR anchor_date < '2026-11-01'
           OR confidence_metadata->>'is_seeded_demo' = 'true';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. Create or Align Backend Tables Matching SQLModel Schema
-- ------------------------------------------------------------------------------

-- (a) model_version
CREATE TABLE IF NOT EXISTS public.model_version (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(16) NOT NULL,
    version_tag VARCHAR(64) NOT NULL,
    methodology_name VARCHAR(128) NOT NULL,
    trained_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    train_start_date DATE NOT NULL,
    train_end_date DATE NOT NULL,
    horizon_days INTEGER NOT NULL DEFAULT 5,
    walk_forward_mae DOUBLE PRECISION NOT NULL,
    walk_forward_rmse DOUBLE PRECISION NOT NULL,
    directional_accuracy DOUBLE PRECISION NOT NULL,
    empirical_coverage_80 DOUBLE PRECISION NOT NULL,
    empirical_coverage_95 DOUBLE PRECISION,
    mpiw_80_atr DOUBLE PRECISION,
    artifact_path TEXT NOT NULL,
    notebook_hash VARCHAR(128) NOT NULL,
    metrics_json JSONB,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_ticker_version UNIQUE (ticker, version_tag)
);
CREATE INDEX IF NOT EXISTS ix_model_version_ticker ON public.model_version (ticker);
CREATE INDEX IF NOT EXISTS ix_model_version_active ON public.model_version (ticker, is_active);

-- (b) forecast_run
CREATE TABLE IF NOT EXISTS public.forecast_run (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker VARCHAR(16) NOT NULL,
    model_version_id INTEGER NOT NULL REFERENCES public.model_version(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    anchor_date DATE NOT NULL,
    anchor_close_price DOUBLE PRECISION NOT NULL,
    horizon_days INTEGER NOT NULL,
    confidence_score DOUBLE PRECISION NOT NULL,
    regime_status VARCHAR(32) NOT NULL,
    confidence_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    resolution_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    is_seeded_demo BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS ix_forecast_run_ticker ON public.forecast_run (ticker);
CREATE INDEX IF NOT EXISTS ix_forecast_run_anchor ON public.forecast_run (anchor_date);
CREATE INDEX IF NOT EXISTS ix_forecast_run_resolution ON public.forecast_run (resolution_status);
CREATE INDEX IF NOT EXISTS ix_run_ticker_created ON public.forecast_run (ticker, created_at DESC);

-- (c) forecast_point
CREATE TABLE IF NOT EXISTS public.forecast_point (
    id SERIAL PRIMARY KEY,
    forecast_run_id UUID NOT NULL REFERENCES public.forecast_run(id) ON DELETE CASCADE,
    step_ahead INTEGER NOT NULL,
    target_trading_date DATE NOT NULL,
    predicted_return DOUBLE PRECISION NOT NULL,
    predicted_close DOUBLE PRECISION NOT NULL,
    lower_80 DOUBLE PRECISION NOT NULL,
    upper_80 DOUBLE PRECISION NOT NULL,
    lower_95 DOUBLE PRECISION NOT NULL,
    upper_95 DOUBLE PRECISION NOT NULL,
    actual_close DOUBLE PRECISION,
    actual_return DOUBLE PRECISION,
    abs_error DOUBLE PRECISION,
    pct_error DOUBLE PRECISION,
    direction_correct BOOLEAN,
    inside_80_band BOOLEAN,
    inside_95_band BOOLEAN,
    resolved_at TIMESTAMPTZ,
    CONSTRAINT uq_run_step UNIQUE (forecast_run_id, step_ahead)
);
CREATE INDEX IF NOT EXISTS ix_forecast_point_run_id ON public.forecast_point (forecast_run_id);
CREATE INDEX IF NOT EXISTS ix_point_unresolved ON public.forecast_point (actual_close, target_trading_date);

-- (d) retrain_job
CREATE TABLE IF NOT EXISTS public.retrain_job (
    id VARCHAR(64) PRIMARY KEY,
    ticker VARCHAR(16) NOT NULL,
    stage VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    progress_fold INTEGER NOT NULL DEFAULT 0,
    total_folds INTEGER NOT NULL DEFAULT 8,
    diff JSONB,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS ix_retrain_job_ticker ON public.retrain_job (ticker);
CREATE INDEX IF NOT EXISTS ix_retrain_job_stage ON public.retrain_job (stage);

-- ------------------------------------------------------------------------------
-- 4. Enable Row Level Security (RLS) & Clean Old Conflicting Policies
-- ------------------------------------------------------------------------------
ALTER TABLE public.model_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_point ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retrain_job ENABLE ROW LEVEL SECURITY;

-- Drop any previous conflicting policies from earlier testing
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('model_version', 'forecast_run', 'forecast_point', 'retrain_job')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 5. Create Secure Row Level Security Policies
-- ------------------------------------------------------------------------------
-- Public Read Policies (Allow frontend/direct SELECT if desired)
CREATE POLICY "Allow public read on model_version"
    ON public.model_version FOR SELECT
    USING (true);

CREATE POLICY "Allow public read on forecast_run"
    ON public.forecast_run FOR SELECT
    USING (true);

CREATE POLICY "Allow public read on forecast_point"
    ON public.forecast_point FOR SELECT
    USING (true);

CREATE POLICY "Allow public read on retrain_job"
    ON public.retrain_job FOR SELECT
    USING (true);

-- Backend Service Role has full bypass authority in Supabase.
-- Disallow all anon INSERT/UPDATE/DELETE.
-- Optional admin modification policies for dashboard maintenance using optimized auth check:
CREATE POLICY "Allow admin write on model_version"
    ON public.model_version FOR ALL
    TO authenticated
    USING ((((SELECT auth.jwt()) ->> 'email') = 'arnavraut4567@gmail.com'))
    WITH CHECK ((((SELECT auth.jwt()) ->> 'email') = 'arnavraut4567@gmail.com'));

CREATE POLICY "Allow admin write on forecast_run"
    ON public.forecast_run FOR ALL
    TO authenticated
    USING ((((SELECT auth.jwt()) ->> 'email') = 'arnavraut4567@gmail.com'))
    WITH CHECK ((((SELECT auth.jwt()) ->> 'email') = 'arnavraut4567@gmail.com'));

CREATE POLICY "Allow admin write on forecast_point"
    ON public.forecast_point FOR ALL
    TO authenticated
    USING ((((SELECT auth.jwt()) ->> 'email') = 'arnavraut4567@gmail.com'))
    WITH CHECK ((((SELECT auth.jwt()) ->> 'email') = 'arnavraut4567@gmail.com'));

CREATE POLICY "Allow admin write on retrain_job"
    ON public.retrain_job FOR ALL
    TO authenticated
    USING ((((SELECT auth.jwt()) ->> 'email') = 'arnavraut4567@gmail.com'))
    WITH CHECK ((((SELECT auth.jwt()) ->> 'email') = 'arnavraut4567@gmail.com'));

COMMIT;
