-- =============================================================================
-- PAPIANO SOCIAL CHAT APP — IDEMPOTENT MIGRATION (FINAL AUDITED)
-- Target: Supabase project agevomwfkvtqpddeyogu
-- Tables: profiles, rooms, room_members, messages, friends, friend_requests,
--         blocked_users, profile_comments, profile_reactions, notifications
-- PRESERVES ALL EXISTING DATA. Safe to run multiple times.
-- Last audited: 2025-05-25
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PROFILES (extends auth.users)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_number BIGINT UNIQUE,
    display_name TEXT,
    display_name_lower TEXT,
    bio TEXT,
    photo_url TEXT,
    role TEXT DEFAULT 'user',
    active_badge TEXT DEFAULT 'verified',
    owned_badges TEXT[] DEFAULT ARRAY['npc']::TEXT[],
    play_time INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='user_number') THEN
        ALTER TABLE public.profiles ADD COLUMN user_number BIGINT UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='display_name') THEN
        ALTER TABLE public.profiles ADD COLUMN display_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='display_name_lower') THEN
        ALTER TABLE public.profiles ADD COLUMN display_name_lower TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='bio') THEN
        ALTER TABLE public.profiles ADD COLUMN bio TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='photo_url') THEN
        ALTER TABLE public.profiles ADD COLUMN photo_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='role') THEN
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='active_badge') THEN
        ALTER TABLE public.profiles ADD COLUMN active_badge TEXT DEFAULT 'verified';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='owned_badges') THEN
        ALTER TABLE public.profiles ADD COLUMN owned_badges TEXT[] DEFAULT ARRAY['npc']::TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='play_time') THEN
        ALTER TABLE public.profiles ADD COLUMN play_time INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='created_at') THEN
        ALTER TABLE public.profiles ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='updated_at') THEN
        ALTER TABLE public.profiles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_user_number ON public.profiles(user_number);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name_lower ON public.profiles(display_name_lower);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ROOMS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT DEFAULT 'direct',
    title TEXT,
    created_by UUID,
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rooms' AND column_name='type') THEN
        ALTER TABLE public.rooms ADD COLUMN type TEXT DEFAULT 'direct';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rooms' AND column_name='title') THEN
        ALTER TABLE public.rooms ADD COLUMN title TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rooms' AND column_name='created_by') THEN
        ALTER TABLE public.rooms ADD COLUMN created_by UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rooms' AND column_name='last_message') THEN
        ALTER TABLE public.rooms ADD COLUMN last_message TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rooms' AND column_name='last_message_at') THEN
        ALTER TABLE public.rooms ADD COLUMN last_message_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rooms' AND column_name='created_at') THEN
        ALTER TABLE public.rooms ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rooms_title ON public.rooms(title);
CREATE INDEX IF NOT EXISTS idx_rooms_type ON public.rooms(type);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ROOM_MEMBERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID,
    user_id UUID,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='room_members' AND column_name='role') THEN
        ALTER TABLE public.room_members ADD COLUMN role TEXT DEFAULT 'member';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='room_members' AND column_name='joined_at') THEN
        ALTER TABLE public.room_members ADD COLUMN joined_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON public.room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON public.room_members(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. MESSAGES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID,
    sender_id UUID,
    body TEXT,
    media_url TEXT,
    reply_to UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'sent',
    edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMPTZ,
    deleted_for UUID[] DEFAULT '{}'::UUID[],
    mentions JSONB DEFAULT '[]'::JSONB
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='body') THEN
        ALTER TABLE public.messages ADD COLUMN body TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='media_url') THEN
        ALTER TABLE public.messages ADD COLUMN media_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='reply_to') THEN
        ALTER TABLE public.messages ADD COLUMN reply_to UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='status') THEN
        ALTER TABLE public.messages ADD COLUMN status TEXT DEFAULT 'sent';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='edited') THEN
        ALTER TABLE public.messages ADD COLUMN edited BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='edited_at') THEN
        ALTER TABLE public.messages ADD COLUMN edited_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='deleted_for') THEN
        ALTER TABLE public.messages ADD COLUMN deleted_for UUID[] DEFAULT '{}'::UUID[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='mentions') THEN
        ALTER TABLE public.messages ADD COLUMN mentions JSONB DEFAULT '[]'::JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='created_at') THEN
        ALTER TABLE public.messages ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON public.messages(room_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. FRIENDS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.friends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    friend_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_friends_user_id ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON public.friends(friend_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. FRIEND_REQUESTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user UUID,
    to_user UUID,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    sender_id UUID REFERENCES public.profiles(id),
    receiver_id UUID REFERENCES public.profiles(id)
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='friend_requests' AND column_name='status') THEN
        ALTER TABLE public.friend_requests ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='friend_requests' AND column_name='sender_id') THEN
        ALTER TABLE public.friend_requests ADD COLUMN sender_id UUID REFERENCES public.profiles(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='friend_requests' AND column_name='receiver_id') THEN
        ALTER TABLE public.friend_requests ADD COLUMN receiver_id UUID REFERENCES public.profiles(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user ON public.friend_requests(to_user);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from_user ON public.friend_requests(from_user);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON public.friend_requests(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. BLOCKED_USERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID REFERENCES public.profiles(id),
    blocked_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker_id ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_id ON public.blocked_users(blocked_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. PROFILE_COMMENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID,
    author_id UUID,
    body TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_comments_profile_id ON public.profile_comments(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_comments_author_id ON public.profile_comments(author_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. PROFILE_REACTIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID,
    user_id UUID,
    reaction TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_reactions_profile_id ON public.profile_reactions(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_reactions_user_id ON public.profile_reactions(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'general',
    title TEXT DEFAULT '',
    body TEXT DEFAULT '',
    data JSONB DEFAULT '{}'::JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ─── PROFILES ───
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_select_all') THEN
        CREATE POLICY profiles_select_all ON public.profiles FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_insert_own') THEN
        CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_update_own') THEN
        CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id);
    END IF;
END $$;

-- ─── ROOMS ───
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rooms' AND policyname='rooms_select_all') THEN
        CREATE POLICY rooms_select_all ON public.rooms FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rooms' AND policyname='rooms_insert_auth') THEN
        CREATE POLICY rooms_insert_auth ON public.rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rooms' AND policyname='rooms_update_auth') THEN
        CREATE POLICY rooms_update_auth ON public.rooms FOR UPDATE USING (auth.uid() IS NOT NULL);
    END IF;
END $$;

-- ─── ROOM_MEMBERS ───
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='room_members' AND policyname='room_members_select_all') THEN
        CREATE POLICY room_members_select_all ON public.room_members FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='room_members' AND policyname='room_members_insert_auth') THEN
        CREATE POLICY room_members_insert_auth ON public.room_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='room_members' AND policyname='room_members_delete_own') THEN
        CREATE POLICY room_members_delete_own ON public.room_members FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- ─── MESSAGES ───
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages_select_all') THEN
        CREATE POLICY messages_select_all ON public.messages FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages_insert_own') THEN
        CREATE POLICY messages_insert_own ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages_update_delete_for') THEN
        CREATE POLICY messages_update_delete_for ON public.messages FOR UPDATE USING (auth.uid() IS NOT NULL);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages_delete_all_auth') THEN
        CREATE POLICY messages_delete_all_auth ON public.messages FOR DELETE USING (auth.uid() IS NOT NULL);
    END IF;
END $$;

-- ─── FRIENDS ───
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='friends' AND policyname='friends_select_own') THEN
        CREATE POLICY friends_select_own ON public.friends FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='friends' AND policyname='friends_insert_auth') THEN
        CREATE POLICY friends_insert_auth ON public.friends FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='friends' AND policyname='friends_delete_own') THEN
        CREATE POLICY friends_delete_own ON public.friends FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);
    END IF;
