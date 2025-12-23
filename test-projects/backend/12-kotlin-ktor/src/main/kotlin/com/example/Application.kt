package com.example

import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun main() {
    embeddedServer(Netty, port = 8080, host = "0.0.0.0") {
        routing {
            get("/") {
                call.respond(mapOf("message" to "Kotlin Ktor API - Testing Auto-Docker Extension"))
            }
            get("/health") {
                call.respond(mapOf("status" to "healthy"))
            }
        }
    }.start(wait = true)
}
