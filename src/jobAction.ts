import { API, APIEvent, Job, JobActionConfig, JobActionPlugin, JobIdentifier, KillError, Logger } from 'compressarr';

import { spawnSync } from 'child_process';

import ffprobe from 'ffprobe-client';
import ffprobeStatic from 'ffprobe-static';
import { HandbrakeOptions, spawn } from 'handbrake-js';
import { HandbrakeCLIPath } from 'handbrake-js/lib/config';
import toSpawnArgs from 'object-to-spawn-args';
import { getError } from '@epickris/node-logger';

/** Compressarr HandBrake Job Action Configuration */
export interface CompressarrHandBrakeJobActionConfig extends JobActionConfig {
    
    /** General Options */
    
    /**
     * Select preset by name (case-sensitive).
     */
    preset?: string;

    /** Destination Options */

    /**
     * Optimize MP4 files for HTTP streaming (fast start, s.s. rewrite file to place MOOV atom at beginning).
     */
    optimize?: boolean;

    /** Video Options */

    /**
     * Select video encoder.
     */
    videoEncoder?: VideoEncoder;

    /**
     * Specify advanced encoding options in the same style as mencoder (all encoders except theora).
     */
    encoderOptions?: string;

    /**
     * Ensure compliance with the requested codec profile.
     */
    encoderProfile?: string;

    /**
     * Set video quality.
     */
    videoQuality?: number;

    /**
     * Set video framerate.
     * Be aware that not specifying a framerate lets HandBrake preserve a source's time stamps,
     * potentially creating variable framerate video.
     */
    videoRate?: number;

    /**
     * PFR doesn't allow the rate to go over the rate specified with `videoRate` but won't change the source timing if it's below that rate.
     */
    pfr?: boolean;

    /** Audio Options */

    /**
     * Select audio encoder(s).
     * `copy:<type>` will pass through the corresponding audio track without modification, if pass through is supported for the audio type.
     */
    audioEncoders?: AudioEncoder[];

    /** Picture Options */

    /**
     * Set maximum height in pixels.
     */
    maxHeight?: number;

    /**
     * Set maximum width in pixels.
     */
    maxWidth?: number;

    /** Filters Options */

    /**
     * Detect interlace artifacts in frames.
     * If accompanied by the decomb or deinterlace filters,
     * it causes these filters to selectively deinterlace only those frames where interlacing is detected.
     */
    combDetect?: 'default' | 'permissive' | 'fast' | string;

    /**
     * Deinterlace video using FFmpeg yadif.
     */
    deinterlace?: 'default' | 'skip-spatial' | 'bob' | string;

    /**
     * Deinterlace video using a combination of yadif, blend, cubic, or EEDI2 interpolation.
     */
    decomb?: 'default' | 'bob' | 'eedi2' | 'eedi2bob' | string;
}

/** Video Encoder */
type VideoEncoder = 'x264' | 'x264_10bit' | 'x265' | 'x265_10bit' | 'x265_12bit' | 'mpeg4' | 'mpeg2' | 'VP8' | 'VP9' | 'theora';

/** Audio Encoder */
type AudioEncoder = 'none' |
    'ca_aac' | 'ca_haac' | 'copy:aac' |
    'ac3' | 'copy:ac3' |
    'eac3' | 'copy:eac3' | 'copy:truehd' | 'copy:dts' | 'copy:dtshd' |
    'mp3' | 'copy:mp3' |
    'vorbis' | 'flac16' | 'flac24' | 'copy:flac' |
    'opus' |
    'copy';

/** HandBrake Preset */
interface HandBrakePreset {

    /** Preset Name */
    PresetName?: string;

    /** File Format */
    FileFormat?: 'av_mp4' | 'av_mkv' | 'av_webm';

    /** MP4 HTTP Optimize */
    Mp4HttpOptimize?: boolean;

    /** Picture Height */
    PictureHeight?: number;

    /** Picture Width */
    PictureWidth?: number;

    /** Video Encoder */
    VideoEncoder?: VideoEncoder;

    /** Video Profile */
    VideoProfile?: string;
}

/**
 * Compressarr HandBrake Job Action
 * This class is the main constructor for your plugin, this is where you should parse the user config.
 */
