use serde::Serialize;
use mysql_async::prelude::Queryable;

#[derive(Serialize, Clone, Debug)]
pub struct TableResult {
    pub name: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct DatabaseResult {
    pub name: String,
    pub tables: Vec<TableResult>,
}

#[derive(Serialize, Clone, Debug)]
pub struct QueryResultData {
    pub columns: Vec<String>,
    pub rows: Vec<serde_json::Value>,
    pub row_count: usize,
    pub affected_rows: u64,
    pub duration: u64,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct ColumnData {
    pub name: String,
    pub r#type: String,
    pub length: Option<u32>,
    pub default_value: Option<String>,
    pub nullable: bool,
    pub primary_key: bool,
    pub auto_increment: bool,
    pub comment: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct IndexData {
    pub name: String,
    pub columns: Vec<String>,
    pub unique: bool,
    pub r#type: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct ForeignKeyData {
    pub name: String,
    pub columns: Vec<String>,
    pub referenced_table: String,
    pub referenced_columns: Vec<String>,
    pub on_delete: String,
    pub on_update: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct TableStructureData {
    pub columns: Vec<ColumnData>,
    pub indexes: Vec<IndexData>,
    pub foreign_keys: Vec<ForeignKeyData>,
}

#[derive(Serialize, Clone, Debug)]
pub struct ERColumnData {
    pub name: String,
    pub r#type: String,
    pub pk: bool,
    pub fk: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct ERTableData {
    pub name: String,
    pub columns: Vec<ERColumnData>,
}

#[derive(Serialize, Clone, Debug)]
pub struct ERRelationData {
    pub from_table: String,
    pub from_column: String,
    pub to_table: String,
    pub to_column: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct ERDiagramData {
    pub tables: Vec<ERTableData>,
    pub relations: Vec<ERRelationData>,
}

// ─── Test Connection ──────────────────────────────────────────────

pub async fn test_connection_impl(
    db_type: &str,
    config: serde_json::Value,
) -> Result<String, String> {
    match db_type {
        "mysql" => test_mysql(&config).await,
        "postgresql" => test_postgresql(&config).await,
        "sqlite" => test_sqlite(&config).await,
        "mongodb" | "mongodb_srv" => test_mongodb(db_type, &config).await,
        "redis" => test_redis(&config).await,
        _ => Err(format!("Unsupported database type: {}", db_type)),
    }
}

// ─── List Databases ───────────────────────────────────────────────

pub async fn list_databases_impl(
    db_type: &str,
    config: serde_json::Value,
) -> Result<Vec<DatabaseResult>, String> {
    match db_type {
        "mysql" => list_mysql(&config).await,
        "postgresql" => list_postgresql(&config).await,
        "sqlite" => list_sqlite(&config).await,
        "mongodb" | "mongodb_srv" => list_mongodb(db_type, &config).await,
        "redis" => list_redis(&config).await,
        _ => Err(format!("Unsupported database type: {}", db_type)),
    }
}

// ─── MySQL ────────────────────────────────────────────────────────

fn build_mysql_url(config: &serde_json::Value) -> String {
    let host = config["host"].as_str().unwrap_or("localhost");
    let port = config["port"].as_u64().unwrap_or(3306);
    let user = config["username"].as_str().unwrap_or("root");
    let pass = config["password"].as_str().unwrap_or("");
    let db = config["database"].as_str();

    let mut url = format!("mysql://{}:{}@{}:{}", user, pass, host, port);
    if let Some(database) = db {
        url.push('/');
        url.push_str(database);
    }
    url
}

async fn test_mysql(config: &serde_json::Value) -> Result<String, String> {
    let url = build_mysql_url(config);
    let pool = mysql_async::Pool::new(url.as_str());
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let version: String = conn
        .query_first("SELECT VERSION()")
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Could not retrieve version")?;

    conn.disconnect().await.map_err(|e| e.to_string())?;
    Ok(format!("MySQL {}", version))
}

async fn list_mysql(config: &serde_json::Value) -> Result<Vec<DatabaseResult>, String> {
    let url = build_mysql_url(config);
    let pool = mysql_async::Pool::new(url.as_str());
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let db_rows: Vec<(String,)> = conn
        .query("SHOW DATABASES")
        .await
        .map_err(|e| e.to_string())?;

    let mut databases = Vec::new();
    for (db_name,) in db_rows {
        // Skip system databases
        if db_name == "information_schema"
            || db_name == "mysql"
            || db_name == "performance_schema"
            || db_name == "sys"
        {
            continue;
        }

        let table_rows: Vec<(String,)> = conn
            .query(format!(
                "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '{}'",
                db_name.replace('\'', "''")
            ))
            .await
            .unwrap_or_default();

        databases.push(DatabaseResult {
            name: db_name,
            tables: table_rows
                .into_iter()
                .map(|(name,)| TableResult { name })
                .collect(),
        });
    }

    conn.disconnect().await.map_err(|e| e.to_string())?;
    Ok(databases)
}

// ─── PostgreSQL ───────────────────────────────────────────────────

fn build_pg_config(config: &serde_json::Value) -> tokio_postgres::Config {
    let mut pg_config = tokio_postgres::Config::new();
    pg_config.host(config["host"].as_str().unwrap_or("localhost"));
    pg_config.port(config["port"].as_u64().unwrap_or(5432) as u16);
    pg_config.user(config["username"].as_str().unwrap_or("postgres"));
    if let Some(pass) = config["password"].as_str() {
        if !pass.is_empty() {
            pg_config.password(pass);
        }
    }
    if let Some(db) = config["database"].as_str() {
        if !db.is_empty() {
            pg_config.dbname(db);
        }
    }
    pg_config
}

async fn test_postgresql(config: &serde_json::Value) -> Result<String, String> {
    let pg_config = build_pg_config(config);
    let (client, connection) = pg_config
        .connect(tokio_postgres::NoTls)
        .await
        .map_err(|e| e.to_string())?;

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("PostgreSQL connection error: {}", e);
        }
    });

    let row = client
        .query_one("SELECT version()", &[])
        .await
        .map_err(|e| e.to_string())?;
    let version: String = row.get(0);
    Ok(format!("PostgreSQL: {}", version.split_whitespace().take(2).collect::<Vec<_>>().join(" ")))
}

async fn list_postgresql(config: &serde_json::Value) -> Result<Vec<DatabaseResult>, String> {
    let pg_config = build_pg_config(config);
    let (client, connection) = pg_config
        .connect(tokio_postgres::NoTls)
        .await
        .map_err(|e| e.to_string())?;

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("PostgreSQL connection error: {}", e);
        }
    });

