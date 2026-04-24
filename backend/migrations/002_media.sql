-- ╔══════════════════════════════════════════════════════════════╗
-- ║              UNI-VOTE — Module Media (TikTok feed)         ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE TABLE videos (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id         UUID REFERENCES candidates(id) ON DELETE CASCADE,
    event_id             UUID REFERENCES events(id) ON DELETE CASCADE,
    uploader_pseudo      VARCHAR(100) NOT NULL,
    cloudinary_public_id VARCHAR(500),
    cloudinary_url       VARCHAR(1000),
    thumbnail_url        VARCHAR(1000),
    duration_seconds     INTEGER,
    title                VARCHAR(255),
    status               VARCHAR(30) DEFAULT 'pending_moderation',
    -- 'pending_moderation' | 'approved' | 'rejected' | 'hidden_reports'
    moderation_result    JSONB,
    like_count           INTEGER DEFAULT 0,
    comment_count        INTEGER DEFAULT 0,
    report_count         INTEGER DEFAULT 0,
    created_at           TIMESTAMP DEFAULT NOW(),
    updated_at           TIMESTAMP DEFAULT NOW()
);

CREATE TABLE video_comments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id    UUID REFERENCES videos(id) ON DELETE CASCADE,
    pseudo      VARCHAR(100) NOT NULL,
    event_id    UUID REFERENCES events(id),
    content     TEXT NOT NULL CHECK (char_length(content) <= 300),
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE video_reports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id    UUID REFERENCES videos(id) ON DELETE CASCADE,
    pseudo      VARCHAR(100) NOT NULL,
    reason      VARCHAR(100),
    created_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE(video_id, pseudo)
);

CREATE INDEX idx_videos_event_status ON videos(event_id, status, created_at DESC);
CREATE INDEX idx_videos_event_likes  ON videos(event_id, like_count DESC);
CREATE INDEX idx_comments_video      ON video_comments(video_id, created_at DESC);
