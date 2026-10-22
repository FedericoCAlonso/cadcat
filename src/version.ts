import packageJson from '../package.json';

/**
 * Application version dynamically resolved from package.json (Zero-Hardcoding policy).
 * Automatically updates whenever the project version is updated, eliminating hardcoded version strings.
 */
export const APP_VERSION: string = packageJson.version;
export const APP_AUTHOR: string = typeof packageJson.author === 'string'
  ? packageJson.author.replace(/<.*>/, '').trim()
  : 'Federico C. Alonso';
export const APP_COPYRIGHT: string = `© ${new Date().getFullYear()} ${APP_AUTHOR}. Todos los derechos reservados.`;

