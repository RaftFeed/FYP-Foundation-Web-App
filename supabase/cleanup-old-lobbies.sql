-- ============================================================
-- Cleanup Old Lobby Data
-- Menghapus semua data lobby yang sudah kadaluarsi (sebelum hari ini).
-- Jalankan script ini secara berkala (misalnya via cron job mingguan).
-- ============================================================

-- 1. Hapus data pembayaran lobby yang kadaluarsi
--    (child table — harus dihapus sebelum parent)
DELETE FROM public.matchmaking_lobby_payments
WHERE lobby_id IN (
  SELECT id FROM public.matchmaking_lobbies
  WHERE expires_at < NOW()
);

-- 2. Hapus data anggota lobby yang kadaluarsi
DELETE FROM public.matchmaking_lobby_members
WHERE lobby_id IN (
  SELECT id FROM public.matchmaking_lobbies
  WHERE expires_at < NOW()
);

-- 3. Hapus lobby yang kadaluarsi (expires_at sebelum waktu sekarang)
DELETE FROM public.matchmaking_lobbies
WHERE expires_at < NOW();

-- ============================================================
-- Opsional: Hapus juga lobby yang sudah lama
-- (berdasarkan tanggal created_at, misalnya > 30 hari)
-- ============================================================

-- Uncomment di bawah ini jika ingin menghapus lobby lama
-- (terlepas dari status expires_at):

-- DELETE FROM public.matchmaking_lobby_payments
-- WHERE lobby_id IN (
--   SELECT id FROM public.matchmaking_lobbies
--   WHERE created_at < CURRENT_DATE - INTERVAL '30 days'
-- );

-- DELETE FROM public.matchmaking_lobby_members
-- WHERE lobby_id IN (
--   SELECT id FROM public.matchmaking_lobbies
--   WHERE created_at < CURRENT_DATE - INTERVAL '30 days'
-- );

-- DELETE FROM public.matchmaking_lobbies
-- WHERE created_at < CURRENT_DATE - INTERVAL '30 days';
