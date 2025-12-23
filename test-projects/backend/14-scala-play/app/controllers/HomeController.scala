package controllers

import javax.inject._
import play.api.mvc._
import play.api.libs.json._

@Singleton
class HomeController @Inject()(cc: ControllerComponents) extends AbstractController(cc) {

  def index() = Action {
    Ok(Json.obj("message" -> "Scala Play API - Testing Auto-Docker Extension"))
  }

  def health() = Action {
    Ok(Json.obj("status" -> "healthy"))
  }
}
