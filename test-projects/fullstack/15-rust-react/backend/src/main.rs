use actix_web::{web, App, HttpResponse, HttpServer};

async fn index() -> HttpResponse {
    HttpResponse::Ok().body("Rust + React API")
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| App::new().route("/api", web::get().to(index)))
        .bind(("0.0.0.0", 8080))?
        .run()
        .await
}
