-- ═══════════════════════════════════════════════════════════
-- WebGIS Sorosutan — Supabase Schema
-- Jalankan di: Supabase Dashboard > SQL Editor > New Query
-- ═══════════════════════════════════════════════════════════

-- Aktifkan extension PostGIS (untuk tipe data geospasial)
create extension if not exists postgis;

-- ─────────────────────────────────────────────
-- TABEL 1: feedback (kesan & pesan dari publik)
-- ─────────────────────────────────────────────
create table if not exists feedback (
  id          bigint generated always as identity primary key,
  nama        text not null,
  instansi    text,
  saran       text not null,
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────────
-- TABEL 2: titik_tambahan (titik baru dari admin)
-- Pakai kolom geography(Point) asli PostGIS
-- ─────────────────────────────────────────────
create table if not exists titik_tambahan (
  id              bigint generated always as identity primary key,
  nama            text not null,
  kategori        text not null,        -- Pendidikan / Kesehatan / Bisnis-UMKM / Ibadah / Fasilitas Umum
  kondisi         text,
  jumlah_lantai   integer,
  status          text,
  jam_operasional text,
  deskripsi       text,
  lokasi          geography(Point, 4326) not null,  -- kolom geospasial asli (lng, lat)
  created_at      timestamptz default now(),
  created_by      text default 'admin'
);

-- Index spasial (bikin query "titik dalam radius/wilayah" jadi cepat)
create index if not exists idx_titik_tambahan_lokasi
  on titik_tambahan using gist (lokasi);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- publik boleh baca & kirim feedback + lihat titik
-- hanya admin (lewat aplikasi) yang insert titik baru
-- ─────────────────────────────────────────────
alter table feedback enable row level security;
alter table titik_tambahan enable row level security;

-- Feedback: siapa saja boleh insert & select (form publik)
create policy "feedback_insert_public" on feedback
  for insert to anon with check (true);
create policy "feedback_select_public" on feedback
  for select to anon using (true);
create policy "feedback_delete_public" on feedback
  for delete to anon using (true);

-- Titik tambahan: siapa saja boleh select (tampil di peta),
-- insert/delete dikontrol di level aplikasi (cuma admin yg login bisa akses form-nya)
create policy "titik_select_public" on titik_tambahan
  for select to anon using (true);
create policy "titik_insert_public" on titik_tambahan
  for insert to anon with check (true);
create policy "titik_delete_public" on titik_tambahan
  for delete to anon using (true);

-- ─────────────────────────────────────────────
-- VIEW: titik_tambahan sebagai GeoJSON-ready
-- (supaya gampang di-fetch & langsung dipakai Mapbox)
-- ─────────────────────────────────────────────
create or replace view titik_tambahan_geojson as
select
  id,
  nama,
  kategori,
  kondisi,
  jumlah_lantai,
  status,
  jam_operasional,
  deskripsi,
  st_x(lokasi::geometry) as longitude,
  st_y(lokasi::geometry) as latitude,
  created_at
from titik_tambahan;
