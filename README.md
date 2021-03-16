# Compressarr Job Action Plugin Template

This is a template Compressarr job action plugin and can be used as a base to help you get started developing your own plugin.

## Clone As Template

Click the link below to create a new GitHub Repository using this template, or click the *Use This Template* button above.

<span align="center">

### [Create New Repository From Template](https://github.com/EpicKris/compressarr-plugin-template/generate)

</span>

## Setup Development Environment

To develop Compressarr plugins you must have Node.js 12 or later installed, and a modern code editor such as [VS Code](https://code.visualstudio.com).
This plugin template uses [TypeScript](https://typescriptlang.org) to make development easier and comes with pre-configured settings for [VS Code](https://code.visualstudio.com) and ESLint.
If you are using VS Code install these extensions:

* [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

## Install Development Dependencies

Using a terminal, navigate to the project folder and run this command to install the development dependencies:

```bash
yarn install
```

## Update package.json

Open the [`package.json`](./package.json) and change the following attributes:

* `name` - this should be prefixed with `compressarr-` or `@username/compressarr-` and contain no spaces or special characters apart from a dashes
* `displayName` - this is the "nice" name displayed in the Compressarr UI
* `repository.url` - Link to your GitHub repo
* `bugs.url` - Link to your GitHub repo issues page

When you are ready to publish the plugin you should set `private` to false, or remove the attribute entirely.

## Update Plugin Defaults

Open the [`src/settings.ts`](./src/settings.ts) file and change the default values:

* `PLATFORM_NAME` - Set this to be the name of your platform. This is the name of the platform that users will use to register the plugin in the Homebridge `config.json`.
* `PLUGIN_NAME` - Set this to be the same name you set in the [`package.json`](./package.json) file.

## Build Plugin

TypeScript needs to be compiled into JavaScript before it can run. The following command will compile the contents of your [`src`](./src) directory and put the resulting code into the `dist` folder.

```bash
yarn run build
```

## Link To Compressarr

Run this command so your global install of Compressarr can discover the plugin in your development environment:

```bash
yarn link
```

You can now start Compressarr, use the `-D` flag so you can see debug log messages in your plugin:

```bash
compressarr -D
```

## Watch For Changes and Build Automatically

If you want to have your code compile automatically as you make changes, and restart Compressarr automatically between changes you can run:

```bash
yarn run watch
```

This will launch an instance of Compressarr in debug mode which will restart every time you make a change to the source code.
It will load the config stored in the default location under `~/.compressarr`.
You may need to stop other running instances of Compressarr while using this command to prevent conflicts.
You can adjust the Compressarr startup command in the [`nodemon.json`](./nodemon.json) file.

## Customise Plugin

You can now start customising the plugin template to suit your requirements.

* [`src/jobAction.ts`](./src/jobAction.ts) - this is where your job action setup and and control logic should go.

## Versioning Your Plugin

Given a version number `MAJOR`.`MINOR`.`PATCH`, such as `1.4.3`, increment the:

1. **MAJOR** version when you make breaking changes to your plugin,
2. **MINOR** version when you add functionality in a backwards compatible manner, and
3. **PATCH** version when you make backwards compatible bug fixes.

You can use the `yarn version` command to help you with this:

```bash
# major update / breaking changes
yarn version major

# minor update / new features
yarn version update

# patch / bugfixes
yarn version patch
```

## Publish Package

When you are ready to publish your plugin to [npm](https://www.npmjs.com/), make sure you have removed the `private` attribute from the [`package.json`](./package.json) file then run:

```bash
yarn publish
```

If you are publishing a scoped plugin, i.e. `@username/compressarr-xxx` you will need to add `--access=public` to command the first time you publish.

### Publishing Beta Versions

You can publish *beta* versions of your plugin for other users to test before you release it to everyone.

```bash
# create a new pre-release version (eg. 2.1.0-beta.1)
yarn version prepatch --preid beta

# publsh to @beta
yarn publish --tag=beta
```

Users can then install the  *beta* version by appending `@beta` to the install command, for example:

```
sudo yarn global add compressarr-example-plugin@beta
```

