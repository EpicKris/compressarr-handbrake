import { API, APIEvent, JobActionConfig, JobActionPlugin, Logger } from 'compressarr';
import { JobIdentifier } from 'compressarr/lib/api';
import { KillError } from 'compressarr/lib/errors';
import { Job } from 'compressarr/lib/job';

import { copyFile, removeSync } from 'fs-extra';

/**
 * Compressarr Job Action
 * This class is the main constructor for your plugin, this is where you should parse the user config.
 */
export class ExampleCompressarrPlatform implements JobActionPlugin {

    /**
     * This is used to track jobs.
     */
    public readonly jobs: JobIdentifier[] = [];

    constructor(
        public readonly log: Logger,
        public readonly config: JobActionConfig,
        public readonly api: API,
    ) {
        this.log.debug('Finished initializing job action:', this.config.name);

        this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
            log.debug('Executed didFinishLaunching callback');
        });
    }

    /**
     * This function is invoked when compressarr starts a job.
     * @param job Job
     */
    async start(job: Job): Promise<Job> {
        this.log.info('Starting job action:', job.identifier);
        this.jobs.push(job.identifier);

        /**
         * EXAMPLE ONLY
         * A real plugin you would check if the job action needs to continue.
         */
        const breakJob = true;

        if (breakJob) {
            this.log.info('Breaking job action:', job.identifier);

            return job;
        }

        this.log.info('Continuing job action:', job.identifier);

        /**
         * Source Path
         * The original media file to be converted to a new file format.
         */
        const srcPath = job.getSrcPath();

        /**
         * Source Extension
         */
        const srcExt = job.getSrcExt();

        /**
         * Destination Path
         * New file to create to the setting’s specifications and then an action is automatically performed on the transcoded file.
         */
        const destPath = job.getDestPath(srcExt);

        /**
         * EXAMPLE ONLY
         * A real plugin you would create a new file to the setting's specifications.
         */
        const action = copyFile(srcPath, destPath);

        /**
         * Checking status asynchronously.
         * Example showing how to check the state of a Job asynchronously.
         */
        const interval = setInterval(() => {
            if (!this.jobs.includes(job.identifier)) {
                removeSync(destPath);

                throw new KillError();
            }

            this.log.debug('Job Status:');
        }, 10000);

        await action;

        clearInterval(interval);
        job.setPath(destPath);

        return job;
    }

    /**
     * This function is invoked when compressarr kills a job.
     * @param identifier Job Identifier
     */
    async kill(identifier: JobIdentifier): Promise<void> {
        /** Index */
        const index = this.jobs.indexOf(identifier);

        this.jobs.splice(index, index + 1);
    }
}