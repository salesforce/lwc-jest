/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const { PROJECT_ROOT, getSfdxProjectJson } = require('./project');

const { error, info } = require('../log');
const { jestConfig, expectedApiVersion, jestPath } = require('../config');

// List of CLI options that should be passthrough to jest.
const JEST_PASSTHROUGH_OPTIONS = new Set(['coverage', 'updateSnapshot', 'verbose', 'watch']);

function validSourceApiVersion() {
    const sfdxProjectJson = getSfdxProjectJson();
    const apiVersion = sfdxProjectJson.sourceApiVersion;
    if (apiVersion !== expectedApiVersion) {
        error(
            `Invalid sourceApiVersion found in sfdx-project.json. Expected ${expectedApiVersion}, found ${apiVersion}`,
        );
    }
}

function getJestArgs(argv) {
    // Extract known options from parsed arguments
    const knownOptions = Object.keys(argv)
        .filter((key) => argv[key] && JEST_PASSTHROUGH_OPTIONS.has(key))
        .map((key) => `--${key}`);

    // Extract remaining options after `--`
    const rest = argv._;

    const jestArgs = [...knownOptions, ...rest];

    // Force jest to run in band when debugging.
    if (argv.debug) {
        jestArgs.unshift('--runInBand');
    }

    // Provide default configuration when none is present at the project root.
    const hasCustomConfig = fs.existsSync(path.resolve(PROJECT_ROOT, 'jest.config.js'));
    if (!hasCustomConfig) {
        jestArgs.unshift(`--config=${JSON.stringify(jestConfig)}`);
    }

    return jestArgs;
}

async function testRunner(argv) {
    if (!argv.skipApiVersionCheck) {
        validSourceApiVersion();
    }

    const spawnCommand = 'node';
    const spawnArgs = [jestPath, ...getJestArgs(argv)];

    if (argv.debug) {
        spawnArgs.unshift('--inspect-brk');

        info('Running in debug mode...');
        info(`${spawnCommand} ${spawnArgs.join(' ')}`);
    }

    const jest = spawn(spawnCommand, spawnArgs, {
        env: process.env,
        stdio: 'inherit',
    });

    jest.on('close', (code) => {
        process.exit(code);
    });
}

module.exports = testRunner;
