mod file_api;

use async_graphql::{
    http::{playground_source, GraphQLPlaygroundConfig},
    EmptySubscription, Request, Response, Schema,
};
use axum::{
    extract::Extension,
    response::{Html, IntoResponse},
    routing::get,
    AddExtensionLayer, Json, Router,
};
use rusqlite::Connection;
use tower_http::cors::{any, CorsLayer};

async fn graphql_handler(
    schema: Extension<file_api::FileAPISchema>,
    req: Json<Request>,
) -> Json<Response> {
    schema.execute(req.0).await.into()
}

async fn graphql_playground() -> impl IntoResponse {
    Html(playground_source(GraphQLPlaygroundConfig::new("/")))
}

#[tokio::main]
async fn main() {
    let root_dir = xdg::BaseDirectories::with_prefix("file_storage_api").unwrap();
    let db_path = root_dir.get_cache_home().join("storage.db");
    let conn = Connection::open(&db_path).unwrap();

    // Create table
    conn.execute(
        "create table if not exists storage (
            id TEXT PRIMARY KEY,
            name TEXT,
            created_date TEXT,
            file_size INTEGER,
            CONTENTS BLOB
        );",
        [],
    )
    .unwrap();

    let schema = Schema::build(file_api::Query, file_api::Mutation, EmptySubscription)
        .data(db_path)
        .finish();

    println!("{}", &schema.sdl());

    let app = Router::new()
        .route("/", get(graphql_playground).post(graphql_handler))
        .layer(
            CorsLayer::new()
                .allow_origin(any())
                .allow_methods(any())
                .allow_headers(any()),
        )
        .layer(AddExtensionLayer::new(schema));

    println!("Playground: http://localhost:5000");

    axum::Server::bind(&"0.0.0.0:5000".parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap();
}