    let rows = client
        .query(
            "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname",
            &[],
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut databases = Vec::new();
    for row in rows {
        let db_name: String = row.get(0);
        databases.push(DatabaseResult {
            name: db_name,
            tables: vec![], // Tables loaded on demand when database is expanded
        });
    }

    Ok(databases)
}

// ─── SQLite ───────────────────────────────────────────────────────

async fn test_sqlite(config: &serde_json::Value) -> Result<String, String> {
    let path = config["filePath"]
        .as_str()
        .ok_or("File path is required")?
        .to_string();

    let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let conn = rusqlite::Connection::open(&path).map_err(|e| e.to_string())?;
        let version: String = conn
            .query_row("SELECT sqlite_version()", [], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        Ok(version)
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(format!("SQLite {}", result))
}

async fn list_sqlite(config: &serde_json::Value) -> Result<Vec<DatabaseResult>, String> {
    let path = config["filePath"]
        .as_str()
        .ok_or("File path is required")?
        .to_string();

    let result = tokio::task::spawn_blocking(move || -> Result<Vec<DatabaseResult>, String> {
        let conn = rusqlite::Connection::open(&path).map_err(|e| e.to_string())?;

        let mut tables = Vec::new();
        let mut stmt = conn
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;

        for row in rows {
            if let Ok(name) = row {
                tables.push(TableResult { name });
            }
        }

        Ok(vec![DatabaseResult {
            name: "main".to_string(),
            tables,
        }])
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}

// ─── MongoDB ──────────────────────────────────────────────────────

fn build_mongodb_uri(config: &serde_json::Value, db_type: &str) -> String {
    let prefix = if db_type == "mongodb_srv" {
        "mongodb+srv"
    } else {
        "mongodb"
    };

    if let Some(uri) = config["connectionString"].as_str() {
        if !uri.is_empty() {
            return uri.to_string();
        }
    }

    let user = config["username"].as_str().unwrap_or("");
    let pass = config["password"].as_str().unwrap_or("");

    if db_type == "mongodb_srv" {
        let srv = config["srvAddress"].as_str().unwrap_or("");
        let mut uri = format!("{}://", prefix);
        if !user.is_empty() {
            uri.push_str(user);
            if !pass.is_empty() {
                uri.push(':');
                uri.push_str(pass);
            }
            uri.push('@');
        }
        uri.push_str(srv);
        uri.push_str("/?retryWrites=true&w=majority");
        uri
    } else {
        let host = config["host"].as_str().unwrap_or("localhost");
        let port = config["port"].as_u64().unwrap_or(27017);
        let mut uri = format!("{}://", prefix);
        if !user.is_empty() {
            uri.push_str(user);
            if !pass.is_empty() {
                uri.push(':');
                uri.push_str(pass);
            }
            uri.push('@');
        }
        uri.push_str(&format!("{}:{}", host, port));
        uri
    }
}

async fn test_mongodb(db_type: &str, config: &serde_json::Value) -> Result<String, String> {
    let uri = build_mongodb_uri(config, db_type);
    let client_options = mongodb::options::ClientOptions::parse(&uri)
        .await
        .map_err(|e| e.to_string())?;
    let client = mongodb::Client::with_options(client_options).map_err(|e| e.to_string())?;

    client
        .database("admin")
        .run_command(mongodb::bson::doc! { "ping": 1 }, None)
        .await
        .map_err(|e| e.to_string())?;

    Ok("MongoDB connected successfully".to_string())
}

async fn list_mongodb(
    db_type: &str,
    config: &serde_json::Value,
) -> Result<Vec<DatabaseResult>, String> {
    let uri = build_mongodb_uri(config, db_type);
    let client_options = mongodb::options::ClientOptions::parse(&uri)
        .await
        .map_err(|e| e.to_string())?;
    let client = mongodb::Client::with_options(client_options).map_err(|e| e.to_string())?;

    let db_names = client
        .list_database_names(None, None)
        .await
        .map_err(|e| e.to_string())?;

    let mut databases = Vec::new();
    for db_name in db_names {
        // Skip system databases
        if db_name == "admin" || db_name == "local" || db_name == "config" {
            continue;
        }

        let collections = client
            .database(&db_name)
            .list_collection_names(None)
            .await
            .unwrap_or_default();

        databases.push(DatabaseResult {
            name: db_name,
            tables: collections
                .into_iter()
                .map(|name| TableResult { name })
                .collect(),
        });
    }

    Ok(databases)
}

// ─── Redis ────────────────────────────────────────────────────────

fn build_redis_url(config: &serde_json::Value) -> String {
    if let Some(uri) = config["connectionString"].as_str() {
        if !uri.is_empty() {
            return uri.to_string();
        }
    }

    let host = config["host"].as_str().unwrap_or("localhost");
    let port = config["port"].as_u64().unwrap_or(6379);
    let pass = config["password"].as_str().unwrap_or("");
    let db = config["dbNumber"].as_u64().unwrap_or(0);

    if !pass.is_empty() {
        format!("redis://:{}@{}:{}/{}", pass, host, port, db)
    } else {
        format!("redis://{}:{}/{}", host, port, db)
    }
}

async fn test_redis(config: &serde_json::Value) -> Result<String, String> {
    let url = build_redis_url(config);
    let client = redis::Client::open(url.as_str()).map_err(|e| e.to_string())?;
    let mut con = client
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| e.to_string())?;

    let info: String = redis::cmd("INFO")
        .arg("server")
        .query_async(&mut con)
        .await
        .map_err(|e| e.to_string())?;

    let version = info
        .lines()
        .find(|l| l.starts_with("redis_version:"))
        .and_then(|l| l.split(':').nth(1))
        .unwrap_or("unknown")
        .trim();

    Ok(format!("Redis {}", version))
}

async fn list_redis(config: &serde_json::Value) -> Result<Vec<DatabaseResult>, String> {
    let url = build_redis_url(config);
    let client = redis::Client::open(url.as_str()).map_err(|e| e.to_string())?;
    let mut con = client
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| e.to_string())?;

    let info: String = redis::cmd("INFO")
        .arg("keyspace")
        .query_async(&mut con)
        .await
        .map_err(|e| e.to_string())?;

    let mut databases = Vec::new();

    for line in info.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_suffix(':') {
            // Line like "db0:keys=5,expires=0,avg_ttl=0"
            if let Some((db_name, _)) = rest.split_once(':') {
                databases.push(DatabaseResult {
                    name: db_name.to_string(),
                    tables: vec![],
                });
            }
        } else if let Some((db_name, _)) = line.split_once(':') {
            if db_name.starts_with("db") {
                databases.push(DatabaseResult {
                    name: db_name.to_string(),
                    tables: vec![],
                });
            }
        }
    }

    // If no keyspace info, at least show db0
    if databases.is_empty() {
        databases.push(DatabaseResult {
            name: "db0".to_string(),
            tables: vec![],
        });
    }

    Ok(databases)
}

// ─── Execute Query ────────────────────────────────────────────────

fn mysql_val_to_json(val: mysql_async::Value) -> serde_json::Value {
    use mysql_async::Value;
    match val {
        Value::NULL => serde_json::Value::Null,
        Value::Int(i) => serde_json::Value::Number(i.into()),
        Value::UInt(u) => serde_json::Value::Number(u.into()),
        Value::Float(f) => serde_json::Number::from_f64(f as f64)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        Value::Double(f) => serde_json::Number::from_f64(f)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        Value::Bytes(b) => serde_json::Value::String(String::from_utf8_lossy(&b).to_string()),
        _ => serde_json::Value::String(format!("{:?}", val)),
    }
}

pub async fn execute_query_impl(
    db_type: &str,
    config: serde_json::Value,
    query: String,
    database: Option<String>,
) -> Result<QueryResultData, String> {
    match db_type {
        "mysql" => exec_query_mysql(&config, &query, database.as_deref()).await,
        "postgresql" => exec_query_postgresql(&config, &query, database.as_deref()).await,
        "sqlite" => exec_query_sqlite(&config, &query).await,
        "mongodb" | "mongodb_srv" => exec_query_mongodb(db_type, &config, &query, database.as_deref()).await,
        "redis" => exec_query_redis(&config, &query).await,
        _ => Err(format!("Unsupported database type: {}", db_type)),
    }
}

async fn exec_query_mysql(
    config: &serde_json::Value,
    query: &str,
    database: Option<&str>,
) -> Result<QueryResultData, String> {
    let mut url = build_mysql_url(config);
    if let Some(db) = database {
        if !db.is_empty() && !url.contains('/') {
            url.push('/');
            url.push_str(db);
        }
    }
    let pool = mysql_async::Pool::new(url.as_str());
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let start = std::time::Instant::now();
    let mut result = conn.query_iter(query).await.map_err(|e| e.to_string())?;

    let columns: Vec<String> = result
        .columns()
        .map(|cols| cols.iter().map(|c| c.name_str().to_string()).collect())
        .unwrap_or_default();

    let mut rows = Vec::new();
    let result_set: Vec<mysql_async::Row> = result.collect().await.map_err(|e| e.to_string())?;
    for mut row in result_set {
        let mut json_row = serde_json::Map::new();
        for (i, col) in columns.iter().enumerate() {
            let val = row.take(i).unwrap_or(mysql_async::Value::NULL);
            json_row.insert(col.clone(), mysql_val_to_json(val));
        }
        rows.push(serde_json::Value::Object(json_row));
    }

    let affected = conn.affected_rows();
    let duration = start.elapsed().as_millis() as u64;
    conn.disconnect().await.map_err(|e| e.to_string())?;

    Ok(QueryResultData {
        row_count: rows.len(),
        affected_rows: affected,
        duration,
        success: true,
        error: None,
        columns,
        rows,
    })
}

async fn exec_query_postgresql(
    config: &serde_json::Value,
    query: &str,
    database: Option<&str>,
) -> Result<QueryResultData, String> {
    let mut pg_config = build_pg_config(config);
    if let Some(db) = database {
        if !db.is_empty() {
            pg_config.dbname(db);
        } else {
            pg_config.dbname("postgres");
        }
    } else {
        // Default to postgres database if no database specified
        let cfg_db = config["database"].as_str().unwrap_or("");
        if cfg_db.is_empty() {
            pg_config.dbname("postgres");
        }
    }
    let (client, connection) = pg_config
        .connect(tokio_postgres::NoTls)
        .await
        .map_err(|e| e.to_string())?;
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("PostgreSQL connection error: {}", e);
        }
    });

    let start = std::time::Instant::now();
    let query_lower = query.trim().to_lowercase();

    if query_lower.starts_with("select") || query_lower.starts_with("with") || query_lower.starts_with("show") {
        let rows = client.query(query, &[]).await.map_err(|e| e.to_string())?;
        let columns: Vec<String> = if let Some(first) = rows.first() {
            first.columns().iter().map(|c| c.name().to_string()).collect()
        } else {
            vec![]
        };

        let mut json_rows = Vec::new();
        for row in &rows {
            let mut json_row = serde_json::Map::new();
            for (i, col) in columns.iter().enumerate() {
                let type_name = row.columns()[i].type_().name();
                let val: serde_json::Value = match type_name {
                    "int2" | "int4" => {
                        let v: Option<i32> = row.try_get(i).ok();
                        v.map(|v| serde_json::Value::Number(v.into())).unwrap_or(serde_json::Value::Null)
                    }
                    "int8" => {
                        let v: Option<i64> = row.try_get(i).ok();
                        v.map(|v| serde_json::Value::Number(v.into())).unwrap_or(serde_json::Value::Null)
                    }
                    "float4" | "float8" | "numeric" => {
                        let v: Option<f64> = row.try_get(i).ok();
                        v.and_then(|v| serde_json::Number::from_f64(v).map(serde_json::Value::Number))
                            .unwrap_or(serde_json::Value::Null)
                    }
                    "bool" => {
                        let v: Option<bool> = row.try_get(i).ok();
                        v.map(serde_json::Value::Bool).unwrap_or(serde_json::Value::Null)
                    }
                    "json" | "jsonb" => {
                        let v: Option<serde_json::Value> = row.try_get(i).ok();
                        v.unwrap_or(serde_json::Value::Null)
                    }
                    _ => {
                        let v: Option<String> = row.try_get(i).ok();
                        v.map(serde_json::Value::String).unwrap_or(serde_json::Value::Null)
                    }
                };
                json_row.insert(col.clone(), val);
            }
            json_rows.push(serde_json::Value::Object(json_row));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(QueryResultData {
            row_count: json_rows.len(),
            affected_rows: 0,
            duration,
            success: true,
            error: None,
            columns,
            rows: json_rows,
        })
    } else {
        let affected = client.execute(query, &[]).await.map_err(|e| e.to_string())?;
        let duration = start.elapsed().as_millis() as u64;
        Ok(QueryResultData {
            columns: vec![],
            rows: vec![],
            row_count: 0,
            affected_rows: affected,
            duration,
            success: true,
            error: None,
        })
    }
}