END $$;

-- ─── FRIEND_REQUESTS ───
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='friend_requests' AND policyname='friend_requests_select_own') THEN
        CREATE POLICY friend_requests_select_own ON public.friend_requests FOR SELECT USING (auth.uid() = from_user OR auth.uid() = to_user);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='friend_requests' AND policyname='friend_requests_insert_auth') THEN
        CREATE POLICY friend_requests_insert_auth ON public.friend_requests FOR INSERT WITH CHECK (auth.uid() = from_user);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='friend_requests' AND policyname='friend_requests_update_own') THEN
        CREATE POLICY friend_requests_update_own ON public.friend_requests FOR UPDATE USING (auth.uid() = to_user);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='friend_requests' AND policyname='friend_requests_delete_own') THEN
        CREATE POLICY friend_requests_delete_own ON public.friend_requests FOR DELETE USING (auth.uid() = from_user OR auth.uid() = to_user);
    END IF;
END $$;

-- ─── BLOCKED_USERS ───
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blocked_users' AND policyname='blocked_users_select_own') THEN
        CREATE POLICY blocked_users_select_own ON public.blocked_users FOR SELECT USING (auth.uid() = blocker_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blocked_users' AND policyname='blocked_users_insert_own') THEN
        CREATE POLICY blocked_users_insert_own ON public.blocked_users FOR INSERT WITH CHECK (auth.uid() = blocker_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blocked_users' AND policyname='blocked_users_delete_own') THEN
        CREATE POLICY blocked_users_delete_own ON public.blocked_users FOR DELETE USING (auth.uid() = blocker_id);
    END IF;
END $$;

-- ─── PROFILE_COMMENTS ───
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profile_comments' AND policyname='profile_comments_select_all') THEN
        CREATE POLICY profile_comments_select_all ON public.profile_comments FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profile_comments' AND policyname='profile_comments_insert_auth') THEN
        CREATE POLICY profile_comments_insert_auth ON public.profile_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profile_comments' AND policyname='profile_comments_delete_own') THEN
        CREATE POLICY profile_comments_delete_own ON public.profile_comments FOR DELETE USING (auth.uid() = author_id OR auth.uid() = profile_id);
    END IF;
END $$;

-- ─── PROFILE_REACTIONS ───
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profile_reactions' AND policyname='profile_reactions_select_all') THEN
        CREATE POLICY profile_reactions_select_all ON public.profile_reactions FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profile_reactions' AND policyname='profile_reactions_insert_own') THEN
        CREATE POLICY profile_reactions_insert_own ON public.profile_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profile_reactions' AND policyname='profile_reactions_update_own') THEN
        CREATE POLICY profile_reactions_update_own ON public.profile_reactions FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;

-- ─── NOTIFICATIONS ───
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='notifications_select_own') THEN
        CREATE POLICY notifications_select_own ON public.notifications FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='notifications_insert_auth') THEN
        CREATE POLICY notifications_insert_auth ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='notifications_update_own') THEN
        CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='notifications_delete_own') THEN
        CREATE POLICY notifications_delete_own ON public.notifications FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- =============================================================================
-- REALTIME — Enable publication for tables that need live updates
-- =============================================================================
DO $$ BEGIN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_comments;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_reactions;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- =============================================================================
-- DONE. All tables, indexes, RLS policies, and realtime configured.
-- =============================================================================
