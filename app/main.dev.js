/* eslint global-require: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `yarn build` or `yarn build-main`, this file is compiled to
 * `./app/main.prod.js` using webpack. This gives us some performance wins.
 *
 * @flow
 */
import {
  app,
  screen,
  BrowserWindow,
  BrowserView,
  type BrowserViewConstructorOptions
} from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import configureStore from './store/configureStore';
import { addView, setWindow } from './actions/electron';
import { MAIN } from './constants/targets';
import ROUTES from './constants/routes';
import { wakeUp } from './actions/infrastructure';
import type { BrowserViewName } from './reducers/electron';
import getRandomUserAgent from './utils/randomUserAgent';

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

const isDevelopment =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';
let firstLaunch = true;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (isDevelopment) {
  require('electron-debug')();
}

configureStore(MAIN, isDevelopment)
  // eslint-disable-next-line promise/always-return
  .then(store => {
    let mainWindow: ?BrowserWindow = null;

    // todo: extensions don't seem to load in BrowserView?
    const installExtensions = async () => {
      const installer = require('electron-devtools-installer');
      const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
      const extensions = ['REACT_DEVELOPER_TOOLS', 'REDUX_DEVTOOLS'];

      return Promise.all(
        extensions.map(name =>
          installer.default(installer[name], forceDownload)
        )
      ).catch(error => {
        // eslint-disable-next-line no-console
        console.error(`Problem installing extensions: ${error}`);
      });
    };

    /**
     * Add event listeners...
     */

    app.on('window-all-closed', () => {
      app.quit();
    });

    app.on('ready', async () => {
      if (
        process.env.NODE_ENV === 'development' ||
        process.env.DEBUG_PROD === 'true'
      ) {
        await installExtensions();
      }

      mainWindow = new BrowserWindow({
        show: false,
        width: Math.min(1200, screen.getPrimaryDisplay().workAreaSize.width),
        height: Math.min(800, screen.getPrimaryDisplay().workAreaSize.height),
        webPreferences: {
          // devTools: false
        },
        titleBarStyle: 'hidden'
      });

      store.dispatch(setWindow(mainWindow));

      const newView = (
        name: BrowserViewName,
        options: BrowserViewConstructorOptions,
        initialUrl: string
      ): BrowserView => {
        if (mainWindow === undefined || mainWindow === null) {
          // eslint-disable-next-line no-console
          console.error('Main window not defined!');
          return;
        }

        const browserView = new BrowserView(options);
        mainWindow.addBrowserView(browserView);
        store.dispatch(addView(name, browserView, initialUrl));
        return browserView;
      };

      newView(
        'sidebar',
        {
          webPreferences: {
            nodeIntegration: true
          }
        },
        `file://${__dirname}/app.html#${ROUTES.SIDEBAR}`
      );
      const puppetView = newView(
        'puppet',
        {
          webPreferences: {
            sandbox: true,
            contextIsolation: true,
            enableRemoteModule: false
          }
        },
        `file://${__dirname}/app.html#${ROUTES.PLACEHOLDER}`
      );
      puppetView.webContents.setUserAgent(getRandomUserAgent());

      newView(
        'botOverlay',
        {
          webPreferences: {
            nodeIntegration: true,
            experimentalFeatures: true
          },
          transparent: true
        },
        `file://${__dirname}/app.html#${ROUTES.BOT_OVERLAY}`
      );

      const configurationView = newView(
        'configuration',
        {
          webPreferences: {
            nodeIntegration: true
          },
          transparent: true
        },
        `file://${__dirname}/app.html#${ROUTES.CONFIGURATION}`
      );

      if (isDevelopment) {
        newView(
          'devMenu',
          {
            webPreferences: {
              nodeIntegration: true,
              experimentalFeatures: true
            },
            transparent: true
          },
          `file://${__dirname}/app.html#${ROUTES.DEV_MENU}`
        );
      }

      configurationView.webContents.on('did-finish-load', () => {
        if (mainWindow === undefined || mainWindow === null) {
          // eslint-disable-next-line no-console
          console.error('Main window not defined!');
          return;
        }

        store.dispatch(wakeUp());

        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }

        if (firstLaunch) {
          configurationView.webContents.focus();
          firstLaunch = false;
        }
      });

      mainWindow.on('closed', () => {
        mainWindow = null;
      });

      mainWindow.setMenuBarVisibility(false);

      // eslint-disable-next-line no-new
      new AppUpdater();
    });
  })
  .catch(error => {
    // eslint-disable-next-line no-console
    console.error(error);
  });
