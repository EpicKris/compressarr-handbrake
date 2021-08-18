import { API } from 'compressarr';

import { PLATFORM_NAME } from './settings';
import { CompressarrHandBrakeJobAction } from './jobAction';

/**
 * This method registers the job action with Compressarr.
 */
export = (api: API) => {
    api.registerJobAction(PLATFORM_NAME, CompressarrHandBrakeJobAction);
};