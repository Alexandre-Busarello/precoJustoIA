-- Migration: Add composition_snapshot to index_history_points
-- Adiciona campo para armazenar snapshot da composição em cada ponto histórico
-- Permite rastrear performance individual de ativos que passaram pelo índice

ALTER TABLE index_history_points
ADD COLUMN composition_snapshot JSONB NULL;

