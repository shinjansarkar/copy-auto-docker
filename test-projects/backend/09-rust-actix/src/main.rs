use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use serde::Serialize;

#[derive(Serialize)]
struct Message {
    message: String,
}

#[derive(Serialize)]
struct Health {
    status: String,
}

async fn index() -> impl Responder {
    HttpResponse::Ok().json(Message {
        message: "Rust Actix API - Testing Auto-Docker Extension".to_string(),
    })
}

async fn health() -> impl Responder {
    HttpResponse::Ok().json(Health {
        status: "healthy".to_string(),
    })
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .route("/", web::get().to(index))
            .route("/health", web::get().to(health))
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
}
