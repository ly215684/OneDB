//! Global connection manager: reuses database connections/pools across commands.
//!
//! Connections are cached by a key derived from the connection config (plus an
//! optional qualifier such as the target database name). Idle entries are
//! reclaimed by a background sweeper after `IDLE_TIMEOUT_SECS`.

use dashmap::DashMap;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

/// Idle entries are evicted after this many seconds.
const IDLE_TIMEOUT_SECS: u64 = 600;
/// Sweeper runs every this many seconds.
const SWEEP_INTERVAL_SECS: u64 = 60;

pub enum ConnKind {
    MySql(mysql_async::Pool),
    Pg(Arc<tokio_postgres::Client>),
    Redis(redis::aio::MultiplexedConnection),
    Mongo(mongodb::Client),
}

struct Entry {
    kind: ConnKind,
    last_used: Mutex<u64>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

static MANAGER: OnceLock<DashMap<String, Arc<Entry>>> = OnceLock::new();

fn manager() -> &'static DashMap<String, Arc<Entry>> {
    MANAGER.get_or_init(|| {
        let map: DashMap<String, Arc<Entry>> = DashMap::new();
        // Spawn background sweeper for idle entries
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(SWEEP_INTERVAL_SECS));
            loop {
                interval.tick().await;
                let cutoff = now_ms().saturating_sub(IDLE_TIMEOUT_SECS);
                MANAGER.get().map(|m| {
                    m.retain(|_k, v| {
                        let last = v.last_used.lock().map(|g| *g).unwrap_or(0);
                        last >= cutoff
                    });
                });
            }
        });
        map
    })
}

/// Derive a stable cache key from the connection config and optional qualifier
/// (e.g. database name). The key never contains secrets in readable form.
pub fn config_key(prefix: &str, config: &serde_json::Value, qualifier: &str) -> String {
    let mut hasher = DefaultHasher::new();
    config.to_string().hash(&mut hasher);
    qualifier.hash(&mut hasher);
    format!("{}:{:016x}", prefix, hasher.finish())
}

fn touch(entry: &Entry) {
    if let Ok(mut g) = entry.last_used.lock() {
        *g = now_ms();
    }
}

/// Get or create a MySQL connection pool for the given config.
pub async fn get_mysql_pool(
    key: &str,
    build: impl FnOnce() -> Result<mysql_async::Pool, String>,
) -> Result<mysql_async::Pool, String> {
    if let Some(entry) = manager().get(key) {
        if let ConnKind::MySql(pool) = &entry.kind {
            touch(&entry);
            return Ok(pool.clone());
        }
    }
    let pool = build()?;
    manager().insert(
        key.to_string(),
        Arc::new(Entry {
            kind: ConnKind::MySql(pool.clone()),
            last_used: Mutex::new(now_ms()),
        }),
    );
    Ok(pool)
}

/// Get or create a cached PostgreSQL client. Recreates it if the cached
/// client has been closed.
pub async fn get_pg_client(
    key: &str,
    build: impl Fn() -> std::pin::Pin<
        Box<dyn std::future::Future<Output = Result<tokio_postgres::Client, String>> + Send>,
    >,
) -> Result<Arc<tokio_postgres::Client>, String> {
    if let Some(entry) = manager().get(key) {
        if let ConnKind::Pg(client) = &entry.kind {
            if !client.is_closed() {
                touch(&entry);
                return Ok(client.clone());
            }
        }
        drop(entry);
        manager().remove(key);
    }
    let client = build().await?;
    let arc = Arc::new(client);
    manager().insert(
        key.to_string(),
        Arc::new(Entry {
            kind: ConnKind::Pg(arc.clone()),
            last_used: Mutex::new(now_ms()),
        }),
    );
    Ok(arc)
}

/// Get or create a cached Redis multiplexed connection.
pub async fn get_redis_conn(
    key: &str,
    build: impl std::future::Future<Output = Result<redis::aio::MultiplexedConnection, String>>,
) -> Result<redis::aio::MultiplexedConnection, String> {
    if let Some(entry) = manager().get(key) {
        if let ConnKind::Redis(con) = &entry.kind {
            touch(&entry);
            return Ok(con.clone());
        }
    }
    let con = build.await?;
    manager().insert(
        key.to_string(),
        Arc::new(Entry {
            kind: ConnKind::Redis(con.clone()),
            last_used: Mutex::new(now_ms()),
        }),
    );
    Ok(con)
}

/// Get or create a cached MongoDB client.
pub async fn get_mongo_client(
    key: &str,
    build: impl std::future::Future<Output = Result<mongodb::Client, String>>,
) -> Result<mongodb::Client, String> {
    if let Some(entry) = manager().get(key) {
        if let ConnKind::Mongo(client) = &entry.kind {
            touch(&entry);
            return Ok(client.clone());
        }
    }
    let client = build.await?;
    manager().insert(
        key.to_string(),
        Arc::new(Entry {
            kind: ConnKind::Mongo(client.clone()),
            last_used: Mutex::new(now_ms()),
        }),
    );
    Ok(client)
}
