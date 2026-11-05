import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, APP_LOGGER, loadEnvironment, readConfig } from './app-config.js';

@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: () => { loadEnvironment(); return readConfig(); } },
    { provide: APP_LOGGER, useValue: console },
  ],
  exports: [APP_CONFIG, APP_LOGGER],
})
export class ConfigurationModule {}