async fn exec_query_sqlite(
    config: &serde_json::Value,
    query: &str,
) -> Result<QueryResultData, String> {
    let path = config["filePath"]
        .as_str()
        .ok_or("File path is required")?
        .to_string();
    let query = query.to_string();

    let result = tokio::task::spawn_blocking(move || -> Result<QueryResultData, String> {
        let conn = rusqlite::Connection::open(&path).map_err(|e| e.to_string())?;
        let start = std::time::Instant::now();

        let query_lower = query.trim().to_lowercase();
        if query_lower.starts_with("select") || query_lower.starts_with("pragma") || query_lower.starts_with("with") {
            let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
            let columns: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
            let column_count = columns.len();

            let rows_iter = stmt.query_map([], |row| {
                let mut map = serde_json::Map::new();
                for i in 0..column_count {
                    let val: rusqlite::types::Value = row.get(i)?;
                    let json_val = match val {
                        rusqlite::types::Value::Null => serde_json::Value::Null,
                        rusqlite::types::Value::Integer(i) => serde_json::Value::Number(i.into()),
                        rusqlite::types::Value::Real(f) => serde_json::Number::from_f64(f)
                            .map(serde_json::Value::Number)
                            .unwrap_or(serde_json::Value::Null),
                        rusqlite::types::Value::Text(s) => serde_json::Value::String(s),
                        rusqlite::types::Value::Blob(b) => serde_json::Value::String(format!("<blob {}B>", b.len())),
                    };
                    map.insert(columns[i].clone(), json_val);
                }
                Ok(serde_json::Value::Object(map))
            }).map_err(|e| e.to_string())?;

            let mut rows = Vec::new();
            for row in rows_iter {
                if let Ok(r) = row {
                    rows.push(r);
                }
            }

            let duration = start.elapsed().as_millis() as u64;
            Ok(QueryResultData {
                row_count: rows.len(),
                affected_rows: 0,
                duration,
                success: true,
                error: None,
                columns,
                rows,
            })
        } else {
            let affected = conn.execute(&query, []).map_err(|e| e.to_string())?;
            let duration = start.elapsed().as_millis() as u64;
            Ok(QueryResultData {
                columns: vec![],
                rows: vec![],
                row_count: 0,
                affected_rows: affected as u64,
                duration,
                success: true,
                error: None,
            })
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}

/// Convert BSON values to clean JSON (ObjectId → string, DateTime → ISO string, etc.)
fn bson_value_to_json(val: &mongodb::bson::Bson) -> serde_json::Value {
    use mongodb::bson::Bson;
    match val {
        Bson::ObjectId(oid) => serde_json::Value::String(oid.to_hex()),
        Bson::DateTime(dt) => serde_json::Value::String(dt.to_string()),
        Bson::Timestamp(ts) => serde_json::json!({
            "t": ts.time,
            "i": ts.increment
        }),
        Bson::Binary(bin) => serde_json::Value::String(
            format!("Binary({} bytes)", bin.bytes.len())
        ),
        Bson::Decimal128(d) => serde_json::Value::String(d.to_string()),
        Bson::RegularExpression(re) => serde_json::Value::String(
            format!("/{}/{}", re.pattern, re.options)
        ),
        Bson::Document(doc) => bson_doc_to_json(doc),
        Bson::Array(arr) => serde_json::Value::Array(
            arr.iter().map(bson_value_to_json).collect()
        ),
        Bson::Boolean(b) => serde_json::Value::Bool(*b),
        Bson::Int32(i) => serde_json::Value::Number((*i).into()),
        Bson::Int64(i) => serde_json::Value::Number((*i).into()),
        Bson::Double(f) => serde_json::Number::from_f64(*f)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        Bson::String(s) => serde_json::Value::String(s.clone()),
        Bson::Null => serde_json::Value::Null,
        _ => serde_json::Value::String(format!("{}", val)),
    }
}

fn bson_doc_to_json(doc: &mongodb::bson::Document) -> serde_json::Value {
    let mut map = serde_json::Map::new();
    for (key, val) in doc.iter() {
        map.insert(key.clone(), bson_value_to_json(val));
    }
    serde_json::Value::Object(map)
}

async fn exec_query_mongodb(
    db_type: &str,
    config: &serde_json::Value,
    query: &str,
    database: Option<&str>,
) -> Result<QueryResultData, String> {
    let uri = build_mongodb_uri(config, db_type);
    let client_options = mongodb::options::ClientOptions::parse(&uri)
        .await
        .map_err(|e| e.to_string())?;
    let client = mongodb::Client::with_options(client_options).map_err(|e| e.to_string())?;

    let db_name = database.unwrap_or("test");
    let start = std::time::Instant::now();

    // Parse query as JSON command object
    let parsed: serde_json::Value = serde_json::from_str(query).map_err(|e| e.to_string())?;
    let collection_name = parsed["collection"].as_str().unwrap_or("test");
    let collection = client
        .database(db_name)
        .collection::<mongodb::bson::Document>(collection_name);

    // Determine operation (default: find)
    let operation = parsed["operation"].as_str().unwrap_or("find");

    let duration_result = match operation {
        "find" => {
            let filter_val = if let Some(f) = parsed.get("filter") {
                f.clone()
            } else {
                serde_json::Value::Object(serde_json::Map::new())
            };
            let filter_doc: mongodb::bson::Document =
                serde_json::from_value(filter_val).map_err(|e| e.to_string())?;

            let limit = parsed["limit"].as_i64().unwrap_or(10000) as u64;
            let skip = parsed["skip"].as_i64().unwrap_or(0) as u64;

            let find_options = mongodb::options::FindOptions::builder()
                .limit(Some(limit as i64))
                .skip(Some(skip))
                .build();

            let cursor = collection
                .find(filter_doc, Some(find_options))
                .await
                .map_err(|e| e.to_string())?;

            use futures::stream::TryStreamExt;
            let docs: Vec<mongodb::bson::Document> = cursor.try_collect().await.map_err(|e| e.to_string())?;
            let doc_count = docs.len();

            let mut all_keys: Vec<String> = Vec::new();
            let mut json_rows = Vec::new();
            for doc in &docs {
                let val = bson_doc_to_json(doc);
                if let serde_json::Value::Object(ref map) = val {
                    for key in map.keys() {
                        if !all_keys.contains(key) {
                            all_keys.push(key.clone());
                        }
                    }
                }
                json_rows.push(val);
            }

            let duration = start.elapsed().as_millis() as u64;
            Ok(QueryResultData {
                columns: all_keys,
                rows: json_rows,
                row_count: doc_count,
                affected_rows: 0,
                duration,
                success: true,
                error: None,
            })
        }
        "insertOne" => {
            let doc_val = parsed.get("document")
                .ok_or_else(|| "insertOne requires 'document' field".to_string())?;
            let doc: mongodb::bson::Document =
                serde_json::from_value(doc_val.clone()).map_err(|e| e.to_string())?;

            let result = collection
                .insert_one(doc, None)
                .await
                .map_err(|e| e.to_string())?;

            let duration = start.elapsed().as_millis() as u64;
            Ok(QueryResultData {
                columns: vec!["insertedId".to_string()],
                rows: vec![serde_json::json!({ "insertedId": format!("{:?}", result.inserted_id) })],
                row_count: 0,
                affected_rows: 1,
                duration,
                success: true,
                error: None,
            })
        }
        "insertMany" => {
            let docs_val = parsed.get("documents")
                .and_then(|v| v.as_array())
                .ok_or_else(|| "insertMany requires 'documents' array field".to_string())?;

            let docs: Vec<mongodb::bson::Document> = docs_val
                .iter()
                .map(|v| serde_json::from_value(v.clone()))
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;

            let count = docs.len() as u64;
            let result = collection
                .insert_many(docs, None)
                .await
                .map_err(|e| e.to_string())?;

            let duration = start.elapsed().as_millis() as u64;
            Ok(QueryResultData {
                columns: vec!["insertedCount".to_string()],
                rows: vec![serde_json::json!({ "insertedCount": result.inserted_ids.len() })],
                row_count: 0,
                affected_rows: count,
                duration,
                success: true,
                error: None,
            })
        }
        "updateMany" => {
            let filter_doc: mongodb::bson::Document = parsed.get("filter")
                .map(|v| serde_json::from_value(v.clone()))
                .transpose()
                .map_err(|e| e.to_string())?
                .unwrap_or_default();
            let update_doc: mongodb::bson::Document = parsed.get("update")
                .map(|v| serde_json::from_value(v.clone()))
                .transpose()
                .map_err(|e| e.to_string())?
                .unwrap_or_default();

            let result = collection
                .update_many(filter_doc, update_doc, None)
                .await
                .map_err(|e| e.to_string())?;

            let duration = start.elapsed().as_millis() as u64;
            Ok(QueryResultData {
                columns: vec!["matchedCount".to_string(), "modifiedCount".to_string()],
                rows: vec![serde_json::json!({
                    "matchedCount": result.matched_count,
                    "modifiedCount": result.modified_count
                })],
                row_count: 0,
                affected_rows: result.modified_count,
                duration,
                success: true,
                error: None,
            })
        }
        "deleteMany" => {
            let filter_doc: mongodb::bson::Document = parsed.get("filter")
                .map(|v| serde_json::from_value(v.clone()))
                .transpose()
                .map_err(|e| e.to_string())?
                .unwrap_or_default();

            let result = collection
                .delete_many(filter_doc, None)
                .await
                .map_err(|e| e.to_string())?;

            let duration = start.elapsed().as_millis() as u64;
            Ok(QueryResultData {
                columns: vec!["deletedCount".to_string()],
                rows: vec![serde_json::json!({ "deletedCount": result.deleted_count })],
                row_count: 0,
                affected_rows: result.deleted_count,
                duration,
                success: true,
                error: None,
            })
        }
        "count" => {
            let filter_doc: mongodb::bson::Document = parsed.get("filter")
                .map(|v| serde_json::from_value(v.clone()))
                .transpose()
                .map_err(|e| e.to_string())?
                .unwrap_or_default();

            let count = collection
                .count_documents(filter_doc, None)
                .await
                .map_err(|e| e.to_string())?;

            let duration = start.elapsed().as_millis() as u64;
            Ok(QueryResultData {
                columns: vec!["count".to_string()],
                rows: vec![serde_json::json!({ "count": count })],
                row_count: 1,
                affected_rows: 0,
                duration,
                success: true,
                error: None,
            })
        }
        "aggregate" => {
            let pipeline_val = parsed.get("pipeline")
                .and_then(|v| v.as_array())
                .ok_or_else(|| "aggregate requires 'pipeline' array field".to_string())?;

            let pipeline: Vec<mongodb::bson::Document> = pipeline_val
                .iter()
                .map(|v| serde_json::from_value(v.clone()))
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;

            let cursor = collection
                .aggregate(pipeline, None)
                .await
                .map_err(|e| e.to_string())?;

            use futures::stream::TryStreamExt;
            let docs: Vec<mongodb::bson::Document> = cursor.try_collect().await.map_err(|e| e.to_string())?;
            let doc_count = docs.len();

            let mut all_keys: Vec<String> = Vec::new();
            let mut json_rows = Vec::new();
            for doc in &docs {
                let val = bson_doc_to_json(doc);
                if let serde_json::Value::Object(ref map) = val {
                    for key in map.keys() {
                        if !all_keys.contains(key) {
                            all_keys.push(key.clone());
                        }
                    }
                }
                json_rows.push(val);
            }

            let duration = start.elapsed().as_millis() as u64;
            Ok(QueryResultData {
                columns: all_keys,
                rows: json_rows,
                row_count: doc_count,
                affected_rows: 0,
                duration,
                success: true,
                error: None,
            })
        }
        "createCollection" => {
            client
                .database(db_name)
                .create_collection(collection_name, None)
                .await
                .map_err(|e| e.to_string())?;

            let duration = start.elapsed().as_millis() as u64;
            Ok(QueryResultData {
                columns: vec!["result".to_string()],
                rows: vec![serde_json::json!({ "result": format!("Collection '{}' created", collection_name) })],
                row_count: 1,
                affected_rows: 0,
                duration,
                success: true,
                error: None,
            })
        }
        "dropCollection" => {
            client
                .database(db_name)
                .collection::<mongodb::bson::Document>(collection_name)
                .drop(None)
                .await
                .map_err(|e| e.to_string())?;

            let duration = start.elapsed().as_millis() as u64;
            Ok(QueryResultData {
                columns: vec!["result".to_string()],
                rows: vec![serde_json::json!({ "result": format!("Collection '{}' dropped", collection_name) })],
                row_count: 1,
                affected_rows: 0,
                duration,
                success: true,
                error: None,
            })
        }
        "dropDatabase" => {
            client
                .database(db_name)
                .drop(None)
                .await
                .map_err(|e| e.to_string())?;

            let duration = start.elapsed().as_millis() as u64;
            Ok(QueryResultData {
                columns: vec!["result".to_string()],
                rows: vec![serde_json::json!({ "result": format!("Database '{}' dropped", db_name) })],
                row_count: 1,
                affected_rows: 0,
                duration,
                success: true,
                error: None,
            })
        }
        _ => Err(format!("Unsupported MongoDB operation: {}", operation)),
    };

    duration_result
}

async fn exec_query_redis(
    config: &serde_json::Value,
    query: &str,
) -> Result<QueryResultData, String> {
    let url = build_redis_url(config);
    let client = redis::Client::open(url.as_str()).map_err(|e| e.to_string())?;
    let mut con = client
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| e.to_string())?;

    let start = std::time::Instant::now();
    let parts: Vec<&str> = query.split_whitespace().collect();
    if parts.is_empty() {
        return Err("Empty query".to_string());
    }

    let mut cmd = redis::cmd(parts[0]);
    for part in &parts[1..] {
        cmd.arg(*part);
    }

    let result: redis::Value = cmd.query_async(&mut con).await.map_err(|e| e.to_string())?;
    let result_str = format!("{:?}", result);
    let duration = start.elapsed().as_millis() as u64;

    Ok(QueryResultData {
        columns: vec!["result".to_string()],
        rows: vec![serde_json::json!({"result": result_str})],
        row_count: 1,
        affected_rows: 0,
        duration,
        success: true,
        error: None,
    })
}

// ─── Get Table Structure ──────────────────────────────────────────

pub async fn get_table_structure_impl(
    db_type: &str,
    config: serde_json::Value,
    database: &str,
    table: &str,
) -> Result<TableStructureData, String> {
    match db_type {
        "mysql" => get_structure_mysql(&config, database, table).await,
        "postgresql" => get_structure_postgresql(&config, database, table).await,
        "sqlite" => get_structure_sqlite(&config, table).await,
        _ => Err(format!("Table structure not supported for: {}", db_type)),
    }
}

async fn get_structure_mysql(
    config: &serde_json::Value,
    database: &str,
    table: &str,
) -> Result<TableStructureData, String> {
    let url = build_mysql_url(config);
    let pool = mysql_async::Pool::new(url.as_str());
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let safe_db = database.replace('\'', "''");
    let safe_table = table.replace('\'', "''");

    // Columns
    let col_rows: Vec<(String, String, String, String, String, String, String)> = conn
        .query(format!(
            "SELECT COLUMN_NAME, COLUMN_TYPE, IFNULL(CHARACTER_MAXIMUM_LENGTH,''), IFNULL(COLUMN_DEFAULT,''), IS_NULLABLE, COLUMN_KEY, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='{}' AND TABLE_NAME='{}' ORDER BY ORDINAL_POSITION",
            safe_db, safe_table
        ))
        .await
        .map_err(|e| e.to_string())?;

    let columns: Vec<ColumnData> = col_rows
        .into_iter()
        .map(|(name, col_type, length, default_val, nullable, key, extra)| {
            let len: Option<u32> = length.parse().ok();
            ColumnData {
                name,
                r#type: col_type,
                length: len,
                default_value: if default_val.is_empty() { None } else { Some(default_val) },
                nullable: nullable == "YES",
                primary_key: key == "PRI",
                auto_increment: extra.contains("auto_increment"),
                comment: String::new(),
            }
        })
        .collect();

    // Indexes
    let idx_rows: Vec<(String, String, String, String)> = conn
        .query(format!(
            "SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, INDEX_TYPE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='{}' AND TABLE_NAME='{}' ORDER BY INDEX_NAME, SEQ_IN_INDEX",
            safe_db, safe_table
        ))
        .await
        .unwrap_or_default();

    let mut index_map: std::collections::HashMap<String, (Vec<String>, bool, String)> = std::collections::HashMap::new();
    for (idx_name, col_name, non_unique, idx_type) in idx_rows {
        let entry = index_map.entry(idx_name).or_insert_with(|| (Vec::new(), true, idx_type.clone()));
        entry.0.push(col_name);
        entry.1 = non_unique == "0";
    }
    let indexes: Vec<IndexData> = index_map
        .into_iter()
        .map(|(name, (cols, unique, idx_type))| IndexData { name, columns: cols, unique, r#type: idx_type })
        .collect();

    // Foreign Keys
    let fk_rows: Vec<(String, String, String, String, String, String)> = conn
        .query(format!(
            "SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME, DELETE_RULE, UPDATE_RULE FROM information_schema.KEY_COLUMN_USAGE kcu JOIN information_schema.REFERENTIAL_CONSTRAINTS rc ON kcu.CONSTRAINT_NAME=rc.CONSTRAINT_NAME AND kcu.TABLE_SCHEMA=rc.CONSTRAINT_SCHEMA WHERE kcu.TABLE_SCHEMA='{}' AND kcu.TABLE_NAME='{}' AND REFERENCED_TABLE_NAME IS NOT NULL",
            safe_db, safe_table
        ))
        .await
        .unwrap_or_default();

    let mut fk_map: std::collections::HashMap<String, (Vec<String>, String, Vec<String>, String, String)> = std::collections::HashMap::new();
    for (name, col, ref_table, ref_col, on_del, on_upd) in fk_rows {
        let entry = fk_map.entry(name).or_insert_with(|| (Vec::new(), ref_table, Vec::new(), on_del, on_upd));
        entry.0.push(col);
        entry.2.push(ref_col);
    }
    let foreign_keys: Vec<ForeignKeyData> = fk_map
        .into_iter()
        .map(|(name, (cols, ref_table, ref_cols, on_del, on_upd))| ForeignKeyData {
            name, columns: cols, referenced_table: ref_table, referenced_columns: ref_cols,
            on_delete: on_del, on_update: on_upd,
        })
        .collect();

    conn.disconnect().await.map_err(|e| e.to_string())?;
    Ok(TableStructureData { columns, indexes, foreign_keys })
}

async fn get_structure_postgresql(
    config: &serde_json::Value,
    database: &str,
    table: &str,
) -> Result<TableStructureData, String> {
    let mut pg_config = build_pg_config(config);
    if !database.is_empty() {
        pg_config.dbname(database);
    }
    let (client, connection) = pg_config
        .connect(tokio_postgres::NoTls)
        .await
        .map_err(|e| e.to_string())?;
    tokio::spawn(async move {
        if let Err(e) = connection.await { eprintln!("PG error: {}", e); }
    });

    // Columns
    let col_rows = client
        .query(
            "SELECT column_name, data_type, COALESCE(character_maximum_length::text,''), COALESCE(column_default,''), is_nullable FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position",
            &[&table],
        )
        .await
        .map_err(|e| e.to_string())?;

    let pk_rows = client
        .query(
            "SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey) WHERE i.indrelid=$1::regclass AND i.indisprimary",
            &[&table],
        )
        .await
        .unwrap_or_default();
    let pk_cols: Vec<String> = pk_rows.iter().map(|r| r.get::<_, String>(0)).collect();

    let columns: Vec<ColumnData> = col_rows
        .into_iter()
        .map(|row| {
            let name: String = row.get(0);
            let col_type: String = row.get(1);
            let length: String = row.get(2);
            let default_val: String = row.get(3);
            let nullable: String = row.get(4);
            ColumnData {
                name: name.clone(),
                r#type: col_type,
                length: length.parse().ok(),
                default_value: if default_val.is_empty() { None } else { Some(default_val) },
                nullable: nullable == "YES",
                primary_key: pk_cols.contains(&name),
                auto_increment: false,
                comment: String::new(),
            }
        })
        .collect();

    // Indexes
    let idx_rows = client
        .query(
            "SELECT indexname, indexdef FROM pg_indexes WHERE tablename=$1",
            &[&table],
        )
        .await
        .unwrap_or_default();

    let indexes: Vec<IndexData> = idx_rows
        .into_iter()
        .map(|row| {
            let name: String = row.get(0);
            let def: String = row.get(1);
            let unique = def.contains("UNIQUE");
            let cols_str = if def.contains('(') && def.contains(')') {
                let start = def.find('(').unwrap() + 1;
                let end = def.rfind(')').unwrap();
                def[start..end].to_string()
            } else {
                String::new()
            };
            let cols: Vec<String> = cols_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            IndexData { name, columns: cols, unique, r#type: "BTREE".to_string() }
        })
        .collect();

    // Foreign Keys
    let fk_rows = client
        .query(
            "SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_col, rc.delete_rule, rc.update_rule FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name JOIN information_schema.referential_constraints rc ON rc.constraint_name=tc.constraint_name WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_name=$1",
            &[&table],
        )
        .await
        .unwrap_or_default();

    let mut fk_map: std::collections::HashMap<String, (Vec<String>, String, Vec<String>, String, String)> = std::collections::HashMap::new();
    for row in fk_rows {
        let name: String = row.get(0);
        let col: String = row.get(1);
        let ref_table: String = row.get(2);
        let ref_col: String = row.get(3);
        let on_del: String = row.get(4);
        let on_upd: String = row.get(5);
        let entry = fk_map.entry(name).or_insert_with(|| (Vec::new(), ref_table, Vec::new(), on_del, on_upd));
        entry.0.push(col);
        entry.2.push(ref_col);
    }
    let foreign_keys: Vec<ForeignKeyData> = fk_map
        .into_iter()
        .map(|(name, (cols, ref_table, ref_cols, on_del, on_upd))| ForeignKeyData {
            name, columns: cols, referenced_table: ref_table, referenced_columns: ref_cols,
            on_delete: on_del, on_update: on_upd,
        })
        .collect();

    Ok(TableStructureData { columns, indexes, foreign_keys })
}

async fn get_structure_sqlite(
    config: &serde_json::Value,
    table: &str,
) -> Result<TableStructureData, String> {
    let path = config["filePath"].as_str().ok_or("File path is required")?.to_string();
    let table = table.to_string();

    let result = tokio::task::spawn_blocking(move || -> Result<TableStructureData, String> {
        let conn = rusqlite::Connection::open(&path).map_err(|e| e.to_string())?;

        // Columns via PRAGMA
        let mut col_stmt = conn.prepare(&format!("PRAGMA table_info('{}')", table.replace('\'', "''"))).map_err(|e| e.to_string())?;
        let col_rows = col_stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(1)?, // name
                row.get::<_, String>(2)?, // type
                row.get::<_, bool>(3)?,   // notnull
                row.get::<_, Option<String>>(4)?, // dflt_value
                row.get::<_, bool>(5)?,   // pk
            ))
        }).map_err(|e| e.to_string())?;

        let mut columns = Vec::new();
        for row in col_rows {
            if let Ok((name, col_type, not_null, default_val, is_pk)) = row {
                columns.push(ColumnData {
                    name,
                    r#type: col_type,
                    length: None,
                    default_value: default_val,
                    nullable: !not_null,
                    primary_key: is_pk,
                    auto_increment: false,
                    comment: String::new(),
                });
            }
        }

        // Indexes via PRAGMA
        let mut idx_stmt = conn.prepare(&format!("PRAGMA index_list('{}')", table.replace('\'', "''"))).map_err(|e| e.to_string())?;
        let idx_rows = idx_stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(1)?, // name
                row.get::<_, bool>(2)?,   // unique
            ))
        }).map_err(|e| e.to_string())?;

        let mut indexes = Vec::new();
        for idx_row in idx_rows {
            if let Ok((idx_name, unique)) = idx_row {
                let mut info_stmt = conn.prepare(&format!("PRAGMA index_info('{}')", idx_name.replace('\'', "''"))).map_err(|e| e.to_string())?;
                let info_rows = info_stmt.query_map([], |row| row.get::<_, String>(2)).map_err(|e| e.to_string())?;
                let cols: Vec<String> = info_rows.filter_map(|r| r.ok()).collect();
                indexes.push(IndexData {
                    name: idx_name,
                    columns: cols,
                    unique,
                    r#type: "BTREE".to_string(),
                });
            }
        }

        // Foreign keys via PRAGMA
        let mut fk_stmt = conn.prepare(&format!("PRAGMA foreign_key_list('{}')", table.replace('\'', "''"))).map_err(|e| e.to_string())?;
        let fk_rows = fk_stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(3)?, // table
                row.get::<_, String>(4)?, // from
                row.get::<_, String>(5)?, // to
                row.get::<_, String>(6)?, // on_update
                row.get::<_, String>(7)?, // on_delete
            ))
        }).map_err(|e| e.to_string())?;

        let mut foreign_keys = Vec::new();
        for fk_row in fk_rows {
            if let Ok((ref_table, from_col, to_col, on_upd, on_del)) = fk_row {
                foreign_keys.push(ForeignKeyData {
                    name: format!("fk_{}_{}", table, from_col),
                    columns: vec![from_col],
                    referenced_table: ref_table,
                    referenced_columns: vec![to_col],
                    on_delete: on_del,
                    on_update: on_upd,
                });
            }
        }

        Ok(TableStructureData { columns, indexes, foreign_keys })
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}

