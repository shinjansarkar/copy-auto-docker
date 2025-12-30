<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'message' => 'PHP Laravel API - Testing Auto-Docker Extension'
    ]);
});

Route::get('/health', function () {
    return response()->json([
        'status' => 'healthy'
    ]);
});
