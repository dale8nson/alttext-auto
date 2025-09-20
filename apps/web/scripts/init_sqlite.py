#!/usr/bin/env python3
import os
import sqlite3

ROOT = os.path.dirname(os.path.dirname(__file__))  # apps/web
DB_PATH = os.path.join(ROOT, "prisma", "dev.db")

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.execute(
    """
    CREATE TABLE IF NOT EXISTS Shop (
        id TEXT PRIMARY KEY,
        shop TEXT NOT NULL UNIQUE,
        accessToken TEXT NOT NULL,
        plan TEXT NOT NULL DEFAULT 'trial',
        stripeId TEXT,
        quotaUsed INTEGER NOT NULL DEFAULT 0,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """
)

cur.execute(
    """
    CREATE TABLE IF NOT EXISTS Log (
        id TEXT PRIMARY KEY,
        shop TEXT NOT NULL,
        productId TEXT NOT NULL,
        imageId TEXT NOT NULL,
        alt TEXT NOT NULL,
        ok INTEGER NOT NULL,
        msg TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """
)

conn.commit()
conn.close()

print(f"Initialized SQLite at {DB_PATH}")