// ─── Get ER Diagram Data ──────────────────────────────────────────

pub async fn get_er_data_impl(
    db_type: &str,
    config: serde_json::Value,
    database: &str,
) -> Result<ERDiagramData, String> {
    match db_type {
        "mysql" => get_er_mysql(&config, database).await,
        "postgresql" => get_er_postgresql(&config, database).await,
        "sqlite" => get_er_sqlite(&config).await,
        _ => Err(format!("ER diagram not supported for: {}", db_type)),
    }
}

async fn get_er_mysql(config: &serde_json::Value, database: &str) -> Result<ERDiagramData, String> {
    let url = build_mysql_url(config);
    let pool = mysql_async::Pool::new(url.as_str());
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;
    let safe_db = database.replace('\'', "''");

    // Get tables and columns
    let table_rows: Vec<(String,)> = conn
        .query(format!("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='{}'", safe_db))
        .await
        .map_err(|e| e.to_string())?;

    let mut tables = Vec::new();
    for (table_name,) in &table_rows {
        let col_rows: Vec<(String, String, String, String)> = conn
            .query(format!(
                "SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_KEY, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='{}' AND TABLE_NAME='{}' ORDER BY ORDINAL_POSITION",
                safe_db, table_name.replace('\'', "''")
            ))
            .await
            .unwrap_or_default();

        let columns: Vec<ERColumnData> = col_rows
            .into_iter()
            .map(|(name, col_type, key, _extra)| ERColumnData {
                name, r#type: col_type, pk: key == "PRI", fk: None,
            })
            .collect();
        tables.push(ERTableData { name: table_name.clone(), columns });
    }

    // Get foreign keys
    let fk_rows: Vec<(String, String, String, String)> = conn
        .query(format!(
            "SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='{}' AND REFERENCED_TABLE_NAME IS NOT NULL",
            safe_db
        ))
        .await
        .unwrap_or_default();

    let mut relations = Vec::new();
    for (from_table, from_col, to_table, to_col) in &fk_rows {
        // Mark FK on column
        if let Some(t) = tables.iter_mut().find(|t| &t.name == from_table) {
            if let Some(c) = t.columns.iter_mut().find(|c| &c.name == from_col) {
                c.fk = Some(format!("{}.{}", to_table, to_col));
            }
        }
        relations.push(ERRelationData {
            from_table: from_table.clone(),
            from_column: from_col.clone(),
            to_table: to_table.clone(),
            to_column: to_col.clone(),
        });
    }

    conn.disconnect().await.map_err(|e| e.to_string())?;
    Ok(ERDiagramData { tables, relations })
}

