import './styles.css';
import siteConfig from '../site.config.json';
import { initApp } from './app';
import { validateSiteConfig } from './config';

// The build already rejects placeholders (see vite.config.ts); at runtime only the shape is checked
// so a visitor never gets a blank page because of a config detail.
initApp({ document, config: validateSiteConfig(siteConfig, { production: false }) });
