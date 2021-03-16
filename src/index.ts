import { API } from 'compressarr';

import { PLATFORM_NAME } from './settings';
import { ExampleCompressarrJobAction } from './platform';

/**
 * This method registers the job action with Compressarr.
 */
export = (api: API) => {
    api.registerPlatform(PLATFORM_NAME, ExampleCompressarrJobAction);
};