export class CompressarrHandBrakeJobAction implements JobActionPlugin {

    /**
     * This is used to track jobs.
     */
    public readonly jobs: JobIdentifier[] = [];

    /** HandBrake Preset */
    protected preset: HandBrakePreset = {};

    constructor(
        public readonly log: Logger,
        public readonly config: CompressarrHandBrakeJobActionConfig,
        public readonly api: API,
    ) {
        this.log.debug('Finished initializing job action:', this.config.name);

        if (this.config.preset) {
            try {
                this.preset = this.getPreset(this.config.preset);
            } catch (error) {
                this.log.error(getError(error));
            }
        }

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
         * Source Path
         * The original media file to be converted to a new file format.
         */
        const srcPath = job.getSrcPath();

        const breakJob = await this.shouldBreak(srcPath);

        if (breakJob) {
            this.log.info('Breaking job action:', job.identifier);

            return job;
        }

        this.log.info('Continuing job action:', job.identifier);

        /**
         * Destination Path
         * New file to create to the setting’s specifications and then an action is automatically performed on the transcoded file.
         */
        const destPath = job.getDestPath('m4v');

        await new Promise<Job>((resolve, reject) => {
            const options: HandbrakeOptions = {
                input: srcPath,
                output: destPath
            };

            if (this.config.preset) options.preset = this.config.preset;
            if (this.config.optimize) options.optimize = this.config.optimize;
            if (this.config.videoEncoder) options.encoder = this.config.videoEncoder;
            if (this.config.encoderOptions) options.encopts = this.config.encoderOptions;
            if (this.config.encoderProfile) options['encoder-profile'] = this.config.encoderProfile;
            if (this.config.videoQuality) options.quality = this.config.videoQuality;
            if (this.config.videoRate) options.rate = this.config.videoRate;
            if (this.config.pfr) options.pfr = this.config.pfr;
            if (this.config.maxHeight) options.maxHeight = this.config.maxHeight;
            if (this.config.maxWidth) options.maxWidth = this.config.maxWidth;
            if (this.config.combDetect) options['comb-detect'] = this.config.combDetect;
            if (this.config.deinterlace) options.deinterlace = this.config.deinterlace;
            if (this.config.decomb) options.decomb = this.config.decomb;

            const handBrake = spawn(options);
    
            handBrake.on('progress', (progress) => {
                if (!this.jobs.includes(job.identifier)) {
                    handBrake.cancel();
    
                    throw new KillError();
                }
    
                this.log.debug('       Job Task:', progress.task);
                this.log.debug('     Job % Done:', progress.percentComplete);
                this.log.debug('        Job FPS:', progress.fps);
                this.log.debug('Job Average FPS:', progress.avgFps);
                this.log.debug('            ETA:', progress.eta);
            });
    
            handBrake.on('complete', function() {
                job.setPath(destPath);
                resolve(job);
            });
    
            handBrake.on('error', (error) => {
                this.log.error(error.message);
                reject();
                throw error;
            });
        });

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

    /**
     * Get Preset
     */
    protected getPreset(): HandBrakePreset {
        const spawnArgs = toSpawnArgs({
            'preset-export': this.config.preset
        }, {
            quote: true
        });

        const handBrake = spawnSync(HandbrakeCLIPath, spawnArgs, {
            encoding: 'utf8'
        });

        const presetList = JSON.parse(handBrake.stdout).PresetList;

        return presetList[0];
    }

    /**
     * Should Break?
     * @param srcPath Source Path
     * @returns Should Break?
     */
    protected async shouldBreak(srcPath: string): Promise<boolean> {
        const probe = await ffprobe(srcPath, {
            path: ffprobeStatic.path
        });

        const format = probe.format;
        const videoStream = probe.streams.filter(stream => stream.codec_type === 'video')[0];

        let shouldBreak = true;

        while (shouldBreak === true) {
            if (this.preset.FileFormat) {
                shouldBreak = this.shouldBreakOnFormat(format.format_name, this.preset.FileFormat);
            }

            if (this.preset.VideoEncoder) {
                shouldBreak = this.shouldBreakOnVideoEncoder(videoStream.codec_name, this.preset.VideoEncoder);
            }

            if (this.preset.VideoProfile) {
                shouldBreak = this.shouldBreakOnVideoEncoder(videoStream.profile, this.preset.VideoProfile);
            }

            if (this.preset.PictureHeight) {
                shouldBreak = this.shouldBreakOnMaxHeight(videoStream.height, this.preset.PictureHeight);
            }

            if (this.preset.PictureWidth) {
                shouldBreak = this.shouldBreakOnMaxHeight(videoStream.width, this.preset.PictureWidth);
            }

            if (this.config.videoEncoder) {
                shouldBreak = this.shouldBreakOnVideoEncoder(videoStream.codec_name, this.config.videoEncoder);
            }

            if (this.config.encoderProfile) {
                shouldBreak = this.shouldBreakOnEncoderProfile(videoStream.profile, this.config.encoderProfile);
            }

            if (this.config.maxHeight) {
                shouldBreak = this.shouldBreakOnMaxHeight(videoStream.height, this.config.maxHeight);
            }

            if (this.config.maxWidth) {
                shouldBreak = this.shouldBreakOnMaxWidth(videoStream.width, this.config.maxWidth);
            }

            break;
        }

        return shouldBreak;
    }

    /**
     * Should Break on Format?
     * @param srcFormat Source Format
     * @param destFormat Destination Format
     * @returns Should Break?
     */
    protected shouldBreakOnFormat(srcFormat: string, destFormat: string): boolean {
        srcFormat = srcFormat.toLocaleLowerCase();
        destFormat = destFormat.toLocaleLowerCase();

        const srcFormats = destFormat.split(',');
        const destFormats = srcFormat.split('_');

        if (destFormats.length > 0) destFormat = destFormats[1];

        if (srcFormats.includes(destFormat)) return false;

        return true;
    }

    /**
     * Should Break on Video Encoder?
     * @param srcVideoEncoder Source Video Encoder
     * @param destVideoEncoder Destination Video Encoder
     * @returns Should Break?
     */
    protected shouldBreakOnVideoEncoder(srcVideoEncoder: string, destVideoEncoder: string): boolean {
        srcVideoEncoder = srcVideoEncoder.toLocaleLowerCase();
        destVideoEncoder = destVideoEncoder.toLocaleLowerCase();
        destVideoEncoder = destVideoEncoder.split('_')[0];

        if (srcVideoEncoder !== destVideoEncoder) return false;

        return true;
    }

    /**
     * Should Break on Encoder Profile?
     * @param srcEncoderProfile Source Encoder Profile
     * @param destEncoderProfile Destination Encoder Profile
     * @returns Should Break?
     */
    protected shouldBreakOnEncoderProfile(srcEncoderProfile: string, destEncoderProfile: string): boolean {
        srcEncoderProfile.toLocaleLowerCase();
        destEncoderProfile.toLocaleLowerCase();

        if (srcEncoderProfile !== destEncoderProfile) return false;

        return true;
    }

    /**
     * Should Break on Maximum Height?
     * @param srcHeight Source Height
     * @param destMaxHeight Destination Maximum Height
     * @returns Should Break?
     */
    protected shouldBreakOnMaxHeight(srcHeight: number, destMaxHeight: number): boolean {
        return this.shouldBreakOnMaxDimension(srcHeight, destMaxHeight);
    }

    /**
     * Should Break on Maximum Width?
     * @param srcWidth Source Width
     * @param destMaxWidth Destination Maximum Width
     * @returns Should Break?
     */
     protected shouldBreakOnMaxWidth(srcWidth: number, destMaxWidth: number): boolean {
        return this.shouldBreakOnMaxDimension(srcWidth, destMaxWidth);
    }

    /**
     * Should Break on Maximum Dimension?
     * @param srcDimension Source Dimension
     * @param destMaxDimension Destination Maximum Dimension
     * @returns Should Break?
     */
    protected shouldBreakOnMaxDimension(srcDimension: number, destMaxDimension: number): boolean {
        if (destMaxDimension === 0) return true;

        if (srcDimension > destMaxDimension) return false;

        return true;
    }
}