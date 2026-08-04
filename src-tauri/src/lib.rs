mod conn_manager;
mod db;

use db::{
    list_databases_impl, test_connection_impl, execute_query_impl,
    get_table_structure_impl, get_er_data_impl, get_table_ddl_impl,
    redis_scan_keys_impl, redis_get_key_impl, redis_delete_key_impl, redis_set_key_impl,
    DatabaseResult, QueryResultData, TableStructureData, ERDiagramData,
};

#[tauri::command]
async fn test_connection(db_type: String, config: serde_json::Value) -> Result<String, String> {
    test_connection_impl(&db_type, config).await
}

#[tauri::command]
async fn list_databases(
    db_type: String,
    config: serde_json::Value,
) -> Result<Vec<DatabaseResult>, String> {
    list_databases_impl(&db_type, config).await
}

#[tauri::command]
async fn execute_query(
    db_type: String,
    config: serde_json::Value,
    query: String,
    database: Option<String>,
) -> Result<QueryResultData, String> {
    execute_query_impl(&db_type, config, query, database).await
}

#[tauri::command]
async fn get_table_structure(
    db_type: String,
    config: serde_json::Value,
    database: String,
    table: String,
) -> Result<TableStructureData, String> {
    get_table_structure_impl(&db_type, config, &database, &table).await
}

#[tauri::command]
async fn get_er_data(
    db_type: String,
    config: serde_json::Value,
    database: String,
) -> Result<ERDiagramData, String> {
    get_er_data_impl(&db_type, config, &database).await
}

#[tauri::command]
async fn get_table_ddl(
    db_type: String,
    config: serde_json::Value,
    database: String,
    table: String,
) -> Result<String, String> {
    get_table_ddl_impl(&db_type, config, &database, &table).await
}

#[tauri::command]
async fn redis_scan_keys(
    config: serde_json::Value,
    database: Option<u64>,
    pattern: Option<String>,
    limit: Option<u64>,
) -> Result<Vec<String>, String> {
    redis_scan_keys_impl(config, database, pattern, limit).await
}

#[tauri::command]
async fn redis_get_key(
    config: serde_json::Value,
    database: Option<u64>,
    key: String,
) -> Result<serde_json::Value, String> {
    redis_get_key_impl(config, database, key).await
}

#[tauri::command]
async fn redis_delete_key(
    config: serde_json::Value,
    database: Option<u64>,
    keys: Vec<String>,
) -> Result<u64, String> {
    redis_delete_key_impl(config, database, keys).await
}

#[tauri::command]
async fn redis_set_key(
    config: serde_json::Value,
    database: Option<u64>,
    key: String,
    value: String,
) -> Result<(), String> {
    redis_set_key_impl(config, database, key, value).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            test_connection,
            list_databases,
            execute_query,
            get_table_structure,
            get_er_data,
            get_table_ddl,
            redis_scan_keys,
            redis_get_key,
            redis_delete_key,
            redis_set_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
