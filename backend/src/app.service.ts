import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): any {
    return {
      status: 'ok',
      version: 'v1.3.0',
      message: 'Development Nightly Build'
    };
  }
}
