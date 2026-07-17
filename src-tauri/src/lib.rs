mod db;

use db::{
    list_databases_impl, test_connection_impl, execute_query_impl,
    get_table_structure_impl, get_er_data_impl,
    DatabaseResult, QueryResultData, TableStructureData, ERDiagramData,
};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            test_connection,
            list_databases,
            execute_query,
            get_table_structure,
            get_er_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
