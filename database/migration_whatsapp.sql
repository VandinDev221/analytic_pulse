-- Migração: notificações WhatsApp + canal Telegram/WhatsApp
-- Execute no SQL Editor se o banco já existia antes desta feature

ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS notification_channel VARCHAR(20) DEFAULT 'telegram',
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_api_key TEXT;
