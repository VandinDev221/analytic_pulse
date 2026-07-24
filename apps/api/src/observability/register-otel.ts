/**
 * Pré-carregue com: node -r ./dist/register-otel.js  ou
 * ts-node-dev -r ./src/register-otel.ts
 * Garante instrumentação HTTP/Express/pg antes do app.
 */
import { startOtel } from './otel';

startOtel();