async fn get_er_postgresql(config: &serde_json::Value, database: &str) -> Result<ERDiagramData, String> {
    let mut pg_config = build_pg_config(config);
    if !database.is_empty() {
        pg_config.dbname(database);
    }
    let (client, connection) = pg_config.connect(tokio_postgres::NoTls).await.map_err(|e| e.to_string())?;
    tokio::spawn(async move {
        if let Err(e) = connection.await { eprintln!("PG error: {}", e); }
    });

    let table_rows = client
        .query("SELECT tablename FROM pg_tables WHERE schemaname='public'", &[])
        .await
        .map_err(|e| e.to_string())?;

    let mut tables = Vec::new();
    for row in &table_rows {
        let table_name: String = row.get(0);
        let col_rows = client
            .query(
                "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position",
                &[&table_name],
            )
            .await
            .unwrap_or_default();

        let pk_rows = client
            .query(
                "SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey) WHERE i.indrelid=$1::regclass AND i.indisprimary",
                &[&table_name],
            )
            .await
            .unwrap_or_default();
        let pk_names: Vec<String> = pk_rows.iter().map(|r| r.get::<_, String>(0)).collect();

        let columns: Vec<ERColumnData> = col_rows
            .into_iter()
            .map(|r| {
                let name: String = r.get(0);
                ERColumnData {
                    name: name.clone(),
                    r#type: r.get::<_, String>(1),
                    pk: pk_names.contains(&name),
                    fk: None,
                }
            })
            .collect();
        tables.push(ERTableData { name: table_name, columns });
    }

    // Foreign keys
    let fk_rows = client
        .query(
            "SELECT tc.table_name, kcu.column_name, ccu.table_name, ccu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'",
            &[],
        )
        .await
        .unwrap_or_default();

    let mut relations = Vec::new();
    for row in &fk_rows {
        let from_table: String = row.get(0);
        let from_col: String = row.get(1);
        let to_table: String = row.get(2);
        let to_col: String = row.get(3);
        if let Some(t) = tables.iter_mut().find(|t| t.name == from_table) {
            if let Some(c) = t.columns.iter_mut().find(|c| c.name == from_col) {
                c.fk = Some(format!("{}.{}", to_table, to_col));
            }
        }
        relations.push(ERRelationData { from_table, from_column: from_col, to_table, to_column: to_col });
    }

    Ok(ERDiagramData { tables, relations })
}

