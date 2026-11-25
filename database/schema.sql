-- ============================================================================
-- Multimodal Financial Social Media Analytics Platform
-- Supabase PostgreSQL schema (production target)
-- ============================================================================
-- Run in Supabase SQL editor, or: psql "$DATABASE_URL" -f database/schema.sql
-- Local prototype uses SQLite via backend/app/database.py with equivalent tables.
-- Supabase Auth owns auth.users; this schema adds a public.users profile mirror.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. users (profile mirror of auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
    id          uuid primary key references auth.users(id) on delete cascade,
    email       text unique not null,
    full_name   text,
    role        text not null default 'researcher' check (role in ('researcher','annotator','admin')),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. datasets (registered secondary or uploaded datasets)
-- ---------------------------------------------------------------------------
create table if not exists public.datasets (
    id                 uuid primary key default gen_random_uuid(),
    owner_id           uuid references public.users(id) on delete set null,
    name               text not null,
    slug               text unique,
    source             text,                          -- URL or 'user_upload'
    license            text,                          -- verified license string
    description        text,
    modality           text not null default 'text' check (modality in ('text','image','audio','video','reaction','mixed')),
    record_count       integer,
    class_distribution jsonb default '{}'::jsonb,
    columns            jsonb default '[]'::jsonb,
    missing_report     jsonb default '{}'::jsonb,
    duplicate_count    integer default 0,
    is_builtin         boolean not null default false,
    preprocessing_notes text,
    created_at         timestamptz not null default now()
);
create index if not exists idx_datasets_owner on public.datasets(owner_id);

-- ---------------------------------------------------------------------------
-- 3. dataset_records (individual rows of a dataset)
-- ---------------------------------------------------------------------------
create table if not exists public.dataset_records (
    id          uuid primary key default gen_random_uuid(),
    dataset_id  uuid not null references public.datasets(id) on delete cascade,
    text        text,
    label       text,
    label_numeric smallint,
    split       text check (split in ('train','validation','test')),
    metadata    jsonb default '{}'::jsonb,
    created_at  timestamptz not null default now()
);
create index if not exists idx_dataset_records_dataset on public.dataset_records(dataset_id);
create index if not exists idx_dataset_records_label on public.dataset_records(dataset_id, label);

-- ---------------------------------------------------------------------------
-- 4. stock_tickers
-- ---------------------------------------------------------------------------
create table if not exists public.stock_tickers (
    id          uuid primary key default gen_random_uuid(),
    symbol      text unique not null,
    company     text,
    exchange    text,
    sector      text,
    is_active   boolean not null default true,
    created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. social_media_posts (ingested/collected posts, all modalities)
-- ---------------------------------------------------------------------------
create table if not exists public.social_media_posts (
    id            uuid primary key default gen_random_uuid(),
    owner_id      uuid references public.users(id) on delete cascade,
    dataset_id    uuid references public.datasets(id) on delete set null,
    platform      text,                       -- X/Twitter, Reddit, StockTwits, ...
    content_type  text not null default 'text' check (content_type in ('text','comment','reply','reaction','emoji','sticker','gif','image','meme','screenshot','audio','voice','video','reel')),
    text          text,
    ticker_symbol text references public.stock_tickers(symbol) on delete set null,
    author_handle text,
    source_url    text,
    posted_at     timestamptz,
    collected_at  timestamptz not null default now(),
    is_anonymised boolean not null default true,
    created_at    timestamptz not null default now()
);
create index if not exists idx_posts_owner on public.social_media_posts(owner_id);
create index if not exists idx_posts_ticker on public.social_media_posts(ticker_symbol);
create index if not exists idx_posts_posted_at on public.social_media_posts(posted_at desc);
create index if not exists idx_posts_platform on public.social_media_posts(platform);

-- ---------------------------------------------------------------------------
-- 6. media_uploads (files live in Supabase Storage; only references here)
-- ---------------------------------------------------------------------------
create table if not exists public.media_uploads (
    id            uuid primary key default gen_random_uuid(),
    owner_id      uuid references public.users(id) on delete cascade,
    post_id       uuid references public.social_media_posts(id) on delete cascade,
    storage_path  text not null,              -- Supabase Storage object path
    bucket        text not null default 'media',
    original_name text,
    media_type    text not null check (media_type in ('image','sticker','gif','audio','video')),
    mime_type     text,
    file_size     bigint,
    duration_sec  numeric(10,2),
    width         integer,
    height        integer,
    checksum      text,
    created_at    timestamptz not null default now()
);
create index if not exists idx_media_owner on public.media_uploads(owner_id);
create index if not exists idx_media_post on public.media_uploads(post_id);

-- ---------------------------------------------------------------------------
-- 7. reactions (engagement + emotional reactions — never sentiment labels)
-- ---------------------------------------------------------------------------
create table if not exists public.reactions (
    id            uuid primary key default gen_random_uuid(),
    post_id       uuid not null references public.social_media_posts(id) on delete cascade,
    reaction_type text not null,              -- like, love, angry, sad, laugh, surprise, fire, thumbs_up, ...
    count         integer not null default 0 check (count >= 0),
    is_emoji      boolean not null default false,
    emoji_glyph   text,
    created_at    timestamptz not null default now(),
    unique (post_id, reaction_type)
);
create index if not exists idx_reactions_post on public.reactions(post_id);

-- ---------------------------------------------------------------------------
-- 8. sentiment_results (per-post final fused result)
-- ---------------------------------------------------------------------------
create table if not exists public.sentiment_results (
    id                 uuid primary key default gen_random_uuid(),
    owner_id           uuid references public.users(id) on delete cascade,
    post_id            uuid references public.social_media_posts(id) on delete cascade,
    financial_sentiment text check (financial_sentiment in ('positive','negative','neutral','mixed','unknown')),
    confidence         numeric(5,4) check (confidence between 0 and 1),
    bullish_score      numeric(5,4),
    bearish_score      numeric(5,4),
    neutral_score      numeric(5,4),
    emotion_label      text,                  -- separate axis (general emotion)
    emotion_confidence numeric(5,4),
    engagement_score   numeric(5,2),          -- separate axis
    engagement_level   text check (engagement_level in ('low','medium','high','unknown')),
    fusion_method      text not null default 'late_fusion',
    contributing_modalities jsonb default '[]'::jsonb,
    explanation        text,
    model_version      text,
    status             text not null default 'completed' check (status in ('pending','processing','completed','failed','partial')),
    created_at         timestamptz not null default now()
);
create index if not exists idx_sentiment_owner on public.sentiment_results(owner_id);
create index if not exists idx_sentiment_post on public.sentiment_results(post_id);
create index if not exists idx_sentiment_created on public.sentiment_results(created_at desc);

-- ---------------------------------------------------------------------------
-- 9. modality_results (per-modality predictions that feed fusion)
-- ---------------------------------------------------------------------------
create table if not exists public.modality_results (
    id                uuid primary key default gen_random_uuid(),
    sentiment_result_id uuid not null references public.sentiment_results(id) on delete cascade,
    modality          text not null check (modality in ('text','emoji','reaction','sticker','gif','image','image_ocr_text','audio','audio_transcript','audio_emotion','video','video_transcript','video_ocr')),
    label             text,                   -- sentiment OR emotion depending on modality
    confidence        numeric(5,4) check (confidence between 0 and 1),
    extracted_text    text,                   -- OCR / transcript
    model_name        text,
    processor_status  text not null default 'completed',  -- completed | unavailable | failed | skipped
    limitation_note   text,                   -- honest reason when unavailable
    details           jsonb default '{}'::jsonb,
    created_at        timestamptz not null default now()
);
create index if not exists idx_modality_result_parent on public.modality_results(sentiment_result_id);

-- ---------------------------------------------------------------------------
-- 10. model_training_runs
-- ---------------------------------------------------------------------------
create table if not exists public.model_training_runs (
    id                 uuid primary key default gen_random_uuid(),
    owner_id           uuid references public.users(id) on delete set null,
    dataset_id         uuid references public.datasets(id) on delete set null,
    model_name         text not null,
    model_family       text not null default 'classical',   -- classical | transformer
    feature_config     jsonb default '{}'::jsonb,           -- tfidf ngram_range, min_df, max_features
    split_config       jsonb default '{}'::jsonb,           -- test_size, stratify, random_state
    n_train            integer,
    n_test             integer,
    train_time_s       numeric(10,3),
    inference_time_s   numeric(10,4),
    artifact_path      text,
    status             text not null default 'completed' check (status in ('running','completed','failed')),
    created_at         timestamptz not null default now()
);
create index if not exists idx_training_dataset on public.model_training_runs(dataset_id);

-- ---------------------------------------------------------------------------
-- 11. model_evaluations
-- ---------------------------------------------------------------------------
create table if not exists public.model_evaluations (
    id                uuid primary key default gen_random_uuid(),
    training_run_id   uuid not null references public.model_training_runs(id) on delete cascade,
    accuracy          numeric(6,4),
    precision_macro   numeric(6,4),
    recall_macro      numeric(6,4),
    f1_macro          numeric(6,4),
    precision_weighted numeric(6,4),
    recall_weighted   numeric(6,4),
    f1_weighted       numeric(6,4),
    confusion_matrix  jsonb,                   -- [[...],[...],[...]]
    per_class_report  jsonb,
    labels_order      jsonb default '["negative","neutral","positive"]'::jsonb,
    created_at        timestamptz not null default now()
);
create index if not exists idx_eval_run on public.model_evaluations(training_run_id);

-- ---------------------------------------------------------------------------
-- 12. primary_collection_records (manually collected/uploaded pilot data)
-- ---------------------------------------------------------------------------
create table if not exists public.primary_collection_records (
    id            uuid primary key default gen_random_uuid(),
    owner_id      uuid references public.users(id) on delete cascade,
    platform      text not null,
    method        text,                        -- manual | api_export | participant_submission
    text          text,
    ticker_symbol text,
    posted_at     timestamptz,
    media_type    text default 'text',
    media_upload_id uuid references public.media_uploads(id) on delete set null,
    source_identifier text,
    consent_obtained boolean not null default false,
    is_anonymised boolean not null default true,
    notes         text,
    created_at    timestamptz not null default now()
);
create index if not exists idx_primary_owner on public.primary_collection_records(owner_id);

-- ---------------------------------------------------------------------------
-- 13. annotations (per-annotator labels)
-- ---------------------------------------------------------------------------
create table if not exists public.annotations (
    id            uuid primary key default gen_random_uuid(),
    record_id     uuid not null references public.primary_collection_records(id) on delete cascade,
    annotator_id  uuid references public.users(id) on delete set null,
    annotator_tag text,                        -- 'A' / 'B' when identity must stay hidden
    label         text not null check (label in ('positive','negative','neutral')),
    confidence    smallint check (confidence between 1 and 5),
    rationale     text,
    created_at    timestamptz not null default now(),
    unique (record_id, annotator_tag)
);
create index if not exists idx_annotations_record on public.annotations(record_id);

-- ---------------------------------------------------------------------------
-- 14. annotation_agreements
-- ---------------------------------------------------------------------------
create table if not exists public.annotation_agreements (
    id             uuid primary key default gen_random_uuid(),
    record_id      uuid not null references public.primary_collection_records(id) on delete cascade,
    final_label    text check (final_label in ('positive','negative','neutral')),
    agreement      boolean,
    resolved_by    text,                       -- adjudicator or 'consensus'
    resolution_note text,
    computed_kappa numeric(6,4),               -- batch-level kappa snapshot
    created_at     timestamptz not null default now(),
    unique (record_id)
);

-- ---------------------------------------------------------------------------
-- 15. research_articles (verified literature registry)
-- ---------------------------------------------------------------------------
create table if not exists public.research_articles (
    id             uuid primary key default gen_random_uuid(),
    title          text not null,
    authors        text,
    publication_year integer,
    venue          text,
    doi_or_url     text,
    dataset_used   text,
    modality       text,
    methodology    text,
    algorithms     text,
    evaluation_metrics text,
    reported_findings  text,
    limitations    text,
    how_we_differ  text,
    verification_status text not null default 'verified'
        check (verification_status in ('verified','needs_verification','not_reported')),
    created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 16. generated_reports
-- ---------------------------------------------------------------------------
create table if not exists public.generated_reports (
    id            uuid primary key default gen_random_uuid(),
    owner_id      uuid references public.users(id) on delete cascade,
    title         text not null,
    report_type   text not null check (report_type in ('pdf','csv','json')),
    storage_path  text,
    summary       text,
    parameters    jsonb default '{}'::jsonb,
    created_at    timestamptz not null default now()
);
create index if not exists idx_reports_owner on public.generated_reports(owner_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Every user-scoped table restricts rows to auth.uid(). Built-in datasets and
-- verified research articles are readable by any authenticated user.
-- ============================================================================
alter table public.users                     enable row level security;
alter table public.datasets                  enable row level security;
alter table public.dataset_records           enable row level security;
alter table public.social_media_posts        enable row level security;
alter table public.media_uploads             enable row level security;
alter table public.reactions                 enable row level security;
alter table public.sentiment_results         enable row level security;
alter table public.modality_results          enable row level security;
alter table public.model_training_runs       enable row level security;
alter table public.model_evaluations         enable row level security;
alter table public.primary_collection_records enable row level security;
alter table public.annotations               enable row level security;
alter table public.annotation_agreements     enable row level security;
alter table public.generated_reports         enable row level security;
alter table public.stock_tickers             enable row level security;
alter table public.research_articles         enable row level security;

-- users: self only
create policy "users read self"   on public.users for select using (auth.uid() = id);
create policy "users update self" on public.users for update using (auth.uid() = id);

-- datasets / records
create policy "datasets read own or builtin" on public.datasets for select
    using (is_builtin = true or owner_id = auth.uid());
create policy "datasets insert own" on public.datasets for insert with check (owner_id = auth.uid());
create policy "datasets update own" on public.datasets for update using (owner_id = auth.uid());
create policy "datasets delete own" on public.datasets for delete using (owner_id = auth.uid());
create policy "dataset_records read" on public.dataset_records for select
    using (exists (select 1 from public.datasets d where d.id = dataset_id
                   and (d.is_builtin = true or d.owner_id = auth.uid())));
create policy "dataset_records write" on public.dataset_records for insert
    with check (exists (select 1 from public.datasets d where d.id = dataset_id and d.owner_id = auth.uid()));

-- posts / media / reactions
create policy "posts own" on public.social_media_posts for all
    using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "media own" on public.media_uploads for all
    using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "reactions read via post" on public.reactions for select
    using (exists (select 1 from public.social_media_posts p where p.id = post_id and p.owner_id = auth.uid()));
create policy "reactions write via post" on public.reactions for insert
    with check (exists (select 1 from public.social_media_posts p where p.id = post_id and p.owner_id = auth.uid()));

-- results
create policy "sentiment own" on public.sentiment_results for all
    using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "modality results read" on public.modality_results for select
    using (exists (select 1 from public.sentiment_results s where s.id = sentiment_result_id and s.owner_id = auth.uid()));
create policy "modality results write" on public.modality_results for insert
    with check (exists (select 1 from public.sentiment_results s where s.id = sentiment_result_id and s.owner_id = auth.uid()));

-- training runs / evaluations
create policy "training own read" on public.model_training_runs for select
    using (owner_id = auth.uid() or owner_id is null);
create policy "training own write" on public.model_training_runs for insert
    with check (owner_id = auth.uid());
create policy "evaluations read" on public.model_evaluations for select
    using (exists (select 1 from public.model_training_runs r where r.id = training_run_id
                   and (r.owner_id = auth.uid() or r.owner_id is null)));

-- primary collection
create policy "primary records own" on public.primary_collection_records for all
    using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "annotations read" on public.annotations for select
    using (exists (select 1 from public.primary_collection_records r where r.id = record_id and r.owner_id = auth.uid()));
create policy "annotations write" on public.annotations for insert
    with check (exists (select 1 from public.primary_collection_records r where r.id = record_id and r.owner_id = auth.uid()));
create policy "agreements read" on public.annotation_agreements for select
    using (exists (select 1 from public.primary_collection_records r where r.id = record_id and r.owner_id = auth.uid()));
create policy "agreements write" on public.annotation_agreements for insert
    with check (exists (select 1 from public.primary_collection_records r where r.id = record_id and r.owner_id = auth.uid()));

-- reports
create policy "reports own" on public.generated_reports for all
    using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- public reference data
create policy "tickers readable"   on public.stock_tickers for select using (true);
create policy "articles readable"  on public.research_articles for select using (true);

-- ============================================================================
-- STORAGE BUCKETS (run once)
-- ============================================================================
-- insert into storage.buckets (id, name, public) values
--   ('media', 'media', false),
--   ('reports', 'reports', false)
-- on conflict do nothing;
--
-- create policy "media owner read" on storage.objects for select
--   using (bucket_id = 'media' and owner = auth.uid());
-- create policy "media owner write" on storage.objects for insert
--   with check (bucket_id = 'media' and owner = auth.uid());

-- ============================================================================
-- SEED: verified research articles (matches backend/app/main.py registry)
-- ============================================================================
insert into public.research_articles
  (title, authors, publication_year, venue, doi_or_url, dataset_used, modality, methodology, algorithms, evaluation_metrics, reported_findings, limitations, how_we_differ, verification_status)
values
  ('Twitter mood predicts the stock market','J. Bollen, H. Mao, X. Zeng',2011,'Journal of Computational Science',
   'https://doi.org/10.1016/j.jocs.2011.02.001','Twitter mood (OpinionFinder + GPOMS)','Text (Twitter)',
   'Lexicon-based mood classification aggregated to predict DJIA direction','OpinionFinder, GPOMS','Directional accuracy',
   'Aggregated Twitter mood showed predictive signal for DJIA movements.',
   'General mood states, not finance-specific; lexicon-based.',
   'Finance-specific supervised classifiers plus multimodal fusion.','verified'),
  ('When is a liability not a liability? Textual analysis, dictionaries, and 10-Ks','T. Loughran, B. McDonald',2011,'The Journal of Finance',
   'https://doi.org/10.1111/j.1540-6261.2010.00395.x','10-K filings (finance lexicon)','Text (financial disclosures)',
   'Finance-specific sentiment dictionary','Loughran-McDonald lexicon','Lexicon validation',
   'General dictionaries misclassify finance words such as liability and tax.',
   'Lexicon only; no contextual understanding.','Learned TF-IDF classifiers on social-media finance text.','verified'),
  ('FinBERT: Financial sentiment analysis with pre-trained language models','D. Araci',2019,'arXiv:1908.10063',
   'https://arxiv.org/abs/1908.10063','Financial PhraseBank + other finance corpora','Text (financial news)',
   'BERT pre-trained and fine-tuned on financial text','BERT (transformer)','Accuracy / F1 (dataset-dependent)',
   'Transformer fine-tuning outperforms lexicon and classical bag-of-words on finance benchmarks.',
   'Higher compute cost; benchmark-dependent.',
   'Classical TF-IDF models as lightweight baseline; FinBERT documented as future work, not claimed as trained.','verified'),
  ('Good debt or bad debt: Detecting semantic orientations in economic texts','P. Malo, A. Sinha, P. Korhonen, J. Wallenius, P. Takala',2014,
   'Journal of the Association for Information Science and Technology','https://doi.org/10.1002/asi.23258',
   'Financial PhraseBank (4,840 sentences)','Text (financial news sentences)','Human-annotated benchmark (16 annotators)',
   'Multiple (benchmark)','Accuracy','Established a high-quality finance sentiment benchmark.',
   'News sentences, not social media; small scale.',
   'PhraseBank used for cross-domain evaluation; Twitter data used for main training.','verified'),
  ('Attention is all you need','A. Vaswani et al.',2017,'NeurIPS','https://arxiv.org/abs/1706.03762',
   'General (machine translation)','Text (general)','Transformer architecture','Transformer','BLEU etc.',
   'Foundation for BERT and FinBERT.','Not finance-specific.','Background only.','verified'),
  ('BERT: Pre-training of deep bidirectional transformers for language understanding','J. Devlin, M.-W. Chang, K. Lee, K. Toutanova',2019,'NAACL-HLT',
   'https://arxiv.org/abs/1810.04805','General corpora','Text (general)','Pre-trained transformer','BERT','GLUE etc.',
   'Contextual embedding foundation.','Not finance-specific.','Background for FinBERT comparison.','verified')
on conflict do nothing;
