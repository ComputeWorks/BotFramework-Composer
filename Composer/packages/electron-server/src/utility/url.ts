// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import lowerCase from 'lodash/lowerCase';

import log from './logger';
const error = log.extend('electron-deeplink-url');

export const parseDeepLinkUrl = (deeplinkUrl: string) => {
  try {
    const convertedUrl = new URL(deeplinkUrl);
    const action = lowerCase(convertedUrl.hostname);
    switch (action) {
      case 'open': {
        const encodedUrl: string = convertedUrl.searchParams.get('url') || '';
        const source = convertedUrl.searchParams.get('source');
        const payload = convertedUrl.searchParams.get('payload');
        if (encodedUrl) {
          return decodeURIComponent(encodedUrl);
        } else if (source && payload) {
          return `projects/create?source=${encodeURIComponent(source)}&payload=${encodeURIComponent(payload)}`;
        } else {
          return '';
        }
      }

      case 'create': {
        const source = convertedUrl.searchParams.get('source');
        const payload = convertedUrl.searchParams.get('payload');
        if (!source || !payload) {
          return `projects/${convertedUrl.hostname}${convertedUrl.pathname}${convertedUrl.search}`;
        } else {
          return `projects/create?source=${encodeURIComponent(source)}&payload=${encodeURIComponent(payload)}`;
        }
      }

      // process the import and load the URL at the server
      case 'import': {
        const source = convertedUrl.searchParams.get('source');
        const payload = convertedUrl.searchParams.get('payload');
        if (!source || !payload) {
          throw new Error('bfcomposer://import must include a "source" and "payload" parameter.');
        }

        return `projects/import?source=${encodeURIComponent(source)}&payload=${encodeURIComponent(payload)}`;
      }

      default:
        return '';
    }
  } catch (ex) {
    error('Error occurred while parsing deeplink url: ', ex);
    return '';
  }
};
