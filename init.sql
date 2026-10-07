-- ==============================================================================
-- Схема базы данных Cell Messenger (PostgreSQL)
-- Файл инициализации для автоматического и ручного развертывания
-- ==============================================================================

-- Подключение необходимых расширений
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ------------------------------------------------------------------------------
-- 1. Таблица пользователей (users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска пользователей по подстроке (ILIKE) в handleSearchUsers
CREATE INDEX IF NOT EXISTS idx_users_username_trgm ON users USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING gin (email gin_trgm_ops);

-- ------------------------------------------------------------------------------
-- 2. Таблица чатов (chats)
-- Типы: 'direct' (личный), 'group' (групповой), 'channel' (канал)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('direct', 'group', 'channel')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chats_type ON chats(type);

-- ------------------------------------------------------------------------------
-- 3. Метаданные личных чатов 1-on-1 (direct_chat_metadata)
-- Хранит пару участников диалога. В коде user_one_id всегда меньше user_two_id
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS direct_chat_metadata (
    chat_id UUID PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
    user_one_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_two_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_direct_chat_pair UNIQUE (user_one_id, user_two_id),
    CONSTRAINT chk_direct_chat_distinct_users CHECK (user_one_id <> user_two_id)
);

CREATE INDEX IF NOT EXISTS idx_direct_chat_user_two ON direct_chat_metadata(user_two_id);

-- ------------------------------------------------------------------------------
-- 4. Метаданные групповых чатов (group_chat_metadata)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_chat_metadata (
    chat_id UUID PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    avatar_url TEXT DEFAULT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_group_chat_owner ON group_chat_metadata(owner_id);

-- ------------------------------------------------------------------------------
-- 5. Участники чатов (chat_members)
-- Роли: 'owner' (создатель), 'admin' (администратор), 'member' (участник)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_members (
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    last_read_message_id BIGINT NOT NULL DEFAULT 0,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id, user_id)
);

-- Индекс для быстрого получения списка чатов пользователя в handleGetChatList
CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id);

-- ------------------------------------------------------------------------------
-- 6. Сообщения чатов (messages)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Составной индекс для курсорной пагинации истории сообщений и получения последнего сообщения
CREATE INDEX IF NOT EXISTS idx_messages_chat_id_id_desc ON messages(chat_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
