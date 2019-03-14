/**
 * @fileoverview The @eslint/config utility
 * @author Nicholas C. Zakas
 */

"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const { ObjectSchema } = require("@humanwhocodes/object-schema");
const { normalizePackageName } = require("../util/naming");
const ConfigCache = require("../config/config-cache");
const ConfigFile = require("../config/config-file");
const Linter = require("../linter");
const Plugins = require("../config/plugins");
const environments = require("../../conf/environments");

const debug = require("debug")("eslint:@eslint/config");

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

// stub config context
class ConfigContext {
    constructor() {
        this.configCache = new ConfigCache();
        this.linterContext = new Linter();
        this.plugins = new Plugins(
            this.linterContext.environments,
            this.linterContext.defineRule.bind(this.linterContext)
        );
    }
}

const configContext = new ConfigContext();



function hydrateExtends(configs, relativeTo) {
    if (!Array.isArray(configs)) {
        configs = [configs];
    }

    return configs.map((entry, index) => {

        // pass through predefined configs
        if (entry.startsWith("eslint:")) {
            debug(`Hydrating ${ entry } to string`);
            return entry;
        }
        
        debug(`Hydrating ${ entry } to object relative to ${ relativeTo }`);
        return ConfigFile.load(entry, configContext, relativeTo);
    });
}

function hydrateESLintRC(eslintRC, relativeTo) {
    const hydrated = Object.assign({}, eslintRC);
    relativeTo = eslintRC.baseDirectory || relativeTo;

    if (eslintRC.extends) {
        hydrated.extends = hydrateExtends(eslintRC.extends, relativeTo)
            .map(config => hydrateESLintRC(config, config.baseDirectory));
    }

    return hydrated;
}

function *flatTraverseESLintRC(eslintRC) {
    if (eslintRC.extends) {
        if (Array.isArray(eslintRC.extends)) {
            for (const item of eslintRC.extends) {
                if (Array.isArray(item)) {
                    yield* flatTraverseESLintRC(item);
                } else {
                    yield item;
                }
            }
        } else {
            yield* eslintRC.extends;
        }
    }

    const strippedESLintRC = Object.assign({}, eslintRC);
    delete strippedESLintRC.extends;
    delete strippedESLintRC.overrides;
    delete strippedESLintRC.root;

    yield strippedESLintRC;

    if (eslintRC.overrides) {
        for (const item of eslintRC.overrides) {
            yield item;
        }
    }
}

function translateESLintRC(config) {
    return config;
}

//------------------------------------------------------------------------------
// Public Interface
//------------------------------------------------------------------------------

exports.importESLintRC = function(configName, basePath) {
    const originalConfig = ConfigFile.load(configName, configContext, basePath);
    const hydratedConfig = hydrateESLintRC(originalConfig, basePath);
    // const flattenedConfig = [...flatTraverseESLintRC(hydratedConfig)];
    return translateESLintRC(hydratedConfig);
};

exports.importEnvGlobals = function(envName) {
    return environments[envName].globals;
};

exports.importEnvConfig = function(envName) {
    return environments[envName];
};