async fn get_er_sqlite(config: &serde_json::Value) -> Result<ERDiagramData, String> {
    let path = config["filePath"].as_str().ok_or("File path is required")?.to_string();

    let result = tokio::task::spawn_blocking(move || -> Result<ERDiagramData, String> {
        let conn = rusqlite::Connection::open(&path).map_err(|e| e.to_string())?;

        let mut table_stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            .map_err(|e| e.to_string())?;
        let table_names: Vec<String> = table_stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let mut tables = Vec::new();
        let mut relations = Vec::new();

        for table_name in &table_names {
            let safe = table_name.replace('\'', "''");
            let mut col_stmt = conn.prepare(&format!("PRAGMA table_info('{}')", safe)).map_err(|e| e.to_string())?;
            let col_rows = col_stmt.query_map([], |row| {
                Ok((row.get::<_, String>(1)?, row.get::<_, String>(2)?, row.get::<_, bool>(5)?))
            }).map_err(|e| e.to_string())?;

            let mut columns = Vec::new();
            for cr in col_rows {
                if let Ok((name, col_type, is_pk)) = cr {
                    columns.push(ERColumnData { name, r#type: col_type, pk: is_pk, fk: None });
                }
            }

            // Foreign keys
            let mut fk_stmt = conn.prepare(&format!("PRAGMA foreign_key_list('{}')", safe)).map_err(|e| e.to_string())?;
            let fk_rows = fk_stmt.query_map([], |row| {
                Ok((row.get::<_, String>(2)?, row.get::<_, String>(3)?, row.get::<_, String>(4)?))
            }).map_err(|e| e.to_string())?;

            for fkr in fk_rows {
                if let Ok((ref_table, from_col, to_col)) = fkr {
                    if let Some(c) = columns.iter_mut().find(|c| c.name == from_col) {
                        c.fk = Some(format!("{}.{}", ref_table, to_col));
                    }
                    relations.push(ERRelationData {
                        from_table: table_name.clone(),
                        from_column: from_col,
                        to_table: ref_table,
                        to_column: to_col,
                    });
                }
            }

            tables.push(ERTableData { name: table_name.clone(), columns });
        }

        Ok(ERDiagramData { tables, relations })
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}
