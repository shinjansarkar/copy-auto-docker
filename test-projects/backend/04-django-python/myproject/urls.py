from django.urls import path
from django.http import JsonResponse

def home(request):
    return JsonResponse({"message": "Django Python API - Testing Auto-Docker Extension"})

def health(request):
    return JsonResponse({"status": "healthy"})

urlpatterns = [
    path('', home),
    path('health/', health),
]
