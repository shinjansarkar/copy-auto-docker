import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello() {
    return { message: 'NestJS API - Testing Auto-Docker Extension' };
  }

  @Get('health')
  getHealth() {
    return { status: 'healthy' };
  }
}
