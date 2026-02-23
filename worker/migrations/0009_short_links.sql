-- Short links table for URL shortener (s.kosannisa.my.id)
CREATE TABLE IF NOT EXISTS short_links (
    code TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_short_links_url ON short_links(url